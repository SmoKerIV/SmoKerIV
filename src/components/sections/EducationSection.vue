<script setup lang="ts">
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AcademicCapIcon, CodeBracketIcon } from '@heroicons/vue/24/outline'

gsap.registerPlugin(ScrollTrigger)

const education = [
    {
        degree: 'Bachelor\'s in Computer Science',
        institution: 'University of Technology · Artificial Intelligence Specialization',
        period: '2020 - 2024',
        icon: AcademicCapIcon,
        iconBg: 'bg-gradient-to-br from-cyan-600 to-teal-600',
        institutionColor: 'text-cyan-700 dark:text-cyan-400',
        highlights: [
            'Specialized in Artificial Intelligence with focus on machine learning and data analysis',
            'Developed age estimation program using Support Vector Machines (SVM) in Python for graduation project',
            'Applied AI techniques to achieve accurate predictions and enhance ML algorithm understanding'
        ]
    },
    {
        degree: 'Full-Stack Web Development Bootcamp',
        institution: 'Aon.iq',
        period: 'Oct 2023 - Feb 2024',
        icon: CodeBracketIcon,
        iconBg: 'bg-gradient-to-br from-emerald-600 to-green-600',
        institutionColor: 'text-emerald-700 dark:text-emerald-400',
        highlights: [
            'Intensive in-person course covering HTML, CSS, JavaScript fundamentals',
            'Advanced front-end frameworks: React.js and Next.js',
            'Back-end technologies: Node.js and Express.js',
            'Weekly graded tasks under mentorship',
            'Independently developed full-stack website from inception to production'
        ]
    }
]

onMounted(() => {
    gsap.set('.education-card', { opacity: 0, y: 80, scale: 0.95 })

    ScrollTrigger.batch('.education-card', {
        onEnter: (elements) => {
            gsap.to(elements, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                stagger: 0.2,
                ease: "power2.out"
            })
        }
    })
})
</script>

<template>    <!-- Education Section -->
    <section id="education" class="py-20 bg-white dark:bg-gray-900 overflow-hidden">
        <div class="container mx-auto px-4 max-w-full">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold gradient-text mb-6 break-words">Education & Learning</h2>
                <p class="text-lg text-slate-700 dark:text-gray-300 break-words">Academic foundation and continuous development</p>
            </div>

            <div class="max-w-4xl mx-auto space-y-8 overflow-hidden">
                <div v-for="(edu, index) in education" :key="index"
                    class="education-card glass rounded-2xl p-8 floating-card">
                    <div class="flex items-start space-x-4 overflow-hidden">
                        <div class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                            :class="edu.iconBg">
                            <component :is="edu.icon" class="w-6 h-6 text-white" />
                        </div>
                        <div class="flex-1 min-w-0 overflow-hidden">
                            <h3 class="text-xl font-bold mb-2 text-slate-800 dark:text-white break-words">{{ edu.degree }}</h3>
                            <p class="font-semibold mb-2 break-words" :class="edu.institutionColor">{{ edu.institution }}</p>
                            <p class="text-slate-600 dark:text-gray-400 mb-4 break-words">{{ edu.period }}</p>
                            <ul class="space-y-2 text-slate-700 dark:text-gray-300 overflow-hidden">
                                <li v-for="highlight in edu.highlights" :key="highlight" class="flex items-start overflow-hidden">
                                    <span class="text-cyan-600 mr-2 mt-1 flex-shrink-0">•</span>
                                    <span class="break-words">{{ highlight }}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
