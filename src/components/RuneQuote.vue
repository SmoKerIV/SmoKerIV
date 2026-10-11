<script setup lang="ts">
/**
 * A runic line that cross-fades to its English text on hover, keyboard focus
 * or tap (touch toggles; tapping elsewhere hides). Both layers share one grid
 * cell, so the box is as large as the larger of the two and nothing jumps.
 * Screen readers always get the English (and the citation) from the
 * visually-hidden text; the two visual layers are aria-hidden.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps<{
  runes: string;
  english: string;
  /** Full citation for screen readers. */
  cite: string;
  /** Handwritten attribution, in runes and in English (revealed together). */
  note: string;
  noteRunes: string;
  /** "margin": note sits beside the quote; "below": under it. */
  layout?: "margin" | "below";
  /** Tilt of the note, degrees. */
  tilt?: number;
  /** Skip the cross-fade (reduced motion). */
  instant?: boolean;
}>();

const root = ref<HTMLElement | null>(null);
const hovered = ref(false);
const tapped = ref(false);
let lastPointer = "mouse";

function onPointerDown(e: PointerEvent): void {
  lastPointer = e.pointerType || "mouse";
}
function onEnter(e: PointerEvent): void {
  if (e.pointerType === "mouse") hovered.value = true;
}
function onLeave(e: PointerEvent): void {
  if (e.pointerType === "mouse") hovered.value = false;
}
function onClick(e: MouseEvent): void {
  // Keyboard activation (detail 0) is covered by :focus-visible; mouse by hover.
  if (e.detail === 0 || lastPointer === "mouse") return;
  tapped.value = !tapped.value;
}
function onOutside(e: Event): void {
  if (tapped.value && !root.value?.contains(e.target as Node)) tapped.value = false;
}

onMounted(() => document.addEventListener("pointerdown", onOutside, true));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onOutside, true));
</script>

<template>
  <button
    ref="root"
    type="button"
    class="rq"
    :class="[`rq-${layout ?? 'margin'}`, { 'rq-open': hovered || tapped, 'rq-instant': instant }]"
    @pointerdown="onPointerDown"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @click="onClick"
  >
    <span class="sr-only">{{ english }} — {{ cite }}</span>
    <span class="rq-stack" aria-hidden="true">
      <span class="rq-runes">{{ runes }}</span>
      <span class="rq-en">{{ english }}</span>
    </span>
    <span class="rq-note" aria-hidden="true" :style="{ transform: `rotate(${tilt ?? -4}deg)` }">
      <span class="rq-runes rq-note-runes">{{ noteRunes }}</span>
      <span class="rq-en rq-note-en">{{ note }}</span>
    </span>
  </button>
</template>

<style scoped>
.rq {
  width: 100%;
  margin: 0;
  padding: 0.1rem 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border-radius: 3px;
}
.rq:focus-visible {
  outline: 2px solid #1d5c52;
  outline-offset: 3px;
}
.rq {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.15rem 0.6rem;
}
.rq-margin {
  grid-template-columns: minmax(0, 1fr) 5.25rem;
  padding-right: 0.3rem;
}
.rq-stack,
.rq-note {
  display: grid;
}
.rq-note {
  align-self: start;
  padding-top: 0.15rem;
}
.rq .rq-note-runes,
.rq .rq-note-en {
  font-family: "EB Garamond", serif;
  font-style: italic;
  font-size: 12.5px;
  line-height: 1.3;
  letter-spacing: 0;
  color: rgba(94, 19, 15, 0.75);
}
.rq .rq-note-runes {
  font-style: normal;
  letter-spacing: 0.04em;
  line-height: 1.5;
}
.rq-runes,
.rq-en {
  grid-area: 1 / 1;
  transition:
    opacity 250ms ease,
    filter 250ms ease;
}
.rq-runes {
  font-size: var(--rq-rune-size, 0.95rem);
  line-height: 1.7;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  word-break: break-word;
}
.rq-en {
  font-family: "EB Garamond", serif;
  font-style: italic;
  font-size: var(--rq-en-size, 1.05rem);
  line-height: 1.45;
  color: var(--ink);
  opacity: 0;
  filter: blur(2px);
  align-self: center;
}
.rq-open .rq-runes,
.rq:focus-visible .rq-runes {
  opacity: 0;
  filter: blur(3px);
}
.rq-open .rq-en,
.rq:focus-visible .rq-en {
  opacity: 1;
  filter: none;
}
.rq-instant .rq-runes,
.rq-instant .rq-en {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .rq-runes,
  .rq-en {
    transition: none;
  }
}
</style>
