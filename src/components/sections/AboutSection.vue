<script setup lang="ts">
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const stats = [
    { value: '1+', label: 'Years Experience' },
    { value: '15+', label: 'Technologies' },
    { value: '10+', label: 'Projects' },
    { value: '∞', label: 'Possibilities' }
]

onMounted(() => {
    gsap.set('.about-visual', { opacity: 0, x: -100, rotation: -10 })
    gsap.set('.about-content', { opacity: 0, x: 100 })
    gsap.set('.stat-card', { opacity: 0, y: 50, scale: 0.8 })
    gsap.set('.tech-icon', { opacity: 0, scale: 0 })

    ScrollTrigger.create({
        trigger: '#about',
        start: 'top 80%',
        onEnter: () => {
            const tl = gsap.timeline()

            tl.to('.about-visual', {
                opacity: 1,
                x: 0,
                rotation: 0,
                duration: 1.2,
                ease: "power3.out"
            })
                .to('.about-content', {
                    opacity: 1,
                    x: 0,
                    duration: 1,
                    ease: "power2.out"
                }, "-=0.8")
                .to('.tech-icon', {
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.3,
                    ease: "back.out(1.7)"
                }, "-=0.5")
                .to('.stat-card', {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.6,
                    stagger: 0.1,
                    ease: "power2.out"
                }, "-=0.3")
        }
    })
})
</script>

<template>
    <!-- About Section with Split Design -->
    <section id="about" class="py-20 bg-white dark:bg-gray-900 relative">
        <div class="container mx-auto px-4">
            <div class="grid lg:grid-cols-2 gap-16 items-center">
                <!-- Left: Interactive Avatar/Visual -->
                <div class="about-visual relative">
                    <div class="glass rounded-3xl p-8 floating-card">
                        <div
                            class="aspect-square bg-gradient-to-br from-cyan-700 via-teal-700 to-slate-700 rounded-3xl p-1">
                            <div class="bg-white dark:bg-gray-900 rounded-3xl h-full flex items-center justify-center">
                                <div class="text-8xl font-mono gradient-text">&lt;/&gt;</div>
                            </div>
                        </div>

                        <!-- Floating tech icons -->
                        <div
                            class="tech-icon absolute -top-4 -right-4 w-16 h-16 glass rounded-2xl flex items-center justify-center">
                            <span class="text-2xl">⚛️</span>
                        </div>
                        <div
                            class="tech-icon absolute -bottom-4 -left-4 w-16 h-16 glass rounded-2xl flex items-center justify-center">
                            <span class="text-2xl">🚀</span>
                        </div>
                    </div>
                </div>

                <!-- Right: About Content -->
                <div class="about-content space-y-8">
                    <div>
                        <h2 class="text-4xl font-bold mb-6 gradient-text">About Me</h2>
                        <p class="text-lg text-slate-700 dark:text-gray-300 leading-relaxed mb-6">
                            I'm a passionate developer who bridges the gap between artificial intelligence and practical
                            web solutions.
                            With a Computer Science background and hands-on experience at PureTik, I transform complex
                            problems into elegant code.
                        </p>
                        <p class="text-lg text-slate-700 dark:text-gray-300 leading-relaxed mb-6">
                            My passion lies in combining AI knowledge with practical web development skills to create
                            meaningful solutions. I'm committed to continuous learning and contributing to innovative
                            projects in both AI and web development domains.
                        </p>
                    </div>

                    <!-- Stats cards -->
                    <div class="grid grid-cols-2 gap-6">
                        <div v-for="stat in stats" :key="stat.label"
                            class="stat-card glass rounded-2xl p-6 text-center floating-card">
                            <div class="text-3xl font-bold gradient-text mb-2">{{ stat.value }}</div>
                            <div class="text-sm text-slate-600 dark:text-gray-400">{{ stat.label }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.matrix-overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 20% 30%, rgba(8, 145, 178, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(15, 118, 110, 0.03) 0%, transparent 50%);
}
</style>
