<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMusic } from "../composables/useMusic";
import { useAudio } from "../composables/useAudio";
import { useSettings } from "../composables/useSettings";
import { useFocusTrap } from "../composables/useFocusTrap";

/**
 * The Innkeeper's Music Box: a walnut case with a pinned brass drum, a brass
 * key that picks the tune, an engraved plate and a wax-seal play button.
 * Closing the panel never stops the music; the seal does.
 */
const emit = defineEmits<{
  close: [];
  "return-to-table": [];
}>();

const music = useMusic();
const audio = useAudio();
const settings = useSettings();
const state = music.musicState;

const rootEl = ref<HTMLElement | null>(null);
const crankEl = ref<HTMLElement | null>(null);
const dialEl = ref<HTMLElement | null>(null);
const tabsEl = ref<HTMLElement | null>(null);
useFocusTrap(rootEl, { initialFocus: () => crankEl.value });

onMounted(() => {
  void music.warm();
});

/* ------------------------------------------------------------------ */
/* Selection                                                            */
/* ------------------------------------------------------------------ */
const tracks = computed(() => state.tracks);
const count = computed(() => tracks.value.length);

/** The tune playing, or the one a switch is starting (its tab stays pressed). */
const targetId = computed(() => state.pendingId ?? state.currentId);
const currentIndex = computed(() =>
  Math.max(0, tracks.value.findIndex((t) => t.id === targetId.value)),
);
/** Notch chosen with the key / arrow keys but not yet committed. */
const pendingIndex = ref<number | null>(null);
const selectedIndex = computed(() => pendingIndex.value ?? currentIndex.value);
const selected = computed(() => tracks.value[selectedIndex.value] ?? null);

const reducedMotion = (): boolean =>
  settings.reducedMotion ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let commitTimer: ReturnType<typeof setTimeout> | null = null;

/** Pentatonic pitch ratios for the notch plucks. */
const PLUCK_RATES = [1, 1.122, 1.26, 1.498, 1.682, 1.888, 2];
function pluck(index: number): void {
  void audio.playLayer("pluck", {
    gain: 0.5,
    rate: PLUCK_RATES[index % PLUCK_RATES.length]!,
  });
}

/**
 * The one place the panel asks for a tune: one gesture (tab, crank release,
 * a rested key) = at most one request, and the tune already playing or
 * starting is a no-op. The engine coalesces what is left.
 */
function commit(index: number): void {
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = null;
  const track = tracks.value[index];
  pendingIndex.value = null;
  if (!track) return;
  if (track.id === targetId.value && (state.playing || state.loading)) return;
  void music.playTrack(track.id);
}

/** Keyboard stepping: preview at once, play once the finger rests. */
function step(index: number): void {
  const next = Math.min(count.value - 1, Math.max(0, index));
  if (next === selectedIndex.value) return;
  pendingIndex.value = next;
  pluck(next);
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => commit(next), 260);
}

function pickTab(index: number): void {
  if (tracks.value[index]?.id === targetId.value && (state.playing || state.loading)) {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = null;
    pendingIndex.value = null;
    return;
  }
  pluck(index);
  commit(index);
}

/* ------------------------------------------------------------------ */
/* Transport                                                            */
/* ------------------------------------------------------------------ */
function togglePlay(): void {
  if (!count.value) return;
  if (state.playing || state.loading) {
    // The Ledger's Music Box switch is the single source of "music on".
    settings.musicOn = false;
    music.pause();
    return;
  }
  commit(selectedIndex.value);
}

function shuffle(): void {
  const id = music.shuffle();
  if (id) pluck(tracks.value.findIndex((t) => t.id === id));
}

function onVolumeInput(event: Event): void {
  settings.musicVolume = Number((event.target as HTMLInputElement).value) / 100;
}
const volumePct = computed(() => Math.round(settings.musicVolume * 100));

const busy = computed(() => !count.value || state.loading);
const playingNow = computed(() => state.playing || state.loading);

