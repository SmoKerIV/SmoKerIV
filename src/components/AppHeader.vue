/* filepath: d:\Code\SmoKerIV\src\components\AppHeader.vue */
<template>
  <header class="fixed top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-50 transition-all duration-500"
    :class="scrolled ? 'sm:top-2' : 'sm:top-4'">
    <div class="glass rounded-2xl sm:rounded-3xl px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 mx-auto max-w-6xl">
      <div class="flex items-center justify-between">
        <!-- Logo/Name with animation -->
        <div class="flex-shrink-0 group min-w-0">
          <h1 class="text-base sm:text-lg md:text-xl lg:text-2xl font-bold gradient-text font-mono truncate">
            &lt;Baker /&gt;
          </h1>
          <div
            class="h-0.5 bg-gradient-to-r from-cyan-600 to-teal-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300">
          </div>
        </div>

        <!-- Floating Navigation Pills -->
        <nav class="hidden lg:flex items-center space-x-2 flex-shrink-0">
          <div class="flex bg-white/10 dark:bg-black/20 rounded-full p-1 backdrop-blur-md">
            <a v-for="item in navItems" :key="item.id" :href="item.href" @click="setActive(item.id)" class="nav-pill"
              :class="{ 'nav-pill-active': activeNav === item.id }">
              <component :is="item.icon" class="w-4 h-4 mr-2" />
              <span class="hidden xl:inline">{{ item.label }}</span>
            </a>
          </div>
        </nav>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-1 sm:space-x-2 md:space-x-3 flex-shrink-0">
          <!-- Social Orbs -->
          <div class="hidden md:flex items-center space-x-1 sm:space-x-2">
            <a v-for="social in socialLinks" :key="social.name" :href="social.url" target="_blank"
              class="social-orb group" :title="social.name">
              <Icon :icon="social.icon"
                class="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:scale-110 transition-transform" />
            </a>
          </div>

          <!-- Theme Toggle Orb -->
          <button @click="$emit('toggle-theme')" class="theme-orb flex-shrink-0"
            :class="isDark ? 'bg-yellow-400' : 'bg-slate-700'">
            <SunIcon v-if="isDark" class="w-4 h-4 text-gray-900" />
            <MoonIcon v-else class="w-4 h-4 text-white" />
          </button>

          <!-- Mobile Menu Trigger - Only visible on small screens -->
          <button @click="mobileMenuOpen = !mobileMenuOpen" class="sm:hidden theme-orb bg-slate-600 flex-shrink-0">
            <Bars3Icon v-if="!mobileMenuOpen" class="w-4 h-4 text-white" />
            <XMarkIcon v-else class="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Menu -->
      <transition name="mobile-menu">
        <div v-if="mobileMenuOpen" class="sm:hidden mt-3 sm:mt-4 md:mt-6 pb-2">
          <div class="flex flex-col space-y-1 sm:space-y-2">
            <a v-for="item in navItems" :key="item.id" :href="item.href" @click="mobileMenuOpen = false"
              class="mobile-nav-item">
              <component :is="item.icon" class="w-5 h-5 mr-3" />
              {{ item.label }}
            </a>
          </div>
          <!-- Mobile Social Links -->
          <div class="flex justify-center space-x-3 sm:space-x-4 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/20">
            <a v-for="social in socialLinks" :key="social.name" :href="social.url" target="_blank" class="social-orb"
              :title="social.name">
              <Icon :icon="social.icon" class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </a>
          </div>
        </div>
      </transition>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  HomeIcon,
  UserIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  CogIcon,
  EnvelopeIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { Icon } from '@iconify/vue'

const mobileMenuOpen = ref(false)
const scrolled = ref(false)
const activeNav = ref('home')

const navItems = [
  { id: 'home', label: 'Home', href: '#home', icon: HomeIcon },
  { id: 'about', label: 'About', href: '#about', icon: UserIcon },
  { id: 'experience', label: 'Work', href: '#experience', icon: BriefcaseIcon },
  { id: 'education', label: 'Study', href: '#education', icon: AcademicCapIcon },
  { id: 'skills', label: 'Skills', href: '#skills', icon: CogIcon },
  { id: 'contact', label: 'Contact', href: '#contact', icon: EnvelopeIcon },
]

const socialLinks = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/baker-alazzawi-2a7453226/', icon: 'mdi:linkedin' },
  { name: 'GitHub', url: 'https://github.com/SmoKerIV', icon: 'mdi:github' },
  { name: 'Instagram', url: 'https://www.instagram.com/smoker_iv/', icon: 'mdi:instagram' },
]

const setActive = (navId: string) => {
  activeNav.value = navId
}

const handleScroll = () => {
  scrolled.value = window.scrollY > 50
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.nav-pill {
  @apply px-3 xl:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center text-slate-700 dark:text-gray-300 hover:text-white;
}

.nav-pill-active {
  @apply bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg transform scale-105;
}

.social-orb {
  @apply w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center transition-all duration-300 hover:scale-110;
  box-shadow: 0 0 20px rgba(8, 145, 178, 0.3);
}

.social-orb:hover {
  box-shadow: 0 0 30px rgba(8, 145, 178, 0.5);
}

.theme-orb {
  @apply w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110;
  box-shadow: 0 0 15px rgba(8, 145, 178, 0.2);
}

.theme-orb:hover {
  box-shadow: 0 0 25px rgba(8, 145, 178, 0.4);
}

.mobile-nav-item {
  @apply flex items-center px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-slate-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-300;
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: all 0.3s ease;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.social-orb svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

@media (min-width: 640px) {
  .social-orb svg {
    width: 16px;
    height: 16px;
  }
}

@media (min-width: 768px) {
  .social-orb svg {
    width: 20px;
    height: 20px;
  }
}

/* Ensure menu button is truly hidden on small+ screens */
@media (min-width: 640px) {
  .mobile-menu-trigger {
    display: none !important;
  }

  button[class*="sm:hidden"] {
    display: none !important;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 639px) {
  .glass {
    margin-left: 0;
    margin-right: 0;
  }
}
</style>