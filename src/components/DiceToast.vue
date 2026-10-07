<script lang="ts">
export interface ToastPayload {
  id: number;
  text: string;
  tone: "normal" | "nat20" | "nat1" | "quest";
  actionLabel?: string;
}
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  toast: ToastPayload;
  /** Lift above the floating "Open the Tome" button (touch table view). */
  clearBottomButton?: boolean;
}>();
const emit = defineEmits<{ action: [] }>();

/** Random screen-sparkles for a natural 20. */
const sparks = computed(() => {
  if (props.toast.tone !== "nat20") return [];
  return Array.from({ length: 20 }, (_, i) => ({
    id: `${props.toast.id}-${i}`,
    left: `${4 + Math.random() * 92}%`,
    bottom: `${Math.random() * 30}%`,
    size: `${4 + Math.random() * 9}px`,
    delay: `${Math.random() * 0.7}s`,
    duration: `${0.9 + Math.random() * 1.3}s`,
    color: Math.random() > 0.4 ? "#47bdad" : "#d4af5e",
  }));
});
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 z-60 flex justify-center px-4"
    :style="{
      bottom: `calc(${clearBottomButton ? '8.5rem' : '3.5rem'} + var(--safe-bottom))`,
    }"
  >
    <!-- nat-20 screen sparkle -->
    <div v-if="sparks.length" class="fixed inset-0" aria-hidden="true">
      <span
        v-for="s in sparks"
        :key="s.id"
        class="spark"
        :style="{
          left: s.left,
          bottom: s.bottom,
          width: s.size,
          height: s.size,
          animationDelay: s.delay,
          animationDuration: s.duration,
          background: s.color,
          boxShadow: `0 0 8px 2px ${s.color}`,
        }"
      />
    </div>

    <div
      class="parchment parchment-scrap pointer-events-auto max-w-md px-7 py-4 text-center shadow-tome"
      role="status"
      aria-live="polite"
    >
      <p
        class="m-0 font-heading text-sm font-semibold tracking-wide"
        :class="{
          'text-arcane-dim': toast.tone === 'nat20',
          'text-wax': toast.tone === 'nat1',
          'text-ink': toast.tone === 'normal' || toast.tone === 'quest',
        }"
      >
        {{ toast.text }}
      </p>
      <button
        v-if="toast.actionLabel"
        class="btn-leather mt-2 rounded px-4 py-1.5 text-[11px]"
        @click="emit('action')"
      >
        {{ toast.actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.spark {
  position: absolute;
  border-radius: 9999px;
  animation-name: sparkRise;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}
</style>