/* ------------------------------------------------------------------ */
/* The brass key                                                        */
/* ------------------------------------------------------------------ */
/** The key sweeps 300 degrees: first tune at -150, last at +150. */
const SWEEP = 150;

function angleOf(index: number): number {
  if (count.value < 2) return 0;
  return -SWEEP + (index / (count.value - 1)) * SWEEP * 2;
}

function indexOfAngle(angle: number): number {
  if (count.value < 2) return 0;
  return Math.round(((angle + SWEEP) / (SWEEP * 2)) * (count.value - 1));
}

const dragging = ref(false);
const dragAngle = ref(0);
const crankAngle = computed(() =>
  dragging.value ? dragAngle.value : angleOf(selectedIndex.value),
);

function pointerAngle(event: PointerEvent): number {
  const rect = crankEl.value!.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  // 0 deg = straight up, clockwise positive, in (-180, 180]
  const raw = (Math.atan2(dx, -dy) * 180) / Math.PI;
  // the dead zone at the bottom snaps to whichever end is nearer
  return Math.max(-SWEEP, Math.min(SWEEP, raw));
}

function onCrankDown(event: PointerEvent): void {
  if (!count.value || dragging.value) return;
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = null;
  dragging.value = true;
  dialEl.value?.setPointerCapture(event.pointerId);
  crankEl.value?.focus({ preventScroll: true });
  moveKey(event);
}

function moveKey(event: PointerEvent): void {
  const angle = pointerAngle(event);
  dragAngle.value = angle;
  const index = indexOfAngle(angle);
  if (index !== selectedIndex.value) {
    pendingIndex.value = index;
    pluck(index);
  }
}

function onCrankMove(event: PointerEvent): void {
  if (dragging.value) moveKey(event);
}

/** pointerup and pointercancel both land here: only the first commits. */
function onCrankUp(): void {
  if (!dragging.value) return;
  dragging.value = false;
  commit(selectedIndex.value);
}

function onCrankKeydown(event: KeyboardEvent): void {
  let handled = true;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowUp":
      step(selectedIndex.value + 1);
      break;
    case "ArrowLeft":
    case "ArrowDown":
      step(selectedIndex.value - 1);
      break;
    case "Home":
      step(0);
      break;
    case "End":
      step(count.value - 1);
      break;
    case " ":
    case "Enter":
      togglePlay();
      break;
    default:
      handled = false;
  }
  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/* ------------------------------------------------------------------ */
/* Engraved plate: the old line slides out, the new one slides in       */
/* ------------------------------------------------------------------ */
const shownTitle = ref("");
const shownVerse = ref("");
const plate = ref<"" | "out" | "in">("");
let plateTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  selected,
  (track) => {
    const title = track?.title ?? "";
    const verse = track?.verse ?? "";
    if (title === shownTitle.value && verse === shownVerse.value) return;
    if (plateTimer) clearTimeout(plateTimer);
    if (!shownTitle.value || reducedMotion()) {
      shownTitle.value = title;
      shownVerse.value = verse;
      plate.value = "";
      return;
    }
    plate.value = "out";
    plateTimer = setTimeout(() => {
      shownTitle.value = title;
      shownVerse.value = verse;
      plate.value = "in";
      requestAnimationFrame(() => requestAnimationFrame(() => (plate.value = "")));
    }, 180);
  },
  { immediate: true },
);

/* Edge fades hint that the tab row scrolls. */
const fadeLeft = ref(false);
const fadeRight = ref(false);
function updateTabFades(): void {
  const el = tabsEl.value;
  if (!el) return;
  fadeLeft.value = el.scrollLeft > 4;
  fadeRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
}
watch(tracks, () => void nextTick(updateTabFades));
onMounted(() => void nextTick(updateTabFades));

/* Keep the chosen tab in view on the scrolling tab row. */
watch(selectedIndex, () => {
  const el = tabsEl.value?.querySelectorAll<HTMLElement>("button")[selectedIndex.value];
  el?.scrollIntoView?.({
    block: "nearest",
    inline: "nearest",
    behavior: reducedMotion() ? "auto" : "smooth",
  });
});

