/**
 * The hearth fire: a bed of charred logs with glowing coals, a few
 * crossed flame cards drawn by a small noise shader (additive, no
 * textures), and a soft glow. Its brightness follows the fire light's
 * flicker (Lights.fireLevel), so the light visibly comes from it.
 * Built around the firebox floor centre (local origin); not interactable.
 */
import * as THREE from "three";
import type { Quality } from "../types";
import { makeDotTexture } from "./textures";

const FLAME_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FLAME_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uLevel;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 1.7 + uSeed * 13.0;
  float n = fbm(vec2(uv.x * 3.2 + uSeed * 7.0, uv.y * 2.4 - t));
  float n2 = fbm(vec2(uv.x * 7.0 - uSeed * 3.0, uv.y * 5.0 - t * 1.8));
  // Tongues: the body narrows and sways more toward the tip.
  float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.9 * uv.y;
  float width = mix(0.9, 0.08, pow(uv.y, 0.75));
  float body = 1.0 - smoothstep(width * 0.45, width, abs(x));
  float top = uLevel * (0.62 + 0.38 * n);
  float vertical = 1.0 - smoothstep(top * 0.45, top, uv.y + (n2 - 0.5) * 0.3);
  float f = body * vertical * (0.55 + 0.75 * n2);
  f *= smoothstep(0.0, 0.1, uv.y);
  vec3 col = mix(vec3(0.75, 0.12, 0.01), vec3(1.0, 0.5, 0.1), smoothstep(0.1, 0.55, f));
  col = mix(col, vec3(1.0, 0.86, 0.55), smoothstep(0.7, 1.05, f));
  gl_FragColor = vec4(col * f * 1.7, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface HearthFire {
  group: THREE.Group;
  /** level ≈ 1 (fire light flicker / FIRE_BASE); speed < 1 slows the flames. */
  update(elapsed: number, level: number, speed: number): void;
  setQuality(quality: Quality): void;
}

export function buildHearthFire(width: number, height: number): HearthFire {
  const group = new THREE.Group();
  group.name = "hearthFire";

  // --- Log bed: charred logs, ember-lit undersides ---------------------------
  const logMat = new THREE.MeshStandardMaterial({
    color: 0x1c130c,
    emissive: 0x7a2606,
    emissiveIntensity: 0.55,
    roughness: 0.95,
  });
  const logGeo = new THREE.CylinderGeometry(0.045, 0.05, width * 0.85, 8);
  const logs: Array<[number, number, number, number]> = [
    // x, y, z, yaw (logs lie across the firebox)
    [0, 0.05, 0.04, 0.12],
    [0, 0.05, -0.08, -0.1],
    [0.02, 0.12, -0.02, 0.35],
  ];
  for (const [x, y, z, yaw] of logs) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.set(0, yaw, Math.PI / 2);
    log.position.set(x, y, z);
    log.userData.noShadow = true;
    group.add(log);
  }

  // --- Coal glow on the firebox floor -----------------------------------------
  const dot = makeDotTexture();
  const coals = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.05, 0.34).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: dot,
      color: 0xff5a14,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  coals.position.y = 0.012;
  coals.userData.noShadow = true;
  group.add(coals);

  // --- Flame cards ------------------------------------------------------------
  const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const cards: { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> }[] = [];
  const specs: Array<[number, number, number, number, number]> = [
    // x, z, yaw, width scale, height scale
    [0, 0, 0, 1, 1],
    [-width * 0.18, -0.05, 0.5, 0.65, 0.8],
    [width * 0.2, -0.03, -0.45, 0.6, 0.75],
    [0.02, 0.05, 0.15, 0.55, 0.62],
  ];
  specs.forEach(([x, z, yaw, ws, hs], i) => {
    const uniforms = {
      uTime: { value: 0 },
      uSeed: { value: i * 0.37 + 0.11 },
      uLevel: { value: 1 },
    };
    const mesh = new THREE.Mesh(
      flameGeo,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.scale.set(width * 0.8 * ws, height * 0.78 * hs, 1);
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = yaw;
    mesh.userData.noShadow = true;
    // Drawn after the coal glow, before particles.
    mesh.renderOrder = 2;
    group.add(mesh);
    cards.push({ mesh, uniforms });
  });

  // --- Soft glow halo (the camera always looks in from +Z) --------------------
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: dot,
      color: 0xff7a2a,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.set(width * 2.2, height * 1.5, 1);
  halo.position.set(0, height * 0.32, 0.06);
  halo.renderOrder = 3;
  halo.userData.noShadow = true;
  group.add(halo);
  const haloMaterial = halo.material as THREE.MeshBasicMaterial;

  let time = 0;
  let lastElapsed = 0;
  return {
    group,
    update(elapsed, level, speed) {
      // Integrate time at the requested speed so a speed change never jumps.
      const dt = THREE.MathUtils.clamp(elapsed - lastElapsed, 0, 0.1);
      lastElapsed = elapsed;
      time += dt * speed;
      for (const card of cards) {
        card.uniforms.uTime!.value = time;
        card.uniforms.uLevel!.value = level;
      }
      logMat.emissiveIntensity = 0.45 + 0.2 * level;
      haloMaterial.opacity = 0.32 + 0.16 * level;
    },
    setQuality(quality) {
      // Low: two flame cards are plenty.
      cards.forEach((card, i) => {
        card.mesh.visible = quality !== "low" || i < 2;
      });
    },
  };
}
