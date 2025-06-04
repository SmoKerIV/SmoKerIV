<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import HomePage from './components/HomePage.vue'

const isDark = ref(localStorage.getItem('theme') === 'dark' || false)

const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
    document.documentElement.classList.toggle('dark', isDark.value)
})

watch(isDark, (newVal) => {
    document.documentElement.classList.toggle('dark', newVal)
})
</script>

<template>
    <div id="app" :class="{ 'dark': isDark, 'light': !isDark }" class="min-h-screen transition-colors duration-300">
        <AppHeader @toggle-theme="toggleTheme" :isDark="isDark" />
        <HomePage :isDark="isDark" />
    </div>
</template>

<style>
.light {
    background-color: #ffffff;
    color: #1f2937;
}

.dark {
    background-color: #0f172a;
    color: #f8fafc;
}
</style>