/* ------------------------------------------------------------------ */
/* Time + announcements                                                 */
/* ------------------------------------------------------------------ */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const onCurrent = computed(() => selected.value?.id === state.currentId);
const position = computed(() => (onCurrent.value ? state.position : 0));
const duration = computed(() =>
  onCurrent.value && state.duration ? state.duration : (selected.value?.duration ?? 0),
);
/** Downloaded share of the playing file, while it is measurable. */
// While loading, currentId still names the previous track: the load is the selected one.
const buffered = computed(() => (state.loading || onCurrent.value ? state.buffered : 0));
/** The brass line shows the download until the stream has started, else the position. */
const downloading = computed(() => state.loading && buffered.value > 0 && buffered.value < 1);
const loadPct = computed(() => Math.round(buffered.value * 100));
const progress = computed(() => {
  if (downloading.value) return buffered.value;
  return duration.value > 0 ? Math.min(1, position.value / duration.value) : 0;
});

const announcement = ref("");
watch(
  () => [state.currentId, state.playing] as const,
  ([id, playing], [prevId, wasPlaying]) => {
    if (!playing || !id) return;
    if (id === prevId && wasPlaying) return;
    const track = tracks.value.find((t) => t.id === id);
    if (track) announcement.value = `Now playing: ${track.title}`;
  },
);

onBeforeUnmount(() => {
  if (commitTimer) clearTimeout(commitTimer);
  if (plateTimer) clearTimeout(plateTimer);
});
</script>

<template>
  <aside
    ref="rootEl"
    class="mbp"
    :class="{ 'mbp-playing': state.playing }"
    role="dialog"
    aria-modal="true"
    aria-label="The Innkeeper's Music Box"
  >
    <header class="mbp-head">
      <div class="min-w-0">
        <h2 class="mbp-title">The Innkeeper's Music Box</h2>
        <p class="mbp-sub">Turn the brass key to choose a tune</p>
      </div>
      <button class="mbp-close" type="button" aria-label="Close the music box" @click="emit('close')">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <!-- leather mood tabs, the book's thumb index -->
    <div
      ref="tabsEl"
      class="mbp-tabs"
      :class="{ 'fade-l': fadeLeft, 'fade-r': fadeRight }"
      role="group"
      aria-label="Tunes"
      @scroll.passive="updateTabFades"
    >
      <button
        v-for="(track, i) in tracks"
        :key="track.id"
        type="button"
        :aria-pressed="i === selectedIndex"
        @click="pickTab(i)"
        @pointerenter="music.warm(track.id)"
        @focus="music.warm(track.id)"
      >
        {{ track.title }}
      </button>
    </div>

    <div class="mbp-case">
      <div class="mbp-well">
        <div class="mbp-drum" aria-hidden="true">
          <div class="mbp-pins" />
          <div class="mbp-comb" />
        </div>

        <!-- the whole ring is grabbable, not just the brass disc -->
        <div
          ref="dialEl"
          class="mbp-dial"
          @pointerdown.prevent="onCrankDown"
          @pointermove="onCrankMove"
          @pointerup="onCrankUp"
          @pointercancel="onCrankUp"
        >
          <!-- one brass stud per tune; the chosen one glows -->
          <span
            v-for="(track, i) in tracks"
            :key="track.id"
            class="mbp-notch"
            :class="{ 'mbp-notch-on': i === selectedIndex }"
            :style="{ '--a': angleOf(i) + 'deg' }"
            aria-hidden="true"
          />
          <div
            ref="crankEl"
            class="mbp-crank"
            :class="{ 'mbp-crank-drag': dragging }"
            :style="{ '--crank': crankAngle + 'deg' }"
            role="slider"
            tabindex="0"
            aria-label="Tune"
            aria-orientation="horizontal"
            :aria-valuemin="0"
            :aria-valuemax="Math.max(0, count - 1)"
            :aria-valuenow="selectedIndex"
            :aria-valuetext="selected?.title ?? 'loading'"
            @keydown="onCrankKeydown"
          >
            <span class="mbp-key" aria-hidden="true" />
            <span class="mbp-cap" aria-hidden="true" />
          </div>
        </div>
      </div>

      <!-- engraved brass plate -->
      <div class="mbp-plate">
        <div class="mbp-plate-line">
          <span class="mbp-plate-title" :class="plate">{{ busy && !shownTitle ? "Loading…" : shownTitle }}</span>
        </div>
        <small class="mbp-verse" :class="plate">{{ shownVerse }}</small>
      </div>

      <!-- elapsed / total with a slim brass line -->
      <div class="mbp-time" :aria-busy="busy">
        <span class="mbp-clock" aria-hidden="true">{{ clock(position) }}</span>
        <div class="mbp-line" :class="{ 'mbp-line-loading': busy && !downloading }" aria-hidden="true">
          <b :style="{ transform: `scaleX(${buffered})` }" />
          <i :style="{ transform: `scaleX(${progress})` }" />
        </div>
        <span class="mbp-clock" aria-hidden="true">
          {{
            state.loading
              ? downloading
                ? `${loadPct}%`
                : "loading…"
              : state.blocked
                ? "tap play"
                : clock(duration)
          }}
        </span>
        <span class="sr-only">
          {{
            state.loading
              ? downloading
                ? `Loading, ${loadPct}% downloaded`
                : "Loading"
              : `${clock(position)} of ${clock(duration)}`
          }}
        </span>
      </div>

      <div class="mbp-row">
        <button
          type="button"
          class="mbp-seal"
          :aria-label="playingNow ? 'Pause' : 'Play'"
          :disabled="!count"
          @click="togglePlay"
        >
          <svg v-if="playingNow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <label class="mbp-vol">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            class="mbp-range"
            :value="volumePct"
            :style="{ '--fill': volumePct + '%' }"
            aria-label="Music volume"
            :aria-valuetext="`${volumePct}%`"
            @input="onVolumeInput"
          />
        </label>
        <button type="button" class="mbp-small" aria-label="Shuffle" :disabled="count < 2" @click="shuffle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </button>
      </div>
    </div>

    <button type="button" class="mbp-table" @click="emit('return-to-table')">
      Return to the Table
    </button>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </aside>
