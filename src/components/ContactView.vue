<script setup lang="ts">
import { defineEmits } from "vue";

// Single Responsibility: Display contact information
interface ContactInfo {
  id: number;
  label: string;
  value: string;
  link: string;
  type: "email" | "phone" | "social";
}

interface Emits {
  (e: "navigate", page: "home" | "experience" | "contact"): void;
}

const emit = defineEmits<Emits>();

// Open/Closed Principle: Easy to add new contact methods
const contacts: ContactInfo[] = [
  {
    id: 1,
    label: "Email",
    value: "baker.alazzawi0@gmail.com",
    link: "mailto:baker.alazzawi0@gmail.com",
    type: "email",
  },
  {
    id: 2,
    label: "Phone",
    value: "+964 773 098 2555",
    link: "tel:+9647730982555",
    type: "phone",
  },
  {
    id: 3,
    label: "GitHub",
    value: "github.com/SmoKerIV",
    link: "https://github.com/SmoKerIV",
    type: "social",
  },
  {
    id: 4,
    label: "LinkedIn",
    value: "linkedin.com/in/baker-alazzawi",
    link: "https://linkedin.com/in/baker-alazzawi",
    type: "social",
  },
  {
    id: 5,
    label: "Instagram",
    value: "@SmoKer_IV",
    link: "https://instagram.com/SmoKer_IV",
    type: "social",
  },
];

const navigateTo = (page: "home"): void => {
  emit("navigate", page);
};
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
        Contact Me
      </h2>

      <!-- Contact List -->
      <div class="space-y-6 pt-4">
        <a
          v-for="contact in contacts"
          :key="contact.id"
          :href="contact.link"
          target="_blank"
          rel="noopener noreferrer"
          class="block border-l-2 border-slate-300 pl-6 py-3 hover:border-slate-500 transition-colors group"
        >
          <p class="text-sm text-slate-500 mb-1">{{ contact.label }}</p>
          <p
            class="text-lg text-slate-700 group-hover:text-slate-900 transition-colors"
          >
            {{ contact.value }}
          </p>
        </a>
      </div>
    </div>
  </div>
</template>
