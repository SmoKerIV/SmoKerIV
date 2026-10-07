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
    <div
      class="parchment parchment-scrap book-page px-6 py-5 shadow-tome sm:px-7"
    >
      <h2 class="!mb-0.5 !text-[1.15rem]">{{ label.name }}</h2>
      <p class="m-0 font-body text-sm italic text-ink-faint">
        {{ label.flavor }}
      </p>

      <p v-if="card.lead" class="card-lead">{{ card.lead }}</p>

      <ul v-if="card.entries" class="card-list">
        <li v-for="entry in card.entries" :key="entry.primary">
          <span class="entry-primary">
            {{ entry.primary
            }}<span v-if="entry.active" class="entry-active"> ✦ active</span>
          </span>
          <span v-if="entry.secondary" class="entry-secondary">
            {{ entry.secondary }}
          </span>
        </li>
      </ul>

      <ul v-if="card.links" class="card-list">
        <li v-for="link in card.links" :key="link.href">
          <a
            class="card-link"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            :download="link.download"
          >
            {{ link.label }}
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
}

.card-lead {
  margin: 0.7rem 0 0;
  font-family: "EB Garamond", serif;
  font-size: 0.95rem;
  font-style: italic;
  color: var(--ink-soft);
}

.card-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  max-height: 32vh;
  overflow-y: auto;
}
.card-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  line-height: 1.35;
  padding-bottom: 0.22rem;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.28);
}
.card-list li:last-child {
  border-bottom: none;
}

.entry-primary {
  font-family: "Cinzel", serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink);
}
.entry-secondary {
  font-family: "EB Garamond", serif;
  font-size: 0.92rem;
  font-style: italic;
  text-align: right;
  color: var(--ink-faint);
}
.entry-active {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--arcane-dim);
}

.card-link {
  font-family: "EB Garamond", serif;
  font-size: 1rem;
  color: var(--arcane-dim);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.card-link:hover {
  color: var(--ink);
}

/* Fade/slide-up, matching the app's other overlay transitions. */
.focus-card-enter-active {
  transition:
    opacity 0.45s ease,
    transform 0.45s cubic-bezier(0.2, 1, 0.35, 1);
}
.focus-card-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.focus-card-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(18px);
}
.focus-card-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
