#!/usr/bin/env node
/**
 * prepare-music.mjs — songs in ~/Downloads/music -> public/audio/music (Opus/WebM + AAC/M4A) + music/manifest.json
 *
 * Usage:  pnpm audio:music [--only id1,id2] [--once id1,id2] [--xfade 4] [--src <dir>] [--keep-work]
 *   --only    rebuild only these track ids (the rest of the manifest is kept as is)
 *   --once    these ids don't loop (fade out at the end; the player moves to the next track)
 *   --xfade   loop crossfade in seconds (default 4, never more than 10 % of the song)
 *   --src     source folder (default MUSIC_SRC or ~/Downloads/music)
 * Needs: node >= 18, ffmpeg + ffprobe with libopus and aac.
 *
 * Every audio file in the source folder becomes one track. id = slug of the file name ("Baldur's Gate 3.mp3" ->
 * "baldurs-gate-3"); a file named after a placeholder ("The Witcher", "Skyrim", "Minecraft", "Baldur's Gate 3",
 * "Dragon Age") takes that placeholder's id and replaces it in the player. title comes from the file name.
 *
 * Processing
 *   decode -> stereo 48 kHz -> trim leading/trailing silence (-50 dB peak)
 *   loop:  equal-power (qsin) crossfade of the tail into the head -> wraps seamlessly (like the ambience loops)
 *   once:  5 ms fade-in, 1.5 s fade-out
 *   -> integrated-loudness gain to -18 LUFS -> limiter at -2 dBFS sample peak (~ -1.5 dBTP after encoding;
 *      loops run it over three repetitions and keep the middle one so the seam stays seamless)
 *   encode: libopus 96 kbps stereo in WebM, AAC 160 kbps in M4A
 *
 * Manifest: new tracks get defaults (mood, verse, tint from the matching placeholder, else neutral ones);
 * for ids already in the manifest the editable fields (title, mood, verse, tint, gain, ambience, loop) are kept,
 * only files/duration/measured are refreshed. Entries whose source file is gone are left untouched.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../public/audio/music')
const WORK = join(tmpdir(), 'smoker-music-work')
const SR = 48000
const LUFS = -18
const LIMIT_DB = -2
const OPUS_KBPS = 96
const AAC_KBPS = 160
const EXTS = new Set(['.wav', '.flac', '.mp3', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.aif', '.aiff', '.webm'])

const argv = process.argv.slice(2)
const argVal = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null }
const ONLY = argVal('--only')?.split(',') ?? null
const ONCE = new Set(argVal('--once')?.split(',') ?? [])
const XFADE = Number(argVal('--xfade') ?? 4)
const SRC = resolve(argVal('--src') ?? process.env.MUSIC_SRC ?? join(homedir(), 'Downloads/music'))
const KEEP = argv.includes('--keep-work')

/** Placeholder ids (src/composables/useMusic.ts) and their defaults. */
const PLACEHOLDERS = {
  witcher: { names: ['the-witcher', 'witcher'], mood: 'witcher', verse: 'Wind off the Skellige cliffs, a fiddle by the fire', tint: '#4f7a8c', ambience: 0.6 },
  skyrim: { names: ['skyrim'], mood: 'skyrim', verse: 'Snow on the eaves, a hearth in Whiterun', tint: '#8fa7b8', ambience: 0.55 },
  minecraft: { names: ['minecraft'], mood: 'minecraft', verse: 'Soft piano at dusk; the blocks can wait', tint: '#6fa86a', ambience: 0.7 },
  'baldurs-gate-3': { names: ['baldurs-gate-3', 'baldurs-gate-iii', 'bg3'], mood: 'baldurs-gate-3', verse: 'Dice on the table, a party far from home', tint: '#c08a3e', ambience: 0.6 },
  'dragon-age': { names: ['dragon-age'], mood: 'dragon-age', verse: 'A tavern bard, a lute, the Inquisition marching on', tint: '#9b3b2f', ambience: 0.6 },
}
const NEUTRAL = { mood: 'minecraft', verse: '', tint: '#c8a050', ambience: 0.6 }

