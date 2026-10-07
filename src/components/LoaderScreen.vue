<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { loadingLines } from "../data/content";

const props = defineProps<{
  /** 0..1 */
  progress: number;
  /** Scene rendered its first frame. */
  ready: boolean;
  /** Set while App fades this screen out. */
  leaving: boolean;
}>();

const emit = defineEmits<{ enter: [] }>();

const VISITED_KEY = "smokeriv-visited";
const visitedBefore = ((): boolean => {
  try {
    return localStorage.getItem(VISITED_KEY) === "1";
  } catch {
    return false;
  }
})();

/* Rune ring geometry */
const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;
const dashOffset = computed(
  () => CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, props.progress))),
);
const percent = computed(() => Math.round(props.progress * 100));

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ".split("");

/* Cycling flavor lines */
const lineIndex = ref(Math.floor(Math.random() * loadingLines.length));
let lineTimer: ReturnType<typeof setInterval> | null = null;

/* Entering: first-time visitors get a wax-seal "Enter the Inn" button once
   the scene is ready (the click is the audio user gesture). Returning
   visitors step in on their own after a beat, with a visible "skip" while
   the table is still being laid. */
const sealBtn = ref<HTMLButtonElement | null>(null);
const entered = ref(false);
const skipRequested = ref(false);
let enterTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.ready,
  (ready) => {
    if (!ready) return;
    if (visitedBefore) {
      enterTimer = setTimeout(onEnter, skipRequested.value ? 0 : 250);
    } else {
      void nextTick(() => sealBtn.value?.focus({ preventScroll: true }));
    }
  },
  { immediate: true },
);

function onSkip(): void {
  skipRequested.value = true;
  if (props.ready) onEnter();
}

function onEnter(): void {
  if (entered.value) return;
  entered.value = true;
  try {
    localStorage.setItem(VISITED_KEY, "1");
  } catch {
    /* private mode */
  }
  emit("enter");
}

onMounted(() => {
  lineTimer = setInterval(() => {
    lineIndex.value = (lineIndex.value + 1) % loadingLines.length;
  }, 1600);
});

onUnmounted(() => {
  if (lineTimer) clearInterval(lineTimer);
  if (enterTimer) clearTimeout(enterTimer);
});
</script>

<template>
  <div
    class="fixed inset-0 z-70 flex flex-col items-center justify-center gap-8 bg-night transition-opacity duration-700"
    :class="leaving ? 'pointer-events-none opacity-0' : 'opacity-100'"
  >
    <!-- warm vignette + faint candle glow -->
    <div
      class="pointer-events-none absolute inset-0 flicker"
      style="
        background:
          radial-gradient(ellipse 60% 45% at 50% 62%, rgba(255, 158, 60, 0.07), transparent 70%),
          radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.7) 100%);
      "
    />

    <!-- Rune circle -->
    <div
      class="relative h-56 w-56 select-none"
      role="progressbar"
      aria-label="Preparing the tavern"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="`${percent} percent`"
    >
      <svg viewBox="0 0 200 200" class="h-full w-full" aria-hidden="true">
        <!-- static faint ring -->
        <circle
          cx="100" cy="100" :r="R"
          fill="none" stroke="#2c221a" stroke-width="2"
        />
        <!-- progress ring: draws itself -->
        <circle
          cx="100" cy="100" :r="R"
          fill="none"
          stroke="#47bdad" stroke-width="2.5" stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 100 100)"
          style="transition: stroke-dashoffset 0.35s ease; filter: drop-shadow(0 0 6px rgba(71, 189, 173, 0.55))"
        />
        <!-- inner decorative ring -->
        <circle
          cx="100" cy="100" r="66"
          fill="none" stroke="#b08d3c" stroke-width="0.75" opacity="0.5"
        />
        <circle
          cx="100" cy="100" r="62"
          fill="none" stroke="#b08d3c" stroke-width="0.5" opacity="0.3"
        />
        <!-- rotating runes -->
        <g
          class="origin-center"
          style="animation: slowSpin 40s linear infinite; transform-origin: 100px 100px"
        >
          <text
            v-for="(rune, i) in RUNES"
            :key="i"
            x="100" y="26"
            text-anchor="middle"
            font-size="9"
            fill="#b08d3c"
            :opacity="progress > i / RUNES.length ? 0.9 : 0.25"
            :transform="`rotate(${(i * 360) / RUNES.length} 100 100)`"
            style="transition: opacity 0.4s ease"
          >{{ rune }}</text>
        </g>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="font-heading text-2xl tracking-widest text-parchment/90">
          {{ percent }}<span class="text-sm text-gold">%</span>
        </span>
      </div>
    </div>

    <!-- Flavor line -->
    <p
      class="relative h-6 font-body text-lg italic text-parchment/70"
      aria-hidden="true"
    >
      {{ loadingLines[lineIndex] }}
    </p>

    <!-- Status line / seal -->
    <div class="relative flex h-36 flex-col items-center justify-start gap-3">
      <button
        v-if="ready && !visitedBefore"
        ref="sealBtn"
        type="button"
        class="btn-wax seal fade-up"
        :disabled="leaving"
        @click="onEnter"
      >
        <span class="seal-rim" aria-hidden="true" />
        <span class="relative leading-tight">Enter<br />the Inn</span>
      </button>
      <span
        v-else
        role="status"
        class="pt-4 font-heading text-xs uppercase tracking-[0.3em] text-parchment/70"
        :class="{ 'fade-up': ready }"
      >
        {{ ready ? "the door swings open…" : "the innkeeper is preparing your table" }}
      </span>
      <button
        v-if="visitedBefore && !ready && !skipRequested"
        type="button"
        class="skip-btn"
        @click="onSkip"
      >
        Skip
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Wax seal pressed into the door: the first-visit call to action. */
.seal {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 7.5rem;
  height: 7.5rem;
  padding: 0;
  font-size: 0.9rem;
  line-height: 1.25;
  text-align: center;
  text-shadow: 0 1px 0 rgba(56, 8, 6, 0.8);
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
}
.seal-rim {
  position: absolute;
  inset: 0.45rem;
  border-radius: 9999px;
  border: 1px dashed rgba(247, 232, 210, 0.45);
  pointer-events: none;
}
.seal:active {
  transform: scale(0.96);
}
.seal:focus-visible {
  outline: 2px solid var(--arcane);
  outline-offset: 4px;
  border-radius: 9999px;
}
.skip-btn {
  min-height: 2.75rem;
  min-width: 2.75rem;
  padding: 0 1rem;
  font-family: "Cinzel", serif;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(232, 220, 192, 0.7);
  border-radius: 9999px;
  transition: color 0.2s ease;
}
.skip-btn:hover {
  color: var(--arcane);
}
</style>