</template>

<style scoped>
.mbp {
  --brass: #c49a45;
  --brass-hi: #e2c172;
  --brass-dark: #7a5a22;
  --parch: #efe4c8;
  --parch-2: #e2d2aa;
  position: fixed;
  z-index: 40;
  top: 3.75rem;
  right: calc(1rem + var(--safe-right));
  width: min(26rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 8.25rem);
  overflow-y: auto;
  padding: 1rem 1rem 0.9rem;
  border-radius: 14px;
  color: var(--parch);
  background: linear-gradient(180deg, rgba(20, 13, 9, 0.84), rgba(13, 10, 8, 0.9));
  border: 1px solid rgba(176, 141, 60, 0.28);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 220, 170, 0.08);
  backdrop-filter: blur(6px);
}

.mbp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}
.mbp-title {
  margin: 0;
  font-family: "Uncial Antiqua", serif;
  font-weight: 400;
  font-size: 1.45rem;
  line-height: 1.15;
  color: var(--parch);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  text-wrap: balance;
}
.mbp-sub {
  margin: 0.25rem 0 0;
  font-style: italic;
  font-size: 0.98rem;
  color: #d7c7a3;
}
.mbp-close {
  display: grid;
  place-items: center;
  flex: none;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  color: #e4d3ae;
  background: rgba(20, 12, 8, 0.55);
  border: 1px solid rgba(196, 154, 69, 0.45);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.mbp-close:hover {
  color: var(--arcane);
  border-color: rgba(71, 189, 173, 0.6);
}

/* leather mood tabs: the same set as the book's thumb index */
.mbp-tabs {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 6px 2px 0;
  margin-bottom: -2px;
}
.mbp-tabs::-webkit-scrollbar {
  display: none;
}
.mbp-tabs.fade-r {
  mask-image: linear-gradient(90deg, #000 calc(100% - 38px), transparent);
}
.mbp-tabs.fade-l {
  mask-image: linear-gradient(90deg, transparent, #000 38px);
}
.mbp-tabs.fade-l.fade-r {
  mask-image: linear-gradient(90deg, transparent, #000 38px, #000 calc(100% - 38px), transparent);
}
.mbp-tabs button {
  flex: 0 0 auto;
  font: 600 12.5px/1 "Cinzel", serif;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #f0e2c4;
  padding: 11px 14px 13px;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(#7a2e1f, #4a1810);
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.35);
  transform: translateY(6px);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.mbp-tabs button:hover {
  transform: translateY(3px);
}
.mbp-tabs button[aria-pressed="true"] {
  transform: translateY(0);
  background: linear-gradient(var(--parch), var(--parch-2));
  color: var(--ink);
  box-shadow: inset 0 0 0 1px rgba(184, 145, 61, 0.7), 0 -2px 6px rgba(0, 0, 0, 0.3);
}

/* the walnut case with its brass inner border */
.mbp-case {
  position: relative;
  padding: 1.25rem 1.3rem 1.3rem;
  border-radius: 12px;
  background:
    linear-gradient(180deg, #6a3a1b, #4a2711 60%, #36190b),
    repeating-linear-gradient(0deg, transparent 0 7px, rgba(0, 0, 0, 0.07) 7px 8px);
  background-blend-mode: multiply;
  box-shadow:
    inset 0 2px 0 rgba(255, 200, 140, 0.18),
    inset 0 -10px 20px rgba(0, 0, 0, 0.5),
    0 14px 30px rgba(0, 0, 0, 0.55);
}
.mbp-case::before {
  content: "";
  position: absolute;
  inset: 7px;
  border: 1px solid rgba(226, 193, 114, 0.35);
  border-radius: 8px;
  pointer-events: none;
}

.mbp-well {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.9rem;
}

/* the pinned brass drum */
.mbp-drum {
  position: relative;
  height: 76px;
  border-radius: 38px;
  overflow: hidden;
  background: linear-gradient(180deg, #4a3613, #e7c779 30%, #fff1c4 45%, #c99a45 60%, #4a3613);
  box-shadow: inset 0 0 0 2px #7a5a22, 0 4px 10px rgba(0, 0, 0, 0.5);
}
.mbp-pins {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #3a2a0e 1.6px, transparent 2px);
  background-size: 22px 14px;
  opacity: 0.75;
}
.mbp-playing .mbp-pins {
  animation: mbp-roll 3s linear infinite;
}
@keyframes mbp-roll {
  to {
    background-position: -220px 0;
  }
}
.mbp-comb {
  position: absolute;
  left: 10%;
  right: 10%;
  top: -2px;
  height: 10px;
  background: repeating-linear-gradient(90deg, #d8d2c4 0 5px, transparent 5px 8px);
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6));
}

/* the brass key / crank */
.mbp-dial {
  position: relative;
  cursor: grab;
  touch-action: none;
  width: 7.75rem;
  height: 7.75rem;
  display: grid;
  place-items: center;
}
.mbp-notch {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #d8b565, #8a6a2a);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  transform: rotate(var(--a)) translateY(-3.6rem);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.mbp-notch-on {
  background: radial-gradient(circle at 35% 30%, #fff1c4, var(--brass-hi));
  box-shadow: 0 0 10px 2px rgba(255, 200, 100, 0.8);
}
.mbp-crank {
  position: relative;
  width: 5.6rem;
  height: 5.6rem;
  border-radius: 50%;
  cursor: grab;
  touch-action: none;
  background: radial-gradient(circle at 40% 35%, #f7dc93, #c49a45 45%, #6f5420 100%);
  box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.45), 0 6px 14px rgba(0, 0, 0, 0.55);
}
.mbp-crank-drag {
  cursor: grabbing;
}
.mbp-crank:focus-visible {
  outline: 2px solid var(--arcane);
  outline-offset: 4px;
  border-radius: 50%;
}
.mbp-key {
  position: absolute;
  left: 50%;
  top: 7px;
  width: 8px;
  height: 2.5rem;
  margin-left: -4px;
  border-radius: 4px;
  background: linear-gradient(90deg, #2a1d08, #4a3613 50%, #2a1d08);
  transform-origin: 50% 2.5rem;
  transform: rotate(var(--crank, 0deg));
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.mbp-key::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -3px;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #5a431a, #2a1d08);
}
.mbp-crank-drag .mbp-key {
  transition: none;
}
.mbp-cap {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f7dc93, #7a5a22);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

/* engraved brass plate */
.mbp-plate {
  margin-top: 1.1rem;
  padding: 0.6rem 1rem 0.65rem;
  text-align: center;
  border-radius: 4px;
  color: #3a2a0e;
  background: linear-gradient(180deg, #f2d48a, #c49a45 50%, #a37c33);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 10px rgba(0, 0, 0, 0.45);
}
.mbp-plate-line {
  position: relative;
  overflow: hidden;
  height: 1.45em;
  font: 700 0.98rem/1.45 "Cinzel", serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
}
.mbp-plate-title,
.mbp-verse {
  display: block;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s;
}
.mbp-plate-title {
  overflow: hidden;
  text-overflow: ellipsis;
}
.mbp-verse {
  margin-top: 2px;
  min-height: 1.3em;
  font: italic 0.95rem/1.3 "EB Garamond", serif;
  letter-spacing: 0;
  text-transform: none;
  color: #4a3613;
}
.out {
  transform: translateY(-110%);
  opacity: 0;
}
.in {
  transform: translateY(110%);
  opacity: 0;
}
.mbp-verse.out,
.mbp-verse.in {
  transform: none;
}

/* elapsed / total with a slim brass line */
.mbp-time {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.85rem;
}
.mbp-clock {
  min-width: 2.4rem;
  font: 600 0.72rem "Cinzel", serif;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: #e4d3ae;
}
.mbp-clock:last-of-type {
  text-align: right;
}
.mbp-line {
  position: relative;
  height: 3px;
  border-radius: 2px;
  overflow: hidden;
  background: rgba(20, 12, 8, 0.65);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}
.mbp-line b {
  position: absolute;
  inset: 0;
  transform-origin: 0 50%;
  background: rgba(226, 193, 114, 0.22);
}
.mbp-line i {
  position: absolute;
  inset: 0;
  transform-origin: 0 50%;
  background: linear-gradient(90deg, var(--brass-dark), var(--brass-hi));
  box-shadow: 0 0 6px rgba(226, 193, 114, 0.6);
}
.mbp-line-loading i {
  transform: none !important;
  width: 30%;
  opacity: 0.8;
  animation: mbp-seek 1.1s ease-in-out infinite alternate;
}
@keyframes mbp-seek {
  from {
    left: 0;
  }
  to {
    left: 70%;
  }
}

/* seal / volume / shuffle */
.mbp-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.9rem;
}
.mbp-seal {
  display: grid;
  place-items: center;
  flex: none;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 50%;
  color: #f7e8d2;
  background: radial-gradient(circle at 32% 28%, #c85040, #8b2320 52%, #5a1210);
  border: 1px solid #380806;
  box-shadow:
    inset 0 2px 6px rgba(255, 200, 160, 0.35),
    inset 0 -5px 12px rgba(0, 0, 0, 0.45),
    0 6px 18px rgba(0, 0, 0, 0.55);
  transition: filter 0.15s ease, scale 0.15s ease;
}
.mbp-seal:hover:not(:disabled) {
  filter: brightness(1.12);
}
.mbp-seal:active:not(:disabled) {
  scale: 0.96;
}
.mbp-seal:disabled,
.mbp-small:disabled {
  opacity: 0.5;
  cursor: default;
}
.mbp-seal svg {
  width: 22px;
  height: 22px;
}
.mbp-vol {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font: 600 0.72rem "Cinzel", serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f0dcae;
}
.mbp-range {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 5px;
  border: 1px solid rgba(20, 8, 4, 0.7);
  background:
    linear-gradient(180deg, #e2c172, #b8913d) 0 0 / var(--fill, 60%) 100% no-repeat,
    linear-gradient(180deg, #2a1708, #3d2210);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}
.mbp-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(20, 8, 4, 0.8);
  background: radial-gradient(circle at 32% 30%, #f7dc93, #c49a45 55%, #7a5a22);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.mbp-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(20, 8, 4, 0.8);
  background: radial-gradient(circle at 32% 30%, #f7dc93, #c49a45 55%, #7a5a22);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.mbp-small {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  color: #e4d3ae;
  background: rgba(20, 12, 8, 0.55);
  border: 1px solid rgba(196, 154, 69, 0.45);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.mbp-small:hover:not(:disabled) {
  color: var(--arcane);
  border-color: rgba(71, 189, 173, 0.6);
}
.mbp-small svg {
  width: 18px;
  height: 18px;
}

.mbp-table {
  display: block;
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.35rem;
  font: 600 0.72rem "Cinzel", serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  color: rgba(232, 220, 192, 0.7);
  transition: color 0.2s ease;
}
.mbp-table:hover {
  color: var(--arcane);
}

.mbp-close:focus-visible,
.mbp-seal:focus-visible,
.mbp-small:focus-visible,
.mbp-tabs button:focus-visible,
.mbp-range:focus-visible,
.mbp-table:focus-visible {
  outline: 2px solid var(--arcane);
  outline-offset: 2px;
}

/* enter / leave (the <Transition> lives in App.vue) */
.music-panel-enter-active {
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.4s ease;
}
.music-panel-leave-active {
  transition: transform 0.28s ease, opacity 0.25s ease;
}
.music-panel-enter-from,
.music-panel-leave-to {
  transform: translateX(110%);
  opacity: 0;
}

/* phones: a bottom sheet over the lower ~45% of the screen */
@media (max-width: 640px) {
  .mbp {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 47dvh;
    padding: 0.7rem calc(0.8rem + var(--safe-right)) calc(0.6rem + var(--safe-bottom))
      calc(0.8rem + var(--safe-left));
    border-radius: 16px 16px 0 0;
    border-bottom: none;
  }
  .mbp-head {
    margin-bottom: 0.35rem;
  }
  .mbp-title {
    font-size: 1.15rem;
  }
  .mbp-sub {
    display: none;
  }
  .mbp-tabs button {
    padding: 9px 11px 11px;
    font-size: 11.5px;
  }
  .mbp-case {
    padding: 0.8rem 0.9rem 0.85rem;
  }
  .mbp-drum {
    height: 60px;
    border-radius: 30px;
  }
  .mbp-dial {
    width: 6rem;
    height: 6rem;
  }
  .mbp-crank {
    width: 4.2rem;
    height: 4.2rem;
  }
  .mbp-key {
    top: 5px;
    height: 1.9rem;
    transform-origin: 50% 1.9rem;
  }
  .mbp-notch {
    transform: rotate(var(--a)) translateY(-2.8rem);
  }
  .mbp-plate {
    margin-top: 0.6rem;
    padding: 0.4rem 0.8rem 0.45rem;
  }
  .mbp-plate-line {
    font-size: 0.88rem;
  }
  .mbp-verse {
    font-size: 0.88rem;
  }
  .mbp-time {
    margin-top: 0.55rem;
  }
  .mbp-row {
    margin-top: 0.6rem;
    gap: 0.7rem;
  }
  .mbp-seal {
    width: 3rem;
    height: 3rem;
  }
  .mbp-small {
    width: 2.75rem;
    height: 2.75rem;
  }
  .mbp-table {
    display: none;
  }
  .music-panel-enter-from,
  .music-panel-leave-to {
    transform: translateY(105%);
  }
}

@media (pointer: coarse) {
  .mbp-close {
    width: 2.75rem;
    height: 2.75rem;
  }
}
</style>
