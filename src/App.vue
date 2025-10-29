<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoaderComponent from './components/LoaderComponent.vue'
import HomeView from './components/HomeView.vue'
import ExperienceView from './components/ExperienceView.vue'
import ContactView from './components/ContactView.vue'

// Dependency Inversion Principle: Components depend on abstractions (events) not concrete implementations
type PageType = 'home' | 'experience' | 'contact'

// Interface Segregation Principle: Simple, focused state management
const currentPage = ref<PageType>('home')
const isLoading = ref<boolean>(true)

// Single Responsibility: Handle page navigation
const navigateTo = (page: PageType): void => {
  currentPage.value = page
}

// Liskov Substitution Principle: Any component can be swapped as long as it emits 'navigate'
onMounted(() => {
  // Simulate initial load
  setTimeout(() => {
    isLoading.value = false
  }, 1500)
})
</script>

<template>
  <div id="app" class="min-h-screen bg-slate-50">
    <!-- Loader -->
    <LoaderComponent v-if="isLoading" />

    <!-- Main Content with Transitions -->
    <Transition name="fade" mode="out-in">
      <HomeView 
        v-if="!isLoading && currentPage === 'home'"
        @navigate="navigateTo"
      />
      <ExperienceView 
        v-else-if="!isLoading && currentPage === 'experience'"
        @navigate="navigateTo"
      />
      <ContactView 
        v-else-if="!isLoading && currentPage === 'contact'"
        @navigate="navigateTo"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* Scoped styles for transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
