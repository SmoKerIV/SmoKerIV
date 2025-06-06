<template>
    <!-- Custom Cursor -->
    <div v-if="!isMobile()">
        <div class="cursor" ref="cursor"></div>
        <div class="cursor-follower" ref="follower"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const cursor = ref<HTMLElement>()
const follower = ref<HTMLElement>()

// Check if device is mobile
const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768 ||
        'ontouchstart' in window
}

const moveCursor = (e: MouseEvent) => {
    if (cursor.value && follower.value) {
        cursor.value.style.left = e.clientX + 'px'
        cursor.value.style.top = e.clientY + 'px'

        setTimeout(() => {
            if (follower.value) {
                follower.value.style.left = e.clientX + 'px'
                follower.value.style.top = e.clientY + 'px'
            }
        }, 100)
    }
}

onMounted(() => {
    // Don't initialize cursor on mobile devices
    if (isMobile()) {
        return
    }

    document.addEventListener('mousemove', moveCursor)
})

onUnmounted(() => {
    document.removeEventListener('mousemove', moveCursor)
})
</script>

<style scoped>
.cursor {
    position: fixed;
    width: 10px;
    height: 10px;
    background-color: red;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
}

.cursor-follower {
    position: fixed;
    width: 20px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9998;
}
</style>
