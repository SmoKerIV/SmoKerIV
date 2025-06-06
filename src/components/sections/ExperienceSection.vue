<script setup lang="ts">
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SparklesIcon } from '@heroicons/vue/24/outline'

gsap.registerPlugin(ScrollTrigger)

const experiences = [
    {
        title: 'Software Developer',
        company: 'PureTik',
        period: 'Jun 2024 - Present',
        status: 'Current',
        achievements: [
            'Built comprehensive SaaS platforms using React and Next.js',
            'Developed major e-commerce platform for electronics company',
            'Implemented full-stack solutions with PostgreSQL and Prisma'
        ]
    },
    {
        title: 'Software Developer',
        company: 'Alrabiaa TV',
        period: 'Feb 2025 - Present',
        status: 'Current',
        achievements: [
            'Contributing to promising emerging project with significant growth potential',
            'Working on innovative media technology solutions'
        ]
    },
    {
        title: 'Front-End Developer & UI Designer',
        company: 'Makers of Baghdad',
        period: 'Jul 2023 - Aug 2023',
        status: 'Completed',
        achievements: [
            'Quality Assurance for IoTKIDS Website with focus on performance optimization',
            'Revamped UI using Figma to enhance design and user experience',
            'Developed entire project from scratch using ReactJS and Bootstrap'
        ]
    },
    {
        title: 'Archive Officer',
        company: 'ZainCash',
        period: 'Jan 2023 - Feb 2023',
        status: 'Completed',
        achievements: [
            'Managed archive system for app wallet platform',
            'Documented user information and ensured efficient data organization'
        ]
    }
]

const getStatusClass = (status: string) => {
    return status === 'Current'
        ? 'status-current'
        : 'status-completed'
}

const getStatusDotClass = (status: string) => {
    return status === 'Current'
        ? 'status-dot-current'
        : 'status-dot-completed'
}

onMounted(() => {
    gsap.set('.timeline-card', { opacity: 0, x: 100, scale: 0.9 })

    ScrollTrigger.batch('.timeline-card', {
        onEnter: (elements) => {
            gsap.to(elements, {
                opacity: 1,
                x: 0,
                scale: 1,
                duration: 0.8,
                stagger: 0.2,
                ease: "power2.out"
            })
        }
    })
})
</script>

<template>
    <section id="experience" class="py-20 bg-white dark:bg-gray-900">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold gradient-text mb-6">Experience Journey</h2>
                <p class="text-lg text-slate-700 dark:text-gray-300">My professional evolution in tech</p>
            </div>

            <div class="max-w-4xl mx-auto">
                <div v-for="(exp, index) in experiences" :key="index" class="timeline-item mb-12">
                    <div class="timeline-card glass rounded-2xl p-8 floating-card ml-8 experience-card">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-6">
                            <div class="flex-1">
                                <h3 class="text-xl font-bold mb-2 text-slate-800 dark:text-white">{{ exp.title }}</h3>
                                <p class="text-cyan-700 dark:text-cyan-400 font-semibold mb-2">{{ exp.company }}</p>
                                <p class="text-slate-600 dark:text-gray-400 text-sm">{{ exp.period }}</p>
                            </div>
                            <div class="mt-4 md:mt-0">
                                <span :class="getStatusClass(exp.status)" class="status-pill">
                                    <span class="status-dot" :class="getStatusDotClass(exp.status)"></span>
                                    {{ exp.status }}
                                </span>
                            </div>
                        </div>
                        <ul class="space-y-3 text-slate-700 dark:text-gray-300">
                            <li v-for="achievement in exp.achievements" :key="achievement" class="flex items-start">
                                <SparklesIcon class="w-4 h-4 text-yellow-500 mr-3 mt-1 flex-shrink-0" />
                                <span class="leading-relaxed">{{ achievement }}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.experience-card {
    @apply border-l-4 transition-all duration-300;
    border-left-color: #0891b2;
}

.experience-card:hover {
    @apply transform -translate-y-2;
    box-shadow: 0 10px 30px rgba(8, 145, 178, 0.12);
}

.status-pill {
    @apply inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-lg;
}

.status-current {
    @apply bg-gradient-to-r from-emerald-500 to-green-500 text-white;
    animation: pulse-glow 2s infinite;
}

.status-completed {
    @apply bg-gradient-to-r from-cyan-500 to-teal-500 text-white;
}

.status-dot {
    @apply w-2 h-2 rounded-full mr-2;
}

.status-dot-current {
    @apply bg-white;
    animation: pulse-dot 2s infinite;
}

.status-dot-completed {
    @apply bg-white opacity-80;
}

@keyframes pulse-glow {

    0%,
    100% {
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    }

    50% {
        box-shadow: 0 6px 25px rgba(16, 185, 129, 0.5);
    }
}

@keyframes pulse-dot {

    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.7;
        transform: scale(1.1);
    }
}

.timeline-item::before {
    background: linear-gradient(to bottom, #06b6d4, #0891b2);
}

.timeline-item::after {
    @apply bg-cyan-500 shadow-lg;
    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.2);
}
</style>
