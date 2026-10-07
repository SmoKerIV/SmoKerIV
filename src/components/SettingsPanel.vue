<script setup lang="ts">
import { computed, ref } from "vue";
import type { Quality, TimeOfDay } from "../three/types";
import { useSettings } from "../composables/useSettings";
import { useFocusTrap } from "../composables/useFocusTrap";

const emit = defineEmits<{
  close: [];
  "return-to-table": [];
}>();

const settings = useSettings();

const rootEl = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
useFocusTrap(rootEl, { initialFocus: () => closeBtn.value });

/**
 * Roving radio group: arrows move the selection (and focus) between
 * options, wrapping at the ends; only the checked radio is in the tab order.
 */
function onRadioKeydown<T>(
  event: KeyboardEvent,
  options: { value: T }[],
  current: T,
  select: (value: T) => void,
): void {
  const delta =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (!delta) return;
  event.preventDefault();
  const index = options.findIndex((o) => o.value === current);
  const next = (index + delta + options.length) % options.length;
  select(options[next]!.value);
  const radios = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
    '[role="radio"]',
  );
  radios?.[next]?.focus();
}

const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: "low", label: "Tallow" },
  { value: "medium", label: "Beeswax" },
  { value: "high", label: "Arcane" },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string; hint: string }[] = [
  { value: "auto", label: "By your clock", hint: "auto" },
  { value: "day", label: "Morning light", hint: "day" },
  { value: "night", label: "Candlelight", hint: "night" },
];

const volumePercent = computed(() => Math.round(settings.musicVolume * 100));

function onVolumeInput(event: Event): void {
  settings.musicVolume = Number((event.target as HTMLInputElement).value) / 100;
}

const flatUrl = ((): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("flat", "1");
  url.hash = "";
  return url.toString();
})();
</script>

<template>
  <aside
    ref="rootEl"
    aria-modal="true"
    class="parchment fixed bottom-0 right-0 top-0 z-50 flex w-[min(22rem,92vw)] flex-col overflow-y-auto shadow-tome"
    role="dialog"
    aria-label="The Innkeeper's Ledger — settings"
    style="border-left: 6px solid var(--leather-dark); box-shadow: -12px 0 40px rgba(0, 0, 0, 0.6)"
  >
    <!-- header -->
    <header class="flex items-center justify-between border-b border-gold/40 px-5 py-4">
      <div>
        <h2 class="m-0 font-heading text-base font-semibold tracking-wide text-ink">
          The Innkeeper's Ledger
        </h2>
        <p class="m-0 font-body text-xs italic text-ink-faint">
          adjustments &amp; accommodations
        </p>
      </div>
      <button
        ref="closeBtn"
        class="flex h-8 w-8 items-center justify-center rounded-full border border-leather/40 text-ink-soft transition hover:bg-leather/10"
        aria-label="Close the ledger"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <div class="flex flex-1 flex-col gap-6 px-5 py-5">
      <!-- Music -->
      <section>
        <div class="ledger-row">
          <span class="ledger-label">The Bard's Tune</span>
          <button
            class="toggle"
            :class="{ 'toggle-on': settings.musicOn }"
            role="switch"
            :aria-checked="settings.musicOn"
            aria-label="Toggle music"
            @click="settings.musicOn = !settings.musicOn"
          >
            <span class="toggle-knob" />
          </button>
        </div>
        <div class="mt-3 flex items-center gap-3" :class="{ 'opacity-40': !settings.musicOn }">
          <!-- lute -->
          <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-leather" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
            <circle cx="8" cy="16" r="5" />
            <path d="M11.5 12.5 20 4M18 3l3 3" />
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            :value="volumePercent"
            class="ale-meter flex-1"
            :style="{ '--fill': volumePercent + '%' }"
            :disabled="!settings.musicOn"
            aria-label="Music volume"
            @input="onVolumeInput"
          />
          <span class="w-9 text-right font-heading text-xs text-ink-soft">{{ volumePercent }}%</span>
        </div>
      </section>

      <!-- SFX -->
      <section class="ledger-row">
        <span class="ledger-label">Tavern Sounds <em class="ml-1 font-body text-xs not-italic text-ink-faint">(page flips &amp; thumps)</em></span>
        <button
          class="toggle"
          :class="{ 'toggle-on': settings.sfxOn }"
          role="switch"
          :aria-checked="settings.sfxOn"
          aria-label="Toggle sound effects"
          @click="settings.sfxOn = !settings.sfxOn"
        >
          <span class="toggle-knob" />
        </button>
      </section>

      <!-- Quality -->
      <section>
        <span class="ledger-label">Candlelight Quality</span>
        <div class="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Render quality">
          <button
            v-for="opt in QUALITY_OPTIONS"
            :key="opt.value"
            class="quality-opt"
            :class="{ 'quality-active': settings.quality === opt.value }"
            role="radio"
            :aria-checked="settings.quality === opt.value"
            :tabindex="settings.quality === opt.value ? 0 : -1"
            @click="settings.quality = opt.value"
            @keydown="onRadioKeydown($event, QUALITY_OPTIONS, settings.quality, (v) => (settings.quality = v))"
          >
            <span class="block font-heading text-xs uppercase tracking-wider">{{ opt.label }}</span>
            <span class="block font-body text-xs italic text-ink-faint">{{ opt.value }}</span>
          </button>
        </div>
      </section>

      <!-- Time of day -->
      <section>
        <span class="ledger-label">Hour of the Inn</span>
        <div class="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time of day">
          <button
            v-for="opt in TIME_OPTIONS"
            :key="opt.value"
            class="quality-opt"
            :class="{ 'quality-active': settings.timeOfDay === opt.value }"
            role="radio"
            :aria-checked="settings.timeOfDay === opt.value"
            :tabindex="settings.timeOfDay === opt.value ? 0 : -1"
            @click="settings.timeOfDay = opt.value"
            @keydown="onRadioKeydown($event, TIME_OPTIONS, settings.timeOfDay, (v) => (settings.timeOfDay = v))"
          >
            <span class="block font-heading text-xs uppercase tracking-wider">{{ opt.label }}</span>
            <span class="block font-body text-xs italic text-ink-faint">{{ opt.hint }}</span>
          </button>
        </div>
      </section>

      <!-- Reduce motion -->
      <section class="ledger-row">
        <span class="ledger-label">Calm the Magics <em class="ml-1 font-body text-xs not-italic text-ink-faint">(reduce motion)</em></span>
        <button
          class="toggle"
          :class="{ 'toggle-on': settings.reducedMotion }"
          role="switch"
          :aria-checked="settings.reducedMotion"
          aria-label="Toggle reduced motion"
          @click="settings.reducedMotion = !settings.reducedMotion"
        >
          <span class="toggle-knob" />
        </button>
      </section>
    </div>

    <!-- footer -->
    <footer class="border-t border-gold/40 px-5 py-4">
      <button class="btn-leather w-full rounded px-4 py-2.5 text-xs" @click="emit('return-to-table')">
        Return to the Table
      </button>
      <a
        :href="flatUrl"
        class="mt-3 block text-center font-body text-xs italic text-ink-faint underline decoration-dotted underline-offset-4 transition hover:text-arcane-dim"
      >
        Prefer a plain page? Read the tome as parchment.
      </a>
    </footer>
  </aside>
