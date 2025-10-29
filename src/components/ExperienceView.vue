<script setup lang="ts">
import { defineEmits } from 'vue'

// Single Responsibility: Display work experience list
interface Experience {
  id: number
  company: string
  role: string
  period: string
}

interface Emits {
  (e: 'navigate', page: 'home' | 'experience' | 'contact'): void
}

const emit = defineEmits<Emits>()

// Open/Closed Principle: Easy to add new experiences without modifying component logic
const experiences: Experience[] = [
  { id: 1, company: 'Qi Card', role: 'Software Developer', period: '2025/Jul - Present' },
  { id: 2, company: 'Alrabiaa TV', role: 'Software Developer', period: '2025/Feb - 2025/Jun' },
  { id: 3, company: 'Puretik', role: 'Software Developer', period: '2024/Jun - 2025/Jun' },
  { id: 4, company: 'Aon', role: 'Assistant Trainer', period: '2024/Oct - 2024/Dec' },
  { id: 5, company: 'Vitex', role: 'Software Developer', period: '2024/Jan - 2024/Jun' },
  { id: 6, company: 'Makers of Baghdad', role: 'Frontend Developer Intern', period: '2023/Jul-2023/Aug' },
]

const navigateTo = (page: 'home'): void => {
  emit('navigate', page)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-6 bg-slate-50">
    <div class="max-w-2xl w-full space-y-8 fade-enter-active">
      <!-- Back Button -->
      <button
        @click="navigateTo('home')"
        class="text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2 mb-8"
      >
        <span>←</span>
        <span>Back</span>
      </button>

      <!-- Title -->
      <h2 class="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
        Experience
      </h2>

      <!-- Experience List -->
      <div class="space-y-6 pt-4">
        <div
          v-for="exp in experiences"
          :key="exp.id"
          class="border-l-2 border-slate-300 pl-6 py-2 hover:border-slate-500 transition-colors"
        >
          <h3 class="text-xl font-medium text-slate-800">{{ exp.company }}</h3>
          <p class="text-slate-600 mt-1">{{ exp.role }}</p>
          <p class="text-sm text-slate-500 mt-1">{{ exp.period }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
