<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { gsap } from 'gsap'

// Loader component following Single Responsibility Principle
// Only responsible for displaying the loading state with GSAP animation

const loaderRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (loaderRef.value) {
    // GSAP animation for the loader tag
    gsap.fromTo(
      loaderRef.value,
      { 
        opacity: 0, 
        scale: 0.5, 
        rotation: -15 
      },
      {
        opacity: 1,
        scale: 1,
        rotation: 0,
        duration: 0.8,
        ease: "back.out(1.7)",
        yoyo: true,
        repeat: -1,
        repeatDelay: 0.2
      }
    )
  }
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center bg-slate-800 z-50">
    <div ref="loaderRef" class="text-7xl font-light text-slate-300">
      &lt;/&gt;
    </div>
  </div>
</template>
