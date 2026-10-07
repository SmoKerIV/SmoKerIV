/**
 * Post-processing chain for medium/high quality (low renders direct):
 *
 *   RenderPass (HDR, linear, MSAA) → UnrealBloomPass (emitted light only,
 *   via an alpha bloom mask + a low threshold: flames, fire, embers,
 *   lantern, runes and the moon glow; lit parchment and wood never do) →
 *   grade (vignette + film grain, one cheap pass) → OutputPass (ACES tone
 *   mapping + sRGB, done exactly once).
 *
 * The renderer keeps its toneMapping/outputColorSpace settings: three skips
 * both when drawing into a render target, and OutputPass reads them back,
 * so the composed image matches the direct render's colours.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Bloom mask in the scene target's alpha. Opaque lit materials normally
 * write alpha 1; here they write the share of their light that is emitted
 * (flames, embers, glowing logs, the hovered item's rim) and 0 for plain
 * lit surfaces — so parchment and wood under a candle never bloom however
 * bright, while emitters do. Unlit materials (fire sprites, moon, runes)
 * keep their own alpha; transparent ones keep theirs for blending. The
 * canvas has no alpha channel, so the direct (low) render is unaffected.
 */
const BLOOM_MASK_CHUNK = /* glsl */ `
#ifdef OPAQUE
diffuseColor.a = 1.0;
#if defined( STANDARD ) || defined( PHONG ) || defined( LAMBERT ) || defined( TOON )
diffuseColor.a = clamp(
  dot( totalEmissiveRadiance, vec3( 0.2126, 0.7152, 0.0722 ) ) /
    max( dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 ),
  0.0, 1.0 );
#endif
#endif

#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif

gl_FragColor = vec4( outgoingLight, diffuseColor.a );
`;
THREE.ShaderChunk.opaque_fragment = BLOOM_MASK_CHUNK;

export type PostQuality = "medium" | "high";

interface PostProfile {
  /** MSAA samples on the scene target (the canvas' own AA is bypassed). */
  samples: number;
  /** Bloom chain resolution relative to the canvas (the pass halves it again). */
  bloomScale: number;
  grain: number;
}

const PROFILES: Record<PostQuality, PostProfile> = {
  high: { samples: 4, bloomScale: 1, grain: 0.055 },
  medium: { samples: 2, bloomScale: 0.5, grain: 0 },
};

/**
 * Masked (emitted) linear luminance a pixel needs before it blooms: the
 * rune circle and lantern glass just clear it, flames and fire are far
 * above; the night sky stays below.
 */
const BLOOM_THRESHOLD = 0.15;
const BLOOM_STRENGTH = 0.5;
const BLOOM_RADIUS = 0.55;
/** Vignette darkening at the corners (0 = none). */
const VIGNETTE = 0.42;
/** Width of the threshold's soft knee (luminance). */
const BLOOM_KNEE = 0.35;
/**
 * Ceiling on what one pixel feeds the bloom: keeps the hearth (a big, very
 * hot area) from washing out to white and guards against fp16 overflow.
 */
const BLOOM_CLAMP = 1;

