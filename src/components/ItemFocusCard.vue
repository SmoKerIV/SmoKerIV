<script setup lang="ts">
import { computed } from "vue";
import { ITEM_LABELS } from "../three/types";
import { itemCards, type FocusCardItem } from "../data/content";

/**
 * Parchment-scrap payoff card shown bottom-center once a focus zoom
 * settles on a table item (the return strap lives top-center).
 */
const props = defineProps<{ item: FocusCardItem }>();

const label = computed(() => ITEM_LABELS[props.item]);
const card = computed(() => itemCards[props.item]);
</script>

<template>
  <aside class="focus-card pointer-events-auto" :aria-label="label.name">
    <div class="scrap parchment book-page px-6 py-5 sm:px-7">
      <h2 class="scrap-title">{{ label.name }}</h2>
      <p class="scrap-flavor">{{ label.flavor }}</p>

      <p v-if="card.lead" class="card-lead">{{ card.lead }}</p>

      <ul v-if="card.entries" class="card-list">
        <li
          v-for="(entry, i) in card.entries"
          :key="entry.primary"
          :style="{ '--i': Math.min(i, 8) }"
        >
          <span class="entry-primary">
            {{ entry.primary
            }}<span v-if="entry.active" class="entry-active"> ✦ active</span>
          </span>
          <span v-if="entry.secondary" class="entry-secondary num">
            {{ entry.secondary }}
          </span>
        </li>
      </ul>

      <ul v-if="card.links" class="card-list">
        <li
          v-for="(link, i) in card.links"
          :key="link.href"
          :style="{ '--i': Math.min(i, 8) }"
        >
          <a
            class="card-link"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            :download="link.download"
          >
            {{ link.label }}<span v-if="link.external" class="card-arrow" aria-hidden="true">↗</span>
            <span v-if="link.external" class="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.focus-card {
  position: fixed;
  left: 50%;
  /* Clear of the HudBar chrome that hugs the bottom corners. */
  bottom: clamp(3.9rem, 7vh, 5.25rem);
  z-index: 30;
  width: min(92vw, 26rem);
  transform: translateX(-50%);
  /* The shadow lives on the wrapper: a clip-path would swallow a
     box-shadow on the scrap itself. */
  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.5))
    drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
}

/* Torn, deckled edge: many small irregular steps instead of a few big
   ones, so it reads as paper, not a polygon. */
.scrap {
  position: relative;
  clip-path: polygon(
    0.6% 0.72%, 7.24% 1.48%, 14.23% 0.81%, 21.57% 0.3%, 28.59% 1.01%, 36.18% 0.15%,
    42.54% 0.15%, 50.5% 1.11%, 56.41% 1.57%, 65.03% 1.05%, 71.61% 0.25%, 77.8% 0.85%,
    85.01% 0.3%, 92.44% 0.05%, 99.4% 0.74%, 99.6% 16.34%, 99.53% 29.41%, 99.55% 43.83%,
    99.59% 55.81%, 99.1% 74.4%, 99.24% 86.96%, 99.4% 99.43%, 92.42% 99.48%, 85.03% 98.62%,
    78.41% 98.48%, 71.25% 98.28%, 64.84% 100%, 56.68% 98.36%, 49.95% 98.24%, 42.69% 99.87%,
    35.92% 98.6%, 28.2% 99.84%, 21.16% 98.26%, 14.7% 99.79%, 6.74% 99.82%, 0.6% 99.89%,
    0.72% 83.78%, 0.5% 71.11%, 0.17% 58.53%, 0.12% 43.72%, 0.1% 28.1%, 0.19% 12.9%
  );
}
/* Faint fibre stain along the torn rim. */
.scrap::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 14px 2px rgba(110, 76, 34, 0.28);
}

/* Ink typography: engraved Cinzel title over an italic flavor line, set
   off by a short gold rule. */
.scrap-title {
  display: block !important;
  margin: 0 0 0.15rem !important;
  font-size: 1.15rem !important;
  line-height: 1.25;
  letter-spacing: 0.12em;
  text-wrap: balance;
}
.scrap-title::before,
.scrap-title::after {
  display: none !important;
}
.scrap-flavor {
  margin: 0 !important;
  padding-bottom: 0.55rem;
  font-family: "EB Garamond", serif;
  font-size: 0.95rem !important;
  line-height: 1.4 !important;
  font-style: italic;
  color: var(--ink-faint);
  text-wrap: pretty;
  background: linear-gradient(90deg, var(--gold), transparent 70%) left bottom / 100% 1px
    no-repeat;
}

.card-lead {
  margin: 0.7rem 0 0 !important;
  font-family: "EB Garamond", serif;
  font-size: 1rem !important;
  line-height: 1.45 !important;
  font-style: italic;
  color: var(--ink-soft);
}

.card-list {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 32vh;
  overflow-y: auto;
}
.card-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  line-height: 1.35;
  padding-bottom: 0.3rem;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.32);
}
.card-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.entry-primary {
  font-family: "Cinzel", serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink);
}
.card-list li:has(.entry-secondary) .entry-primary {
  flex: 0 0 8.4rem;
}
.entry-secondary {
  font-family: "EB Garamond", serif;
  font-size: 0.95rem;
  font-style: italic;
  text-align: right;
  color: var(--ink-faint);
}
.entry-active {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--arcane-dark);
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  min-height: 2rem;
  font-family: "EB Garamond", serif;
  font-size: 1.02rem;
  color: var(--arcane-dark);
  text-decoration: none;
  background: linear-gradient(currentColor, currentColor) left calc(100% - 0.3rem) / 100% 1px
    no-repeat;
  transition:
    color 0.2s ease,
    background-size 0.2s ease;
}
.card-arrow {
  display: inline-block;
  font-size: 0.85em;
  transition: transform 0.2s ease;
}
.card-link:hover,
.card-link:focus-visible {
  color: var(--ink);
  background-size: 100% 2px;
}
.card-link:hover .card-arrow,
.card-link:focus-visible .card-arrow {
  transform: translate(1px, -1px);
}
.card-link:focus-visible {
  outline: 2px solid var(--arcane-dark);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Entries are written in one after another (infrequent, so a stagger
   helps the eye). Reduced motion drops it entirely. */
@media (prefers-reduced-motion: no-preference) {
  .card-list li {
    animation: entryIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(0.18s + var(--i, 0) * 45ms);
  }
}
@keyframes entryIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

/* Fade/slide-up, matching the app's other overlay transitions: ease-out
   on both ends, the exit shorter and quieter than the entrance. */
.focus-card-enter-active {
  transition:
    opacity 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.focus-card-leave-active {
  transition:
    opacity 0.16s ease-out,
    transform 0.16s ease-out;
}
.focus-card-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) rotate(-0.6deg);
}
.focus-card-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
