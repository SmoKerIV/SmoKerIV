<template>
    <div ref="matrixContainer" class="matrix-background" :class="{ 'hero-only': heroOnly }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
    heroOnly?: boolean
}>()

const matrixContainer = ref<HTMLElement>()
const drops = ref<number[]>([])
const chars = ['0', '1']
const fontSize = 14
let animationId: number
let heroSection: HTMLElement | null = null

const createMatrixRain = () => {
    if (!matrixContainer.value) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    matrixContainer.value.appendChild(canvas)
    heroSection = document.getElementById('home')

    const resizeCanvas = () => {
        if (props.heroOnly && heroSection) {
            canvas.width = heroSection.offsetWidth
            canvas.height = heroSection.offsetHeight
        } else {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        const columns = Math.floor(canvas.width / fontSize)
        drops.value = Array(columns).fill(1).map(() => Math.floor(Math.random() * -100))
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const draw = () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Different colors for light and dark themes
        const isDark = document.documentElement.classList.contains('dark')
        ctx.fillStyle = isDark ? 'rgba(34, 211, 238, 0.6)' : 'rgba(8, 145, 178, 0.4)'
        ctx.font = `bold ${fontSize}px monospace`

        for (let i = 0; i < drops.value.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)]
            ctx.fillText(char, i * fontSize, drops.value[i] * fontSize)

            if (drops.value[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops.value[i] = Math.floor(Math.random() * -20)
            }
            drops.value[i]++
        }
    }

    const animate = () => {
        draw()
        setTimeout(() => {
            animationId = requestAnimationFrame(animate)
        }, 80)
    }

    animate()

    return () => {
        window.removeEventListener('resize', resizeCanvas)
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas)
        }
    }
}

onMounted(() => {
    createMatrixRain()
})

onUnmounted(() => {
    if (animationId) {
        cancelAnimationFrame(animationId)
    }
})
</script>

<style scoped>
.matrix-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    opacity: 0.8;
}

.dark .matrix-background {
    opacity: 0.9;
}

.matrix-background.hero-only {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 2;
}

.matrix-background canvas {
    width: 100%;
    height: 100%;
}
</style>
