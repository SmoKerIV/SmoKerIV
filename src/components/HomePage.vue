/* filepath: d:\Code\SmoKerIV\src\components\HomePage.vue */
<script setup lang="ts">
import CustomCursor from './ui/CustomCursor.vue'
import HeroSection from './sections/HeroSection.vue'
import AboutSection from './sections/AboutSection.vue'
import ExperienceSection from './sections/ExperienceSection.vue'
import EducationSection from './sections/EducationSection.vue'
import SkillsSection from './sections/SkillsSection.vue'
import ContactSection from './sections/ContactSection.vue'

defineProps<{
  isDark: boolean
}>()
</script>

<template>
  <CustomCursor />

  <main class="relative pt-24">
    <HeroSection />
    <AboutSection />
    <ExperienceSection />
    <EducationSection />
    <SkillsSection />
    <ContactSection />
  </main>
</template>