const GradeShader = {
  name: "InnGradeShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uGrain: { value: 0 },
    uVignette: { value: VIGNETTE },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      // Clamp fp16 overflow (see the bloom note) before tone mapping.
      vec4 color = clamp(texture2D(tDiffuse, vUv), 0.0, 64.0);
      // Aspect-corrected radial falloff, 0 at the centre, 1 in the corners.
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float d = length(p) / length(vec2(uAspect, 1.0) * 0.5);
      float vignette = 1.0 - uVignette * smoothstep(0.42, 1.08, d);
      // Multiplicative grain: in linear light this stays even across tones
      // (additive grain would boil in the shadows after the sRGB curve).
      float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 517.0) - 0.5;
      color.rgb *= vignette * (1.0 + uGrain * n);
      gl_FragColor = color;
    }`,
};

export class PostFX {
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly output: OutputPass;
  private readonly profile: PostProfile;
  /** Scene target (MSAA); owned here, the composer clones it for ping-pong. */
  private readonly target: THREE.WebGLRenderTarget;

  private readonly renderer: THREE.WebGLRenderer;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    quality: PostQuality,
  ) {
    this.renderer = renderer;
    this.profile = PROFILES[quality];
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: this.profile.samples,
    });
    this.target.texture.name = "PostFX.scene";
    this.composer = new EffectComposer(renderer, this.target);

    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    // Bloom only what the scene emits: weight each pixel by its alpha bloom
    // mask (see BLOOM_MASK_CHUNK) and cap it, so a hot fp16 glint can't
    // smear into a blob; the threshold gets a soft knee.
    const highPass = (this.bloom as unknown as { materialHighPassFilter: THREE.ShaderMaterial })
      .materialHighPassFilter;
    highPass.fragmentShader = highPass.fragmentShader
      .replace("void main() {", "uniform float bloomClamp;\nvoid main() {")
      .replace(
        "vec4 texel = texture2D( tDiffuse, vUv );",
        "vec4 texel = texture2D( tDiffuse, vUv );\n" +
          "vec3 glow = texel.rgb * clamp( texel.a, 0.0, 1.0 );\n" +
          // Scale, don't clip per channel: clipping turns orange flames yellow-green.
          "texel = vec4( glow * min( 1.0, bloomClamp / max( max( glow.r, glow.g ), max( glow.b, 1e-4 ) ) ), 1.0 );",
      );
    highPass.uniforms.bloomClamp = { value: BLOOM_CLAMP };
    highPass.uniforms.smoothWidth.value = BLOOM_KNEE;
    // Medium: run the whole bloom chain at a reduced resolution.
    const bloomSetSize = this.bloom.setSize.bind(this.bloom);
    const scale = this.profile.bloomScale;
    this.bloom.setSize = (w: number, h: number) =>
      bloomSetSize(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale)));

    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uGrain.value = this.profile.grain;
    this.output = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);

    const css = renderer.getSize(new THREE.Vector2());
    this.setSize(css.x, css.y, renderer.getPixelRatio());
  }

  /** CSS size + device pixel ratio (mirrors renderer.setSize/setPixelRatio). */
  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.grade.uniforms.uAspect.value = width / Math.max(height, 1);
  }

  render(elapsed: number, delta: number): void {
    this.grade.uniforms.uTime.value = elapsed;
    this.composer.render(delta);
  }

  /**
   * Compile every program the chain will use, for the exact render-target
   * state each pass draws with (program keys depend on it): the scene and
   * the inner passes into a linear HDR target, OutputPass to the canvas.
   */
  compileAsync(scene: THREE.Scene, camera: THREE.Camera): Promise<unknown> {
    const renderer = this.renderer;
    const previous = renderer.getRenderTarget();
    const quad = new THREE.PlaneGeometry(2, 2);
    const warm = (materials: THREE.Material[]): THREE.Scene => {
      const s = new THREE.Scene();
      for (const material of materials) s.add(new THREE.Mesh(quad, material));
      return s;
    };

    // OutputPass builds its defines lazily on the first render; mirror them
    // so the warmed program is the one it will ask for.
    const defines: Record<string, string> = {};
    if (
      THREE.ColorManagement.getTransfer(renderer.outputColorSpace) ===
      THREE.SRGBTransfer
    ) {
      defines.SRGB_TRANSFER = "";
    }
    if (renderer.toneMapping === THREE.ACESFilmicToneMapping) {
      defines.ACES_FILMIC_TONE_MAPPING = "";
    }
    this.output.material.defines = defines;

    const b = this.bloom as unknown as {
      materialHighPassFilter: THREE.Material;
      separableBlurMaterials: THREE.Material[];
      compositeMaterial: THREE.Material;
      blendMaterial: THREE.Material;
    };
    const inner = warm([
      b.materialHighPassFilter,
      ...b.separableBlurMaterials,
      b.compositeMaterial,
      b.blendMaterial,
      this.grade.material,
    ]);
    const screen = warm([this.output.material]);

    renderer.setRenderTarget(this.composer.readBuffer);
    const jobs = [
      renderer.compileAsync(scene, camera),
      renderer.compileAsync(inner, camera),
    ];
    renderer.setRenderTarget(null);
    jobs.push(renderer.compileAsync(screen, camera));
    renderer.setRenderTarget(previous);
    return Promise.all(jobs).finally(() => quad.dispose());
  }

  dispose(): void {
    this.renderPass.dispose();
    this.bloom.dispose();
    this.grade.dispose();
    this.output.dispose();
    // Disposes both ping-pong targets (target is renderTarget1) + copy pass.
    this.composer.dispose();
  }
}
