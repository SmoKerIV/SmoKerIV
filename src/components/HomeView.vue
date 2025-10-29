<script setup lang="ts">
import { defineEmits } from 'vue'

// Single Responsibility: Display home page with name, description, and navigation
interface Emits {
  (e: 'navigate', page: 'home' | 'experience' | 'contact'): void
}

const emit = defineEmits<Emits>()

const navigateTo = (page: 'experience' | 'contact'): void => {
  emit('navigate', page)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-6 bg-slate-50">
    <div class="max-w-2xl w-full space-y-8 fade-enter-active">
      <!-- Name -->
      <h1 class="text-5xl md:text-6xl text-slate-800 tracking-tight">
        Baker Alazzawi
      </h1>
      
      <!-- Description -->
      <p class="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">
        Computer Science graduate specializing in AI, building full-stack applications with modern web technologies. Passionate about creating scalable solutions at the intersection of web development and artificial intelligence.
      </p>

      <!-- Navigation Buttons -->
      <div class="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          @click="navigateTo('experience')"
          class="btn-minimal px-8 py-4 bg-slate-700 text-slate-100 rounded-lg font-medium hover:bg-slate-600"
        >
          Experience
        </button>
        
        <button
          @click="navigateTo('contact')"
          class="btn-minimal px-8 py-4 border-2 border-slate-400 text-slate-700 rounded-lg font-medium hover:border-slate-500 hover:bg-slate-100"
        >
          Contact
        </button>
      </div>
    </div>
  </div>
</template>