// ---------------------------------------------------------------- helpers
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })
const ff = (...a) => sh('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...a])
const ffText = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr
const num = (s) => (s == null ? null : /inf/i.test(s) ? (s.startsWith('-') ? -Infinity : Infinity) : parseFloat(s))
const r1 = (x) => Math.round(x * 10) / 10
const r3 = (x) => Math.round(x * 1000) / 1000
const dur = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

function loudness(f) {
  const t = ffText(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const sum = t.slice(t.lastIndexOf('Summary:'))
  return {
    lufs: num(/\n\s+I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]),
    truePeak: num(/Peak:\s+(-?[\d.]+|-?inf) dBFS/.exec(sum)?.[1]),
  }
}

const stem = (file) => file.slice(0, file.length - extname(file).length)
const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
/** "03 - baldur's_gate-3" -> "Baldur's Gate 3" */
function titleOf(file) {
  const words = stem(file).replace(/^\s*\d{1,3}\s*[-_.)]\s*/, '').replace(/[_-]+/g, ' ').trim().split(/\s+/)
  return words.map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}
function idOf(file) {
  const s = slug(titleOf(file))
  for (const [id, p] of Object.entries(PLACEHOLDERS)) if (p.names.includes(s)) return id
  return s
}

// ---------------------------------------------------------------- build
function build(src, id, loop) {
  const a = join(WORK, `${id}.a.wav`)
  const b = join(WORK, `${id}.b.wav`)
  const c = join(WORK, `${id}.c.wav`)
  const trim =
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05:detection=peak,areverse,' +
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05:detection=peak,areverse'
  ff('-i', src, '-af', `aformat=channel_layouts=stereo,aresample=${SR},highpass=f=20:poles=2,${trim}`, '-c:a', 'pcm_f32le', a)
  const t = dur(a)
  if (!(t > 2)) throw new Error(`${src}: under 2 s after silence trim`)

  let X = 0
  if (loop) {
    X = Math.min(XFADE, t * 0.1)
    // head = [0, t-X], tail = [t-X, t]; out = crossfade(tail -> head) + rest of head (length t-X), wraps seamlessly
    const g = [
      '[0:a]asplit[x][y]',
      `[x]atrim=start=${(t - X).toFixed(6)}:end=${t.toFixed(6)},asetpts=PTS-STARTPTS[tail]`,
      `[y]atrim=start=0:end=${(t - X).toFixed(6)},asetpts=PTS-STARTPTS[head]`,
      `[tail][head]acrossfade=d=${X.toFixed(6)}:c1=qsin:c2=qsin`,
    ].join(';')
    ff('-i', a, '-filter_complex', g, '-c:a', 'pcm_f32le', b)
  } else {
    ff('-i', a, '-af', `afade=t=in:d=0.005,afade=t=out:st=${Math.max(0, t - 1.5).toFixed(4)}:d=1.5:curve=hsin`, '-c:a', 'pcm_f32le', b)
  }

  const m = loudness(b)
  const gainDb = LUFS - m.lufs
  const limit = Math.pow(10, LIMIT_DB / 20).toFixed(4)
  const len = dur(b)
  if (loop) {
    // alimiter has look-ahead latency: limit three repetitions and keep the middle one (same loop, rotated)
    ff('-stream_loop', '2', '-i', b, '-af',
      `volume=${gainDb.toFixed(3)}dB,alimiter=limit=${limit}:attack=5:release=80:level=disabled,` +
      `atrim=start=${len.toFixed(6)}:end=${(2 * len).toFixed(6)},asetpts=PTS-STARTPTS`,
      '-c:a', 'pcm_f32le', c)
  } else {
    ff('-i', b, '-af', `volume=${gainDb.toFixed(3)}dB,alimiter=limit=${limit}:attack=5:release=80:level=disabled`, '-c:a', 'pcm_f32le', c)
  }
  return { wav: c, srcSeconds: t, xfade: X, gainDb, srcLufs: m.lufs }
}

