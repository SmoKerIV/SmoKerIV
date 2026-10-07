#!/usr/bin/env node
/**
 * prepare-audio.mjs — CC0 source recordings -> public/audio (Opus/WebM + AAC/M4A) + manifest.json
 *
 * Usage:  node scripts/prepare-audio.mjs [--only slot1,slot2] [--viz <dir>] [--keep-work]
 *   --only   rebuild only the listed slots (manifest entries for the others are kept)
 *   --viz    also write a spectrogram+waveform PNG per output (and a doubled-loop seam PNG per loop) into <dir>
 * Needs: node >= 18, ffmpeg + ffprobe (libopus, aac, rubberband optional), unzip.
 *
 * REQUIRED SOURCE FILES (all CC0; see docs/sounds.md "Chosen files").  SRC defaults to
 * ~/Downloads/sounds, override with AUDIO_SRC=/path.
 *   Freesound WAV/FLAC directly in SRC (filename starts with the Freesound id):
 *     136542 electric_zap_001 | 242867 blowing-out-candle | 347562 distant-thunder-clap_gentle
 *     387128 the-fireplace-3 | 423811 match-strike-03 | 431174 fireball-explosion
 *     454222 thud-pint-glass-beer-down-on-table | 522705 fireball-woosh-pass-fast
 *     569788 board-game-taps-and-clatter | 573835 door-knocks-wood-close | 639429 crystal-twinkle
 *     648959 heavy-book | 744447 soft-room-tone | 753282 parchment-unroll | 764367 dice-rolling
 *     840120 ambience-stereo_interior-wind-through-window | 844398 mysterious-sparkle-flourish
 *     856497 turning-page-heavy-paper
 *   SRC/direct/*.zip  (extracted by this script into SRC/extracted/<pack>/ when missing):
 *     tinysized.zip accessory.zip 80-CC0-RPG-SFX_0.zip rpg_sound_pack.zip   (OpenGameArt, Vehicle / rubberduck / artisticdude)
 *     kenney_interface-sounds.zip kenney_ui-audio.zip kenney_rpg-audio.zip kenney_impact-sounds.zip
 *     kenney_music-jingles.zip kenney_casino-audio.zip
 *   SRC/direct/wooden-dice-{1..4}.flac  (OpenGameArt, Wuzzy)
 *
 * Processing model
 *   one-shots: cut -> mono 48 kHz -> high-pass (DC + rumble) -> optional low-pass/pitch -> optional silence trim              -> fades -> gain = min(categoryRmsTarget - rms, -3 dBFS - peak)  (loudness match, peak capped at -3 dBFS)
 *   loops:     cut -> equal-power (qsin) crossfade of the tail into the head (wraps seamlessly) -> high-pass
 *              -> integrated-loudness gain to target LUFS -> brickwall limiter at -3 dBFS
 *   encode:    libopus in WebM (mono 40 kbps SFX, 56-64 kbps ambience) and AAC in M4A
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../public/audio')
const SRC = process.env.AUDIO_SRC || join(homedir(), 'Downloads/sounds')
const EX = join(SRC, 'extracted')
const WORK = join(tmpdir(), 'smoker-audio-work')
const SR = 48000

const argv = process.argv.slice(2)
const argVal = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null }
const ONLY = argVal('--only')?.split(',') ?? null
const VIZ = argVal('--viz')
const KEEP = argv.includes('--keep-work')

// ---------------------------------------------------------------- source paths
const F = (id, name) => join(SRC, `${id}__${name}`)
const src = {
  zap: F('136542', 'joelaudio__electric_zap_001.wav'),
  candle: F('242867', 'reitanna__blowing-out-candle.wav'),
  thunder: F('347562', 'mikala_oidua__distant-thunder-clap_gentle.wav'),
  fire: F('387128', 'nooneisreal__the-fireplace-3.wav'),
  match: F('423811', 'scalywhale__match-strike-03.wav'),
  fireImpact: F('431174', 'blankened__fireball-explosion.wav'),
  tankard: F('454222', 'kyles__thud-pint-glass-beer-down-on-table-wood-knock-door-vows.flac'),
  fireWhoosh: F('522705', 'julianmateo__fireball-woosh-pass-fast.wav'),
  clatter: F('569788', 'taure__board-game-taps-and-clatter.wav'),
  knocks: F('573835', 'trp__door-knocks-wood-close-77mel-191026.wav'),
  twinkle: F('639429', 'laurenponder__crystal-twinkle.wav'),
  book: F('648959', 'ienba__heavy-book.wav'),
  room: F('744447', 'callmethefoo__soft-room-tone.wav'),
  parchment: F('753282', 'vrymaa__parchment-unroll.wav'),
  dice: F('764367', 'h_botha__dice-rolling.wav'),
  wind: F('840120', 'jordi77rs__ambience-stereo_interior-wind-through-window.wav'),
  sparkle: F('844398', 'skyspeira__mysterious-sparkle-flourish.wav'),
  page: F('856497', 'xkeril__turning-page-heavy-paper.wav'),
}
const tiny = (n) => join(EX, 'tinysized/sfx-cc0', n)
const acc = (n) => join(EX, 'accessory/sfx', n)
const ken = (pack, n) => join(EX, pack, 'Audio', n)
const jingle = (sub, n) => join(EX, 'music-jingles/Audio', sub, n)
const dice = (n) => join(SRC, 'direct', `wooden-dice-${n}.flac`)

// ---------------------------------------------------------------- category targets
// rms = target RMS (dBFS, whole clip) for one-shots; peak cap is -3 dBFS everywhere.
const CAT = {
  ambience: { bus: 'ambience', rms: -27 }, // ambience accents (crackles, creaks)
  spells: { bus: 'sfx', rms: -19 },
  sfx: { bus: 'sfx', rms: -22 },
  ui: { bus: 'ui', rms: -34 },
}
const PEAK_CAP = -3

// ---------------------------------------------------------------- slot table
// variant keys: src, ss (start s), t (length s), hp (Hz, default 25), lp (Hz), pitch (semitones), trim (strip leading/trailing
// silence below `thr` dB peak, default -52), fi / fo (fade in/out s), rms (override target)
const crackle = (ss) => ({ src: src.fire, ss, t: 0.17, hp: 350, fi: 0.004, fo: 0.07 })
const knock = (ss, t) => ({ src: src.knocks, ss, t, hp: 35, pitch: -3, lp: 7000, fi: 0.003, fo: 0.08 })
const hit = (ss, t) => ({ src: src.dice, ss, t, hp: 120, fi: 0.003, fo: 0.05 })

const SLOTS = [
  // ------------------------------------------------ ambience
  {
    slot: 'fire', category: 'ambience', loop: { src: src.fire, ss: 6, t: 36, xfade: 3, hp: 30, lufs: -30, br: 56, ch: 1 },
    notes: 'NoOneIsReal "The Fireplace 3": 36 s window, 3 s equal-power crossfade -> 33 s loop. Layer fire-crackle one-shots on top.',
  },
  {
    slot: 'fire-crackle', category: 'ambience', gain: 0.8, variants: [crackle(35.73), crackle(39.732), crackle(82.74), crackle(22.228), crackle(24.584), crackle(14.438)],
    notes: 'Pops cut from the same fireplace recording (high-passed 350 Hz so they do not add rumble). Randomise 0.4-3 s apart, pitch +-5 %.',
  },
  {
    slot: 'room-tone', category: 'ambience', loop: { src: src.room, ss: 10, t: 30, xfade: 3, hp: 45, lufs: -40, br: 48, ch: 2 },
    notes: 'callmethefoo "Soft Room Tone" (cabin): 30 s window, 3 s crossfade -> 27 s loop at -40 LUFS (very quiet bed).',
  },
  {
    slot: 'wind-window', category: 'ambience', loop: { src: src.wind, ss: 54, t: 40, xfade: 3.5, hp: 40, lufs: -32, br: 64, ch: 2 },
    notes: 'JORDI77RS interior wind through window: steady 40 s section (54-94 s), 3.5 s crossfade -> 36.5 s stereo loop.',
  },
  {
    slot: 'creak', category: 'ambience', gain: 0.8, variants: [
      { src: ken('rpg-audio', 'creak1.ogg'), hp: 60, trim: true, fo: 0.05 },
      { src: ken('rpg-audio', 'creak3.ogg'), hp: 60, trim: true, fo: 0.05 },
      { src: tiny('floor-creak-01.wav'), hp: 60, trim: true, fo: 0.05 },
    ],
    notes: 'Kenney RPG Audio creak1/creak3 + Vehicle tinysized floor-creak-01. Random timing, quiet.',
  },

  // ------------------------------------------------ spells
  {
    slot: 'fireball-whoosh', category: 'spells', variants: [{ src: src.fireWhoosh, ss: 0.35, t: 3.1, hp: 40, fi: 0.02, fo: 0.7 }],
    notes: 'julianmateo fireball pass-by: swell 0.4-2.6 s, tail faded. Fire it on cast, impact follows ~1.2 s later.',
  },
  {
    slot: 'fireball-impact', category: 'spells', variants: [{ src: src.fireImpact, hp: 30, trim: true, fo: 0.15 }],
    notes: 'Blankened Fireball Explosion (stereo folded to mono). Source peaks at 0 dBFS with a small DC offset (removed).',
  },
  {
    slot: 'zap', category: 'spells', variants: [
      { src: src.zap, hp: 120, trim: true, fo: 0.08 },
      { src: tiny('paralyzer-discharge-01.wav'), hp: 120, trim: true, fo: 0.08 },
    ],
    notes: 'JoelAudio ELECTRIC_ZAP_001 and Vehicle tinysized paralyzer-discharge-01.',
  },
  {
    slot: 'thunder', category: 'spells', gain: 0.9, variants: [{ src: src.thunder, ss: 0.25, t: 12.5, hp: 25, fi: 0.03, fo: 2.5, rms: -22 }],
    notes: 'mikala_oidua distant thunder clap: first 12.5 s (two claps + roll), tail faded over 2.5 s.',
  },
  {
    slot: 'gust', category: 'spells', variants: [{ src: src.wind, ss: 5.0, t: 3.8, hp: 60, fi: 1.2, fo: 1.9, rms: -23 }],
    notes: 'Rising swell cut from the interior wind recording (5.0-8.8 s). Soft, whistling gust; layer with synth noise for a harder rush.',
  },
  {
    slot: 'sparkle', category: 'spells', variants: [{ src: src.sparkle, hp: 250, trim: true, fo: 0.4 }],
    notes: 'SkySpeira Mysterious Sparkle Flourish (stereo folded to mono).',
  },
  {
    slot: 'clatter', category: 'spells', variants: [
      { src: src.clatter, ss: 67.55, t: 1.95, hp: 90, fi: 0.01, fo: 0.25 },
      { src: src.clatter, ss: 78.5, t: 1.4, hp: 90, fi: 0.01, fo: 0.25 },
      { src: src.clatter, ss: 103.9, t: 1.5, hp: 90, fi: 0.01, fo: 0.25 },
    ],
    notes: 'taure board-game wooden pieces thrown; three isolated bursts.',
  },

  // ------------------------------------------------ interactions
  {
    slot: 'book-open', category: 'sfx', variants: [
      { src: src.book, ss: 1.45, t: 0.65, hp: 50, fi: 0.004, fo: 0.1 },
      { src: src.book, ss: 3.65, t: 0.7, hp: 50, fi: 0.004, fo: 0.1 },
    ],
    notes: 'IENBA Heavy Book: the two double-thump hits (cover lands + settle).',
  },
  {
    slot: 'book-close', category: 'sfx', variants: [
      { src: src.book, ss: 2.55, t: 0.65, hp: 50, fi: 0.004, fo: 0.1 },
      { src: src.book, ss: 0.0, t: 0.55, hp: 50, fi: 0.004, fo: 0.1 },
    ],
    notes: 'IENBA Heavy Book: single sharp thumps.',
  },
  {
    slot: 'page-turn', category: 'sfx', variants: [
      { src: src.page, ss: 0.3, t: 0.95, hp: 120, fi: 0.01, fo: 0.15 },
      { src: src.page, ss: 2.1, t: 0.95, hp: 120, fi: 0.01, fo: 0.15 },
      { src: tiny('book-page-02.wav'), hp: 120, trim: true, fo: 0.1 },
      { src: ken('rpg-audio', 'bookFlip1.ogg'), hp: 120, trim: true, fo: 0.1 },
    ],
    notes: 'xkeril heavy-paper turns (2 cuts), Vehicle book-page-02, Kenney bookFlip1.',
  },
  {
    slot: 'sword-ring', category: 'sfx', variants: [
      { src: tiny('sword-clash-01.wav'), hp: 150, trim: true, fo: 0.3 },
      { src: tiny('sword-clash-02.wav'), hp: 150, trim: true, fo: 0.3 },
    ],
    notes: 'Vehicle tinysized sword-clash-01/02: bright metal hit with a long harmonic ring.',
  },
  {
    slot: 'shield-knock', category: 'sfx', variants: [knock(14.14, 0.32), knock(29.25, 0.55)],
    notes: 'TRP wood-door knocks pitched down 3 semitones (rubberband), low-passed 7 kHz.',
  },
  {
    slot: 'cork-pop', category: 'sfx', variants: [
      { src: tiny('vial-glass-uncork-01.wav'), hp: 80, trim: true, fo: 0.08 },
      { src: acc('vial-glass-round-uncork-02.wav'), hp: 80, trim: true, fo: 0.08 },
      { src: acc('bottle-glass-uncork-02.wav'), hp: 80, trim: true, fo: 0.08 },
      { src: acc('vial-glass-round-uncork-03.wav'), hp: 80, trim: true, fo: 0.08 },
    ],
    notes: 'Vehicle tinysized/accessory vial and bottle uncork pops.',
  },
  {
    slot: 'slosh', category: 'sfx', variants: [
      { src: tiny('water-vial-fill-01.wav'), ss: 0, t: 1.3, hp: 100, fi: 0.01, fo: 0.2 },
      { src: tiny('water-pour-01.wav'), ss: 0.15, t: 1.2, hp: 100, fi: 0.01, fo: 0.2 },
    ],
    notes: 'WEAK: liquid gurgle from Vehicle water-vial-fill / water-pour; no true bottle-slosh in the CC0 set. Consider a synth.',
  },
  {
    slot: 'parchment', category: 'sfx', variants: [
      { src: src.parchment, ss: 13.55, t: 2.85, hp: 150, fi: 0.02, fo: 0.25 },
      { src: src.parchment, ss: 1.0, t: 2.4, hp: 150, fi: 0.02, fo: 0.25 },
    ],
    notes: 'Vrymaa Parchment - Unroll: two rustle sections.',
  },
  {
    slot: 'tankard', category: 'sfx', variants: [
      { src: src.tankard, hp: 40, trim: true, fo: 0.05 },
      { src: acc('wood-bowl-put-wood-04.wav'), hp: 40, trim: true, fo: 0.08 },
    ],
    notes: 'kyles pint glass set down on wood (source is clipped at 0 dBFS) + Vehicle wooden bowl set down. No pewter clink exists in CC0 set.',
  },
  {
    slot: 'candle-puff', category: 'sfx', variants: [{ src: src.candle, hp: 180, trim: true, thr: -38, fo: 0.1 }],
    notes: 'Reitanna Blowing Out Candle: single puff.',
  },
  {
    slot: 'match-strike', category: 'sfx', variants: [{ src: src.match, ss: 0, t: 1.3, hp: 150, trim: true, fo: 0.15 }],
    notes: 'scalywhale Match strike 03: scratch + flare. Very quiet source, normalised up.',
  },
  {
    slot: 'dice', category: 'sfx', gain: 0.9, variants: [
      hit(4.756, 0.3), hit(5.598, 0.3), hit(11.652, 0.35), hit(20.096, 0.32), hit(19.238, 0.38),
      { src: dice(3), ss: 0.252, t: 0.15, hp: 120, fi: 0.003, fo: 0.05 },
      { src: ken('casino-audio', 'die-throw-1.ogg'), ss: 0.146, t: 0.2, hp: 120, fi: 0.003, fo: 0.06 },
      { src: dice(1), ss: 0.046, t: 0.09, hp: 120, fi: 0.003, fo: 0.03 },
    ],
    notes: 'Individual impacts (physics triggers per contact): 5 from H_Botha polyhedral roll on wood, Wuzzy wooden dice 1/3, Kenney casino die-throw-1. Randomise pitch +-8 %.',
  },
  {
    slot: 'nat20', category: 'sfx', gain: 0.85, variants: [{ src: src.twinkle, hp: 250, trim: true, fo: 0.8, rms: -24 }],
    notes: 'LaurenPonder Crystal Twinkle (clean, pure partials; synthetic). Layer with sparkle.',
  },
  {
    slot: 'fanfare', category: 'sfx', gain: 0.8, variants: [
      { src: jingle('Sax jingles', 'jingles_SAX07.ogg'), hp: 40, trim: true, fo: 0.1 },
      { src: jingle('8-Bit jingles', 'jingles_NES00.ogg'), hp: 40, trim: true, fo: 0.08 },
    ],
    notes: 'Kenney Music Jingles SAX07 (brassy synth, ta-ta-ta-taaa) and NES00 (chiptune). No real brass fanfare in the CC0 set.',
  },

  // ------------------------------------------------ ui
  {
    slot: 'hover', category: 'ui', variants: [
      { src: ken('ui-audio', 'rollover2.ogg'), hp: 300, lp: 7000, trim: true, thr: -36, fi: 0.002, fo: 0.02 },
      { src: ken('ui-audio', 'rollover5.ogg'), hp: 300, lp: 7000, trim: true, thr: -36, fi: 0.002, fo: 0.03 },
    ],
    notes: 'Kenney UI Audio rollover2/rollover5, low-passed 7 kHz, baked in ~-34 dBFS RMS so it is very soft.',
  },
]

// ---------------------------------------------------------------- helpers
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opts })
const ff = (...a) => sh('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...a])
const ffText = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return r.stderr
}
const num = (s) => (s == null ? null : /inf/i.test(s) ? (s.startsWith('-') ? -Infinity : Infinity) : parseFloat(s))
const r3 = (x) => Math.round(x * 1000) / 1000
const r1 = (x) => Math.round(x * 10) / 10
const dur = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
const kb = (f) => statSync(f).size

function stats(f) {
  const t = ffText(['-i', f, '-af', 'astats=measure_perchannel=none:measure_overall=Peak_level+RMS_level', '-f', 'null', '-'])
  const pk = [...t.matchAll(/Peak level dB:\s+(-?[\d.]+|-?inf)/g)].pop()?.[1]
  const rms = [...t.matchAll(/RMS level dB:\s+(-?[\d.]+|-?inf)/g)].pop()?.[1]
  return { peak: num(pk), rms: num(rms) }
}
function loudness(f) {
  const t = ffText(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const sum = t.slice(t.lastIndexOf('Summary:'))
  const I = /\n\s+I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]
  const tp = /Peak:\s+(-?[\d.]+|-?inf) dBFS/.exec(sum)?.[1]
  return { lufs: num(I), truePeak: num(tp) }
}

const hasRubberband = ffText(['-hide_banner', '-filters']).includes(' rubberband ')

function unpack() {
  const zips = {
    tinysized: 'tinysized.zip', accessory: 'accessory.zip', '80-CC0-RPG-SFX_0': '80-CC0-RPG-SFX_0.zip', rpg_sound_pack: 'rpg_sound_pack.zip',
    'interface-sounds': 'kenney_interface-sounds.zip', 'ui-audio': 'kenney_ui-audio.zip', 'rpg-audio': 'kenney_rpg-audio.zip',
    'impact-sounds': 'kenney_impact-sounds.zip', 'music-jingles': 'kenney_music-jingles.zip', 'casino-audio': 'kenney_casino-audio.zip',
  }
  for (const [dir, zip] of Object.entries(zips)) {
    const d = join(EX, dir)
    if (existsSync(d)) continue
    mkdirSync(d, { recursive: true })
    sh('unzip', ['-qo', join(SRC, 'direct', zip), '-d', d])
    console.log('unzipped', zip)
  }
}

function pitchFilter(semi) {
  const ratio = 2 ** (semi / 12)
  if (hasRubberband) return `rubberband=pitch=${ratio.toFixed(6)}`
  // fallback: resample trick (pitch + speed) then tempo to restore duration
  return `asetrate=${Math.round(SR * ratio)},aresample=${SR},atempo=${(1 / ratio).toFixed(6)}`
}

const trimFilter = (thr = -52) =>
  `silenceremove=start_periods=1:start_threshold=${thr}dB:start_silence=0.004:detection=peak,areverse,` +
  `silenceremove=start_periods=1:start_threshold=${thr - 6}dB:start_silence=0.015:detection=peak,areverse`

// ---------------------------------------------------------------- one-shots
function buildOneShot(slot, cat, v, name) {
  const a = join(WORK, `${name}.a.wav`)
  const b = join(WORK, `${name}.b.wav`)
  const inArgs = []
  if (v.ss != null) inArgs.push('-ss', String(v.ss))
  if (v.t != null) inArgs.push('-t', String(v.t))
  if (!existsSync(v.src)) throw new Error(`missing source ${v.src}`)
  const chain = ['aformat=channel_layouts=mono', `aresample=${SR}`, `highpass=f=${v.hp ?? 25}:poles=2`]
  if (v.pitch) chain.push(pitchFilter(v.pitch))
  if (v.lp) chain.push(`lowpass=f=${v.lp}`)
  if (v.trim) chain.push(trimFilter(v.thr))
  ff(...inArgs, '-i', v.src, '-af', chain.join(','), '-c:a', 'pcm_f32le', a)

  const d = dur(a)
  const fi = v.fi ?? 0.005
  const fo = Math.min(v.fo ?? 0.03, d * 0.8)
  const st0 = stats(a)
  const target = v.rms ?? CAT[cat].rms
  const gainDb = Math.min(target - st0.rms, PEAK_CAP - st0.peak)
  const fade = `afade=t=in:d=${fi}:curve=qsin,afade=t=out:st=${(d - fo).toFixed(4)}:d=${fo.toFixed(4)}:curve=hsin`
  ff('-i', a, '-af', `volume=${gainDb.toFixed(3)}dB,${fade}`, '-c:a', 'pcm_f32le', b)
  return { wav: b, note: `${slot}: ${r3(d)}s gain ${r1(gainDb)} dB (src peak ${r1(st0.peak)}, rms ${r1(st0.rms)})` }
}

// ---------------------------------------------------------------- loops
function buildLoop(slot, L, name) {
  const a = join(WORK, `${name}.a.wav`)
  const b = join(WORK, `${name}.b.wav`)
  const { ss, t, xfade: X } = L
  if (!existsSync(L.src)) throw new Error(`missing source ${L.src}`)
  const layout = L.ch === 1 ? 'mono' : 'stereo'
  // head = [0, t-X], tail = [t-X, t]; out = crossfade(tail -> head) + rest of head, length t-X, wraps seamlessly.
  const g = [
    `[0:a]aformat=channel_layouts=${layout},aresample=${SR},highpass=f=${L.hp}:poles=2,asplit[x][y]`,
    `[x]atrim=start=${t - X}:end=${t},asetpts=PTS-STARTPTS[tail]`,
    `[y]atrim=start=0:end=${t - X},asetpts=PTS-STARTPTS[head]`,
    `[tail][head]acrossfade=d=${X}:c1=qsin:c2=qsin`,
  ].join(';')
  ff('-ss', String(ss), '-t', String(t), '-i', L.src, '-filter_complex', g, '-c:a', 'pcm_f32le', a)
  const m = loudness(a)
  const gainDb = L.lufs - m.lufs
  // alimiter has 5 ms look-ahead latency: run it over 3 repetitions and keep the middle period, so the loop stays seamless
  // (the result is the same loop rotated by the latency).
  const len = dur(a)
  ff('-stream_loop', '2', '-i', a, '-af',
    `volume=${gainDb.toFixed(3)}dB,alimiter=limit=0.7079:attack=5:release=60:level=disabled,atrim=start=${len.toFixed(6)}:end=${(2 * len).toFixed(6)},asetpts=PTS-STARTPTS`,
    '-c:a', 'pcm_f32le', b)
  return { wav: b, note: `${slot}: loop ${r3(dur(b))}s gain ${r1(gainDb)} dB (src ${r1(m.lufs)} LUFS)` }
}

// ---------------------------------------------------------------- encode
function encode(wav, outBase, br, ch) {
  const webm = `${outBase}.webm`
  const m4a = `${outBase}.m4a`
  mkdirSync(dirname(outBase), { recursive: true })
  ff('-i', wav, '-ac', String(ch), '-ar', String(SR), '-c:a', 'libopus', '-b:a', `${br}k`, '-vbr', 'on', '-compression_level', '10', '-application', 'audio', webm)
  ff('-i', wav, '-ac', String(ch), '-ar', String(SR), '-c:a', 'aac', '-b:a', `${Math.round(br * 1.5)}k`, '-movflags', '+faststart', m4a)
  return { webm, m4a }
}

function viz(file, name, seamAt) {
  if (!VIZ) return
  mkdirSync(VIZ, { recursive: true })
  const dec = join(WORK, `${name}.viz.wav`)
  ff('-i', file, '-c:a', 'pcm_f32le', dec) // decode once so the doubled loop below has no decoder restart at the seam
  file = dec
  ff('-i', file, '-filter_complex',
    '[0:a]aformat=channel_layouts=mono,asplit[a][b];[a]showspectrumpic=s=1400x360:legend=0:fscale=log:scale=log:color=viridis[s];[b]showwavespic=s=1400x200:colors=white[w];[s][w]vstack',
    '-frames:v', '1', join(VIZ, `${name}.png`))
  if (seamAt != null) {
    // loop played twice; zoom +-0.25 s around the seam, waveform stacked over spectrogram
    const s = join(WORK, `${name}.seam.wav`)
    ff('-stream_loop', '1', '-i', dec, '-ss', String(Math.max(0, seamAt - 0.25)), '-t', '0.5', '-c:a', 'pcm_f32le', s)
    ff('-i', s, '-filter_complex',
      '[0:a]aformat=channel_layouts=mono,asplit[a][b];[a]showspectrumpic=s=1400x240:legend=0:fscale=log:scale=log:color=viridis[s];[b]showwavespic=s=1400x240:colors=white[w];[s][w]vstack',
      '-frames:v', '1', join(VIZ, `${name}.seam.png`))
  }
}

// ---------------------------------------------------------------- main
mkdirSync(WORK, { recursive: true })
unpack()
const manifestPath = join(OUT, 'manifest.json')
const prev = existsSync(manifestPath) && ONLY ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const slots = prev?.slots ?? {}

for (const def of SLOTS) {
  if (ONLY && !ONLY.includes(def.slot)) continue
  const cat = def.category
  console.log(`\n== ${def.slot} (${cat})`)
  const files = []
  const measured = []
  if (def.loop) {
    const L = def.loop
    const name = def.slot
    const built = buildLoop(def.slot, L, name)
    console.log(' ', built.note)
    const base = join(OUT, cat, name)
    const enc = encode(built.wav, base, L.br, L.ch)
    const d = dur(built.wav)
    const m = loudness(enc.webm) // measured on the decoded Opus
    files.push(`${cat}/${name}`)
    measured.push({ duration: r3(d), lufs: r1(m.lufs), truePeakDb: r1(m.truePeak), webmBytes: kb(enc.webm), m4aBytes: kb(enc.m4a) })
    viz(enc.webm, name, d)
    slots[def.slot] = {
      category: cat, bus: CAT[cat].bus, files, loop: true, loopStart: 0, loopEnd: r3(d), duration: r3(d),
      channels: L.ch, gain: def.gain ?? 1, target: `${L.lufs} LUFS integrated, limiter -3 dBFS`, measured, notes: def.notes,
    }
  } else {
    def.variants.forEach((v, i) => {
      const n = def.variants.length > 1 ? `${def.slot}-${i + 1}` : def.slot
      const built = buildOneShot(def.slot, cat, v, n)
      console.log(' ', built.note)
      const enc = encode(built.wav, join(OUT, cat, n), 40, 1)
      const st = stats(enc.webm)
      const m = loudness(enc.webm)
      files.push(`${cat}/${n}`)
      measured.push({
        duration: r3(dur(built.wav)), peakDb: r1(st.peak), truePeakDb: r1(m.truePeak), rmsDb: r1(st.rms),
        lufs: m.lufs != null && m.lufs > -69 ? r1(m.lufs) : null, webmBytes: kb(enc.webm), m4aBytes: kb(enc.m4a),
      })
      viz(enc.webm, n)
    })
    slots[def.slot] = {
      category: cat, bus: CAT[cat].bus, files, loop: false, duration: r3(Math.max(...measured.map((m) => m.duration))),
      channels: 1, gain: def.gain ?? 1, target: `peak <= ${PEAK_CAP} dBFS, ${v0(def)} dBFS RMS`, measured, notes: def.notes,
    }
  }
}
function v0(def) { return def.variants?.[0]?.rms ?? CAT[def.category].rms }

const order = SLOTS.map((s) => s.slot)
const sorted = Object.fromEntries(order.filter((k) => slots[k]).map((k) => [k, slots[k]]))
const manifest = {
  version: 1,
  sampleRate: SR,
  formats: { webm: 'audio/webm; codecs=opus', m4a: 'audio/mp4; codecs=mp4a.40.2' },
  note: 'files are base paths relative to /audio/ without extension: try .webm first, .m4a for Safari. One-shots are mono, loop slots set loop=true with loopStart/loopEnd in seconds (the audio is already crossfaded; loopStart=0, loopEnd=duration). gain is a linear suggestion on top of the bus volume. One-shots are loudness-matched per category and peak-capped at -3 dBFS; loops are at -30 (fire), -32 (wind), -40 (room) LUFS.',
  slots: sorted,
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

let w = 0, m = 0
for (const s of Object.values(sorted)) for (const x of s.measured) { w += x.webmBytes; m += x.m4aBytes }
console.log(`\nmanifest written: ${Object.keys(sorted).length} slots, webm ${(w / 1024).toFixed(0)} KB, m4a ${(m / 1024).toFixed(0)} KB`)
if (!KEEP) rmSync(WORK, { recursive: true, force: true })
