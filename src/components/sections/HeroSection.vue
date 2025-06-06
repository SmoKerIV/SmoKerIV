<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { gsap } from 'gsap'
import {
    ChatBubbleLeftRightIcon,
    BriefcaseIcon,
    ChevronDownIcon
} from '@heroicons/vue/24/outline'

const typedGreeting = ref('')
const greetingText = 'Hello, I\'m a Software Developer...'


const typeGreeting = async () => {
    for (let i = 0; i <= greetingText.length; i++) {
        typedGreeting.value = greetingText.slice(0, i)
        await new Promise(resolve => setTimeout(resolve, 100))
    }
}

onMounted(() => {
    typeGreeting()

    // GSAP animations
    gsap.set('.hero-card', { opacity: 0, y: 100, scale: 0.8 })
    gsap.set('.floating-shape', { opacity: 0, scale: 0 })
    gsap.set('.hero-btn', { opacity: 0, y: 50 })

    const tl = gsap.timeline()

    tl.to('.floating-shape', {
        opacity: 0.6,
        scale: 1,
        duration: 1.5,
        stagger: 0.2,
        ease: "back.out(1.7)"
    })
        .to('.hero-card', {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            ease: "power3.out"
        }, "-=1")
        .to('.hero-btn', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out"
        }, "-=0.5")

    // Continuous floating animation
    gsap.to('.floating-shape', {
        y: "random(-20, 20)",
        x: "random(-10, 10)",
        rotation: "random(-15, 15)",
        duration: "random(3, 6)",
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: {
            amount: 2,
            from: "random"
        }
    })
})
</script>

<template>
    <section id="home"
        class="hero-section min-h-screen flex items-center justify-center relative bg-white dark:bg-gray-900">
        <div class="absolute inset-0 z-1">
            <div class="floating-shape absolute top-20 left-10 w-32 h-32 bg-cyan-500/6 dark:bg-cyan-400/8 rounded-full">
            </div>
            <div
                class="floating-shape absolute top-40 right-20 w-24 h-24 bg-teal-500/6 dark:bg-teal-400/8 rounded-lg rotate-45">
            </div>
            <div
                class="floating-shape absolute bottom-40 left-1/4 w-16 h-16 bg-slate-500/6 dark:bg-slate-400/8 rounded-full">
            </div>
            <div
                class="floating-shape absolute bottom-20 right-1/3 w-20 h-20 bg-cyan-600/6 dark:bg-cyan-300/8 rounded-lg">
            </div>
        </div>

        <div class="container mx-auto px-4 text-center relative z-10">
            <div class="hero-card glass rounded-3xl p-12 max-w-4xl mx-auto floating-card">
                <div class="mb-8">
                    <span class="text-lg text-slate-600 dark:text-gray-400 font-mono">{{ typedGreeting }}</span>
                    <span class="animate-pulse">|</span>
                </div>

                <h1 class="text-5xl sm:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
                    <span class="gradient-text">Baker</span>
                    <br>
                    <span class="font-mono text-3xl sm:text-4xl lg:text-5xl">&lt;Alazzawi/&gt;</span>
                </h1>

                <div class="text-xl sm:text-2xl mb-8 text-slate-600 dark:text-gray-300">
                    <span class="font-mono bg-gradient-to-r from-cyan-700 to-teal-700 bg-clip-text text-transparent">
                        Full-Stack Developer
                    </span>
                    <span class="text-slate-400 mx-2">|</span>
                    <span class="font-mono bg-gradient-to-r from-teal-700 to-slate-700 bg-clip-text text-transparent">
                        AI Enthusiast
                    </span>
                </div>

                <p class="text-lg max-w-2xl mx-auto mb-12 text-slate-600 dark:text-gray-300 leading-relaxed">
                    Crafting digital experiences with code, creativity, and artificial intelligence.
                    Building the future one algorithm at a time.
                </p>

                <div class="flex flex-col sm:flex-row gap-6 justify-center">
                    <a href="#contact" class="hero-btn hero-btn-primary group">
                        <span class="flex items-center justify-center">
                            <ChatBubbleLeftRightIcon class="w-5 h-5 mr-2 group-hover:animate-pulse" />
                            Get In Touch
                        </span>
                    </a>
                    <a href="#experience" class="hero-btn hero-btn-secondary group">
                        <span class="flex items-center justify-center">
                            <BriefcaseIcon class="w-5 h-5 mr-2 group-hover:animate-pulse" />
                            View My Work
                        </span>
                    </a>
                </div>
            </div>

            <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                <ChevronDownIcon class="w-6 h-6 text-gray-400" />
            </div>
        </div>
    </section>
</template>

<style scoped>
.hero-btn {
    @apply px-8 py-4 rounded-full font-semibold text-base transition-all duration-300 transform hover:scale-105 min-w-[160px] text-center no-underline border-2 border-transparent relative overflow-hidden;
}

.hero-btn-primary {
    @apply bg-gradient-to-r from-cyan-700 to-teal-700 text-white shadow-lg;
    box-shadow: 0 4px 15px rgba(8, 145, 178, 0.25);
}

.hero-btn-primary:hover {
    @apply shadow-xl;
    box-shadow: 0 8px 25px rgba(8, 145, 178, 0.35);
    background: linear-gradient(135deg, #0e7490 0%, #0f766e 100%);
}

.hero-btn-secondary {
    @apply bg-transparent text-slate-700 dark:text-gray-300 border-cyan-600;
    position: relative;
}

.hero-btn-secondary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0891b2 0%, #0f766e 100%);
    transition: left 0.3s ease;
    z-index: -1;
    border-radius: inherit;
}

.hero-btn-secondary:hover {
    @apply text-white border-purple-500;
    transform: translateY(-2px) scale(1.05);
}

.hero-btn-secondary:hover::before {
    left: 0;
}

@media (max-width: 640px) {
    .hero-btn {
        @apply w-full max-w-xs;
    }
}
</style>