</template>

<style scoped>
.ledger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ledger-label {
  font-family: "Cinzel", serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--ink);
}

/* Leather toggle with brass knob */
.toggle {
  position: relative;
  width: 3rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(20, 8, 4, 0.7);
  background: linear-gradient(180deg, var(--leather-dark), var(--leather));
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.55);
  transition: background 0.25s ease;
}
.toggle-on {
  background: linear-gradient(180deg, var(--arcane-dim), #17635a);
}
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(1.5rem - 6px);
  height: calc(1.5rem - 6px);
  border-radius: 999px;
  background: radial-gradient(circle at 32% 30%, var(--gold-bright), var(--gold) 60%, #7d6228);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.toggle-on .toggle-knob {
  transform: translateX(1.5rem);
}

/* Ale-meter volume slider */
.ale-meter {
  -webkit-appearance: none;
  appearance: none;
  height: 10px;
  border-radius: 6px;
  border: 1px solid rgba(58, 29, 17, 0.6);
  background:
    linear-gradient(180deg, #caa64e, #a87f2f) 0 0 / var(--fill, 60%) 100% no-repeat,
    linear-gradient(180deg, #cbb894, #b9a276);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.ale-meter::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(20, 8, 4, 0.8);
  background: radial-gradient(circle at 32% 30%, var(--leather-light), var(--leather) 60%, var(--leather-dark));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.ale-meter::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(20, 8, 4, 0.8);
  background: radial-gradient(circle at 32% 30%, var(--leather-light), var(--leather) 60%, var(--leather-dark));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.ale-meter:disabled {
  cursor: default;
}

/* Parchment radio row */
.quality-opt {
  padding: 0.5rem 0.25rem;
  text-align: center;
  border: 1px solid rgba(90, 46, 29, 0.35);
  border-radius: 0.25rem;
  color: var(--ink-soft);
  background: rgba(255, 250, 235, 0.25);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}
.quality-opt:hover {
  border-color: rgba(90, 46, 29, 0.7);
}
.quality-active {
  border-color: var(--arcane-dim);
  background: rgba(71, 189, 173, 0.12);
  box-shadow: inset 0 0 0 1px var(--arcane-dim);
  color: var(--ink);
}
</style>
