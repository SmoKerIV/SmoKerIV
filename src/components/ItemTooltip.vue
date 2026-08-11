<script setup lang="ts">
import { computed } from "vue";
import type { ItemId } from "../three/types";
import { ITEM_LABELS } from "../three/types";

const props = defineProps<{
  item: ItemId;
  /** Cursor position in CSS pixels. */
  x: number;
  y: number;
}>();

const label = computed(() => ITEM_LABELS[props.item]);

/* Keep the nameplate on screen near the edges. */
const clampedX = computed(() => {
  const half = 110;
  return Math.min(Math.max(props.x, half), window.innerWidth - half);
});
const flipBelow = computed(() => props.y < 110);
</script>

<template>
  <div
    class="pointer-events-none fixed z-30 select-none"
    :style="{
      left: `${clampedX}px`,
      top: `${y}px`,
      transform: flipBelow
        ? 'translate(-50%, 22px)'
        : 'translate(-50%, calc(-100% - 18px))',
    }"
  >
    <div class="parchment parchment-scrap px-5 py-3 text-center shadow-tome">
      <p class="m-0 font-heading text-sm font-semibold tracking-wide text-ink">
        {{ label.name }}
      </p>
      <p class="m-0 mt-0.5 font-body text-[13px] italic leading-snug text-ink-soft">
        {{ label.flavor }}
      </p>
    </div>
  </div>
</template>
