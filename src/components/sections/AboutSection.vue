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
    gsap.set('.tech-icon-custom', { opacity: 0, scale: 0 })

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
                .to('.tech-icon-custom', {
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
    <section id="about" class="py-16 bg-white dark:bg-gray-900 relative">
        <div class="container mx-auto px-4">
            <div class="grid lg:grid-cols-2 gap-12 items-center"> <!-- Left: Interactive Avatar/Visual -->
                <div class="about-visual relative p-6 about-visual-container">
                    <div class="about-card-custom glass rounded-2xl p-10 relative">
                        <div
                            class="code-circle bg-gradient-to-br from-cyan-700 via-teal-700 to-slate-700 rounded-2xl p-1 relative">
                            <div
                                class="code-inner bg-white dark:bg-gray-900 rounded-2xl h-full flex items-center justify-center relative">
                                <div class="code-symbol-large font-mono gradient-text select-none">&lt;/&gt;</div>
                            </div>
                        </div>

                        <!-- Floating tech icons -->
                        <div
                            class="tech-icon-custom tech-icon-react absolute w-12 h-12 glass rounded-xl flex items-center justify-center">
                            <span class="text-lg">⚛️</span>
                        </div>
                        <div
                            class="tech-icon-custom tech-icon-rocket absolute w-12 h-12 glass rounded-xl flex items-center justify-center">
                            <span class="text-lg">🚀</span>
                        </div>
                    </div>
                </div>

                <!-- Right: About Content -->
                <div class="about-content space-y-6">
                    <div>
                        <h2 class="text-3xl lg:text-4xl font-bold mb-4 gradient-text break-words">About Me</h2>
                        <p
                            class="text-base lg:text-lg text-slate-700 dark:text-gray-300 leading-relaxed mb-4 break-words">
                            I'm a passionate developer who bridges the gap between artificial intelligence and practical
                            web solutions.
                            With a Computer Science background and hands-on experience at PureTik, I transform complex
                            problems into elegant code.
                        </p>
                        <p
                            class="text-base lg:text-lg text-slate-700 dark:text-gray-300 leading-relaxed mb-4 break-words">
                            My passion lies in combining AI knowledge with practical web development skills to create
                            meaningful solutions. I'm committed to continuous learning and contributing to innovative
                            projects in both AI and web development domains.
                        </p>
                    </div> <!-- Stats cards -->
                    <div class="grid grid-cols-2 gap-4">
                        <div v-for="stat in stats" :key="stat.label"
                            class="stat-card glass rounded-xl p-4 text-center stat-card-custom">
                            <div class="text-2xl lg:text-3xl font-bold gradient-text mb-1">{{ stat.value }}</div>
                            <div class="text-xs lg:text-sm text-slate-600 dark:text-gray-400">{{ stat.label }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
/* Complete override to fix overflow and z-index issues */
.about-visual-container {
    overflow: visible !important;
    position: relative;
    z-index: 1;
}

.about-card-custom {
    overflow: visible !important;
    position: relative;
    z-index: 1;
    transform: translateZ(0);
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.about-card-custom:hover {
    transform: translateY(-8px) scale(1.01);
    box-shadow: 0 15px 30px rgba(15, 23, 42, 0.12);
}

.dark .about-card-custom:hover {
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
}

.code-circle {
    width: 100%;
    aspect-ratio: 1;
    overflow: visible !important;
    position: relative;
}

.code-inner {
    overflow: visible !important;
    position: relative;
    width: 100%;
    height: 100%;
}

.code-symbol-large {
    position: relative;
    z-index: 100 !important;
    overflow: visible !important;
    line-height: 0.8;
    white-space: nowrap;
    display: block;
    font-size: 3rem;
    transform: translateZ(0);
    /* Force visibility */
    visibility: visible !important;
    opacity: 1 !important;
    /* Prevent any clipping */
    clip: unset !important;
    clip-path: none !important;
}

/* Tech icons with custom positioning */
.tech-icon-custom {
    position: absolute;
    z-index: 101 !important;
    transition: all 0.3s ease;
}

.tech-icon-custom:hover {
    transform: scale(1.1);
}

.tech-icon-react {
    top: -0.75rem;
    right: -0.75rem;
}

.tech-icon-rocket {
    bottom: -0.75rem;
    left: -0.75rem;
}

/* Content area styling */
.about-content {
    min-width: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    position: relative;
    z-index: 1;
}

.about-content h2,
.about-content p {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* Responsive font sizes for code symbol */
@media (min-width: 1536px) {
    .code-symbol-large {
        font-size: 4.5rem;
    }
}

@media (min-width: 1280px) and (max-width: 1535px) {
    .code-symbol-large {
        font-size: 4rem;
    }
}

@media (min-width: 1024px) and (max-width: 1279px) {
    .code-symbol-large {
        font-size: 3.5rem;
    }
}

@media (min-width: 768px) and (max-width: 1023px) {
    .code-symbol-large {
        font-size: 3rem;
    }
}

@media (min-width: 640px) and (max-width: 767px) {
    .code-symbol-large {
        font-size: 2.5rem;
    }
}

@media (max-width: 639px) {
    .code-symbol-large {
        font-size: 2rem;
    }
}

@media (max-width: 480px) {
    .code-symbol-large {
        font-size: 1.75rem;
    }

    .about-card-custom {
        padding: 1rem !important;
    }

    .tech-icon-custom {
        width: 2.5rem !important;
        height: 2.5rem !important;
    }

    .tech-icon-custom span {
        font-size: 1rem !important;
    }

    .tech-icon-react {
        top: -0.5rem;
        right: -0.5rem;
    }

    .tech-icon-rocket {
        bottom: -0.5rem;
        left: -0.5rem;
    }
}

/* Section isolation */
#about {
    position: relative;
    isolation: isolate;
    overflow-x: hidden;
}

/* Override any global animations that might interfere */
.about-visual {
    position: relative;
    z-index: 1;
}

.about-content {
    position: relative;
    z-index: 1;
}

/* Ensure GSAP animations target the right elements */
.tech-icon-custom {
    opacity: 1;
    transform: scale(1);
}

/* Additional safeguards */
.about-card-custom * {
    box-sizing: border-box;
}

.code-circle,
.code-inner,
.code-symbol-large {
    pointer-events: none;
}

.tech-icon-custom {
    pointer-events: auto;
}

/* Custom stat cards */
.stat-card-custom {
    transform: translateZ(0);
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
}

.stat-card-custom:hover {
    transform: translateY(-6px) scale(1.01);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
}

.dark .stat-card-custom:hover {
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
}
</style>
