<script setup lang="ts">
import { identity, contact } from "../data/content";
import { track } from "../composables/useAnalytics";

defineProps<{
  musicOn: boolean;
  bookOpen: boolean;
  /** Set only when /baker-cv.pdf actually exists. */
  cvUrl?: string | null;
}>();

const emit = defineEmits<{
  "toggle-music": [];
  "open-settings": [];
}>();
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-20 items-end justify-between px-4 pb-3 sm:px-6"
    :class="bookOpen ? 'hidden md:flex' : 'flex'"
  >
    <!-- Identity -->
    <div class="pointer-events-none select-none leading-tight">
      <p class="m-0 font-heading text-xs font-semibold uppercase tracking-[0.25em] text-parchment/80">
        {{ identity.name }}
      </p>
      <p class="m-0 font-body text-[11px] italic text-parchment/45">
        {{ identity.title }}
      </p>
    </div>

    <!-- Icon buttons -->
    <div class="flex items-center gap-1.5">
      <button
        class="hud-btn"
        :aria-label="musicOn ? 'Silence the bard' : 'Summon the bard'"
        :title="musicOn ? 'Silence the bard' : 'Summon the bard'"
        @click="emit('toggle-music')"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18V6l10-2v11" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="15" r="2.5" />
          <line v-if="!musicOn" x1="3" y1="3" x2="21" y2="21" stroke-width="1.8" />
        </svg>
      </button>

      <button
        class="hud-btn"
        aria-label="Open the Innkeeper's Ledger (settings)"
        title="The Innkeeper's Ledger"
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
        aria-label="Take the Adventurer's Contract (CV)"
        title="The Adventurer's Contract (CV)"
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
        aria-label="GitHub — SmoKerIV"
        title="GitHub"
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 9999px;
  color: rgba(232, 220, 192, 0.6);
  background: rgba(13, 10, 8, 0.45);
  border: 1px solid rgba(176, 141, 60, 0.25);
  backdrop-filter: blur(3px);
  transition: color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}
.hud-btn:hover {
  color: var(--arcane);
  border-color: rgba(53, 208, 186, 0.5);
}
</style>
