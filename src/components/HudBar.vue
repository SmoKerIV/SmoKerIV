<script setup lang="ts">
import { identity, contact } from "../data/content";
import { track } from "../composables/useAnalytics";

defineProps<{
  ambienceOn: boolean;
  bookOpen: boolean;
  /** Set only when /baker-cv.pdf actually exists. */
  cvUrl?: string | null;
  /** The music box is playing: its icon breathes gently. */
  musicPlaying?: boolean;
}>();

const emit = defineEmits<{
  "toggle-ambience": [];
  "open-settings": [];
  /** Focus the 3D music box (or open the player straight away without one). */
  "open-music": [];
  /** Touch devices can't type `sudo` — give them a door to the spells. */
  "open-console": [];
}>();
</script>

<template>
  <div
    data-hud
    class="fixed inset-x-0 bottom-0 z-20 items-end justify-between"
    :class="bookOpen ? 'hidden md:flex' : 'flex'"
    style="
      padding-bottom: calc(0.75rem + var(--safe-bottom));
      padding-left: calc(1rem + var(--safe-left));
      padding-right: calc(1rem + var(--safe-right));
    "
  >
    <!-- Identity -->
    <div class="pointer-events-none select-none leading-tight">
      <p class="m-0 font-heading text-xs font-semibold uppercase tracking-[0.25em] text-parchment/80">
        {{ identity.name }}
      </p>
      <p class="m-0 font-body text-xs italic text-parchment/75">
        {{ identity.title }}
      </p>
    </div>

    <!-- Icon buttons -->
    <div class="hud-icons flex items-center gap-1.5">
      <button
        type="button"
        class="hud-btn"
        aria-label="Hearth sounds"
        :aria-pressed="ambienceOn"
        :data-tip="ambienceOn ? 'Hearth sounds: on' : 'Hearth sounds: off'"
        @click="emit('toggle-ambience')"
      >
        <!-- hearth flame; struck through when the ambience is off -->
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3c.4 3-3.5 4.6-3.5 8.6a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9-.3 1-.9 1.5-1.6 1.5C12.3 8.2 12.9 5.6 12 3z" />
          <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-1.6.6-3 1.5-4" />
          <path d="M18.5 15c0 1.9-.8 3.4-2 4.4" />
          <line v-if="!ambienceOn" x1="3" y1="3" x2="21" y2="21" stroke-width="1.8" />
        </svg>
      </button>

      <button
        type="button"
        class="hud-btn"
        :class="{ 'hud-playing': musicPlaying }"
        :aria-label="
          musicPlaying
            ? 'Open the Innkeeper\'s Music Box (music playing)'
            : 'Open the Innkeeper\'s Music Box'
        "
        data-tip="The Innkeeper's Music Box"
        @click="emit('open-music')"
      >
        <!-- music box: a lidded case with a winding key and a falling note -->
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 11h16v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z" />
          <path d="M5 11 6.2 8h11.6L19 11" />
          <path d="M9 15.5h6" />
          <path d="M20 14.5h2.2" />
          <path d="M12 5.2V2.6l2.6.7" />
          <circle cx="11" cy="5.4" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <button
        type="button"
        class="hud-btn coarse-only"
        aria-label="Open the wizard's prepared spells"
        data-tip="Prepared Spells"
        @click="emit('open-console')"
      >
        <!-- sparkling wand -->
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 19 14.5 9.5" />
          <path d="m15.5 4 .8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
          <path d="m19.5 12.5.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
        </svg>
      </button>

      <button
        type="button"
        class="hud-btn"
        aria-label="Open the Innkeeper's Ledger (settings)"
        data-tip="The Innkeeper's Ledger"
        @click="emit('open-settings')"
      >
        <!-- compass rose -->
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9z" fill="currentColor" stroke="none" opacity="0.85" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <a
        v-if="cvUrl"
        class="hud-btn"
        :href="cvUrl"
        download
        aria-label="Download the Adventurer's Contract (CV)"
        data-tip="The Adventurer's Contract (CV)"
        @click="track('cv_download')"
      >
        <!-- scroll with download arrow -->
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4v10m0 0-4-4m4 4 4-4" />
          <path d="M4 19h13a3 3 0 0 0 3-3" />
        </svg>
      </a>

      <a
        class="hud-btn"
        :href="contact.github.url"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub profile, SmoKerIV (opens in a new tab)"
        data-tip="GitHub"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
        </svg>
      </a>
    </div>
  </div>
</template>

<style scoped>
.hud-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 40px: the floor for a dense desktop control (44px on touch, below). */
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  color: rgba(232, 220, 192, 0.7);
  background: rgba(13, 10, 8, 0.5);
  border: 1px solid rgba(176, 141, 60, 0.3);
  backdrop-filter: blur(3px);
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    scale 0.15s ease;
}
.hud-btn:hover {
  color: var(--arcane);
  border-color: rgba(71, 189, 173, 0.55);
  background: rgba(13, 10, 8, 0.7);
}
.hud-btn:active {
  scale: 0.96;
}
.hud-btn:focus-visible {
  outline: 2px solid var(--arcane);
  outline-offset: 3px;
  border-radius: 9999px;
  color: var(--arcane);
}

/* Music playing: a slow brass breath around the button. */
.hud-playing {
  color: var(--gold-bright);
  border-color: rgba(212, 175, 94, 0.55);
}
@media (prefers-reduced-motion: no-preference) {
  .hud-playing {
    animation: hud-breathe 2.6s ease-in-out infinite;
  }
}
@keyframes hud-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(212, 175, 94, 0);
  }
  50% {
    box-shadow: 0 0 12px 1px rgba(212, 175, 94, 0.45);
  }
}

/* Tooltip: a small night-toned label above the button, anchored to the
   button's right edge so the rightmost one never leaves the screen.
   Only for hover and keyboard focus (touch has no hover). */
.hud-btn::after {
  content: attr(data-tip);
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.5rem);
  padding: 0.3rem 0.6rem;
  font-family: "Cinzel", serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
  color: var(--parchment);
  background: rgba(13, 10, 8, 0.92);
  border: 1px solid rgba(176, 141, 60, 0.35);
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(3px);
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}
@media (hover: hover) {
  .hud-btn:hover::after {
    opacity: 1;
    transform: none;
    transition-delay: 0.35s;
  }
}
.hud-btn:focus-visible::after {
  opacity: 1;
  transform: none;
}

/* Fingers need ≥44px targets. */
@media (pointer: coarse) {
  .hud-btn {
    width: 2.75rem;
    height: 2.75rem;
  }
  .hud-btn::after {
    display: none;
  }
}

/* Six round buttons (music box included) need to fit a 390px phone beside
   the name plate: tighten the row a notch, keep the targets near 44px. */
@media (pointer: coarse) and (max-width: 420px) {
  .hud-icons {
    gap: 0.25rem;
  }
  .hud-btn {
    width: 2.6rem;
    height: 2.6rem;
  }
}

/* Keyboard users summon the console by typing `sudo`; only fingers
   need the door. */
.coarse-only {
  display: none;
}
@media (pointer: coarse) {
  .coarse-only {
    display: flex;
  }
}
</style>
