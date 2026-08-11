<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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

/* Auto-enter: the inn opens itself once the scene is ready — returning
   visitors step straight in, first-timers get a beat so the rune ring
   finishes drawing. (Audio unlocks on the first click/keypress instead.) */
let enterTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.ready,
  (ready) => {
    if (!ready) return;
    enterTimer = setTimeout(onEnter, visitedBefore ? 250 : 900);
  },
  { immediate: true },
);

function onEnter(): void {
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
    aria-live="polite"
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
    <div class="relative h-56 w-56 select-none">
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
          stroke="#35d0ba" stroke-width="2.5" stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 100 100)"
          style="transition: stroke-dashoffset 0.35s ease; filter: drop-shadow(0 0 6px rgba(53, 208, 186, 0.55))"
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

    <!-- Status line (the inn opens itself once the table is ready) -->
    <div class="relative flex h-16 items-center justify-center">
      <span
        class="font-heading text-xs uppercase tracking-[0.3em] text-parchment/30"
        :class="{ 'fade-up': ready }"
      >
        {{ ready ? "the door swings open…" : "the innkeeper is preparing your table" }}
      </span>
    </div>
  </div>
</template>