function encode(wav, base) {
  const webm = `${base}.webm`
  const m4a = `${base}.m4a`
  ff('-i', wav, '-ac', '2', '-ar', String(SR), '-c:a', 'libopus', '-b:a', `${OPUS_KBPS}k`, '-vbr', 'on', '-compression_level', '10', '-application', 'audio', webm)
  ff('-i', wav, '-ac', '2', '-ar', String(SR), '-c:a', 'aac', '-b:a', `${AAC_KBPS}k`, '-movflags', '+faststart', m4a)
  return { webm, m4a }
}

// ---------------------------------------------------------------- main
if (!existsSync(SRC)) {
  console.error(`no source folder: ${SRC}\nPut songs (wav/flac/mp3/ogg/m4a/opus) in it, or pass --src <dir>.`)
  process.exit(1)
}
const files = readdirSync(SRC).filter((f) => EXTS.has(extname(f).toLowerCase())).sort()
if (!files.length) {
  console.error(`no audio files in ${SRC}`)
  process.exit(1)
}
mkdirSync(WORK, { recursive: true })
mkdirSync(OUT, { recursive: true })
const manifestPath = join(OUT, 'manifest.json')
const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { tracks: [] }
const tracks = Array.isArray(prev.tracks) ? prev.tracks : []
const seen = new Set()

for (const file of files) {
  const id = idOf(file)
  if (!id) { console.warn(`skip ${file}: no usable name`); continue }
  if (seen.has(id)) { console.warn(`skip ${file}: id "${id}" already taken by another file`); continue }
  seen.add(id)
  if (ONLY && !ONLY.includes(id)) continue
  const old = tracks.find((t) => t.id === id)
  const loop = !ONCE.has(id) && old?.loop !== false
  console.log(`\n== ${id}  <- ${file}${loop ? '' : '  (no loop)'}`)
  const built = build(join(SRC, file), id, loop)
  const enc = encode(built.wav, join(OUT, id))
  const d = dur(built.wav)
  const m = loudness(enc.webm) // measured on the decoded Opus
  const measured = {
    lufs: r1(m.lufs), truePeakDb: r1(m.truePeak),
    webmBytes: statSync(enc.webm).size, m4aBytes: statSync(enc.m4a).size,
  }
  console.log(`  ${r1(built.srcSeconds)} s after trim${loop ? `, ${r1(built.xfade)} s loop crossfade -> ${r1(d)} s loop` : ''}; gain ${r1(built.gainDb)} dB (src ${r1(built.srcLufs)} LUFS)`)
  console.log(`  webm: ${measured.lufs} LUFS, true peak ${measured.truePeakDb} dBTP, ${(measured.webmBytes / 1024).toFixed(0)} KB; m4a ${(measured.m4aBytes / 1024).toFixed(0)} KB`)
  if (m.truePeak > -1.5) console.warn(`  warning: true peak ${r1(m.truePeak)} dBTP is above -1.5 dBTP`)

  const defaults = PLACEHOLDERS[id] ?? NEUTRAL
  const entry = {
    id,
    title: old?.title ?? titleOf(file),
    mood: old?.mood ?? defaults.mood,
    verse: old?.verse ?? defaults.verse,
    files: `music/${id}`,
    duration: r3(d),
    loop,
    gain: old?.gain ?? 1,
    tint: old?.tint ?? defaults.tint,
    ambience: old?.ambience ?? defaults.ambience,
    source: file,
    measured,
  }
  if (old) tracks[tracks.indexOf(old)] = entry
  else tracks.push(entry)
}

const manifest = {
  version: 1,
  note: 'Built by scripts/prepare-music.mjs; schema in docs/sounds.md ("Music box tracks"). title, mood, verse, tint, gain, ambience and loop are yours to edit and survive a rebuild.',
  target: `${LUFS} LUFS integrated, limiter ${LIMIT_DB} dBFS (~ -1.5 dBTP), Opus ${OPUS_KBPS} kbps / AAC ${AAC_KBPS} kbps stereo ${SR} Hz`,
  tracks,
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`\nmanifest written: ${tracks.length} track(s) -> ${manifestPath}`)
if (!KEEP) rmSync(WORK, { recursive: true, force: true })
