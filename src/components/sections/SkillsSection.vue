<template>
    <section id="skills" class="py-20 bg-white dark:bg-gray-900 relative">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold gradient-text mb-6">Tech Arsenal</h2>
                <p class="text-lg text-slate-700 dark:text-gray-300">Weapons of choice in the digital battlefield</p>
            </div>

            <!-- Skills Grid with Placeholder Icons -->
            <!-- 
        To replace with your own SVG icons:
        1. Replace the icon component functions above with your SVG content
        2. Each icon has a data-tech attribute for easy identification
        3. Use the same component structure but replace the placeholder div with your SVG
        
        Example replacement:
        const ReactIcon = () => h('svg', {
          viewBox: '0 0 24 24',
          class: 'w-8 h-8',
          fill: '#61DAFB'
        }, [
          // Your SVG path content here
        ])
      -->
            <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 max-w-6xl mx-auto mb-16">
                <div v-for="skill in skills" :key="skill.name" class="skill-hex floating-card">
                    <div class="skill-hex-content">
                        <div class="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                            <!-- Replace these placeholder icons with your SVG icons -->
                            <Icon :icon="skill.icon" class="w-8 h-8" />
                        </div>
                        <p class="text-xs font-semibold text-slate-700 dark:text-white text-center">{{ skill.name }}</p>
                    </div>
                </div>
            </div>

            <!-- Skill Categories -->
            <div class="mt-20 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div v-for="category in skillCategories" :key="category.title"
                    class="skill-category glass rounded-2xl p-6 floating-card">
                    <h3 class="text-xl font-bold gradient-text mb-4">{{ category.title }}</h3>
                    <div class="flex flex-wrap gap-2">
                        <span v-for="skill in category.skills" :key="skill"
                            class="px-3 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded-full text-sm font-medium">
                            {{ skill }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Icon } from '@iconify/vue'

gsap.registerPlugin(ScrollTrigger)

// Skills array with Iconify icons
const skills = [
    { name: 'React', icon: 'logos:react', color: '#61DAFB' },
    { name: 'Vue.js', icon: 'logos:vue', color: '#4FC08D' },
    { name: 'Next.js', icon: 'logos:nextjs-icon', color: '#000000' },
    { name: 'TypeScript', icon: 'logos:typescript-icon', color: '#3178C6' },
    { name: 'JavaScript', icon: 'logos:javascript', color: '#F7DF1E' },
    { name: 'Python', icon: 'logos:python', color: '#3776AB' },
    { name: 'Node.js', icon: 'logos:nodejs-icon', color: '#339933' },
    { name: 'Express.js', icon: 'skill-icons:expressjs-dark', color: '#000000' },
    { name: 'MongoDB', icon: 'logos:mongodb-icon', color: '#47A248' },
    { name: 'PostgreSQL', icon: 'logos:postgresql', color: '#336791' },
    { name: 'Docker', icon: 'logos:docker-icon', color: '#2496ED' },
    { name: 'Git', icon: 'logos:git-icon', color: '#F05032' },
    { name: 'HTML5', icon: 'logos:html-5', color: '#E34F26' },
    { name: 'CSS3', icon: 'logos:css-3', color: '#1572B6' },
    { name: 'Tailwind', icon: 'logos:tailwindcss-icon', color: '#06B6D4' },
    { name: 'AWS', icon: 'logos:aws', color: '#FF9900' },
]

const skillCategories = [
    {
        title: 'Frontend',
        skills: ['React', 'Vue.js', 'Next.js', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Tailwind CSS']
    },
    {
        title: 'Backend',
        skills: ['Node.js', 'Express.js', 'Python', 'PostgreSQL', 'MongoDB', 'Prisma', 'REST APIs']
    },
    {
        title: 'Tools & Others',
        skills: ['Docker', 'AWS', 'Git', 'GitHub', 'Figma', 'VS Code', 'Linux', 'CI/CD']
    }
]

onMounted(() => {
    gsap.set('.skill-hex', { opacity: 0, scale: 0.5 })
    gsap.set('.skill-category', { opacity: 0, y: 50 })

    ScrollTrigger.batch('.skill-hex', {
        onEnter: (elements) => {
            gsap.to(elements, {
                opacity: 1,
                scale: 1,
                duration: 0.6,
                stagger: 0.1,
                ease: "back.out(1.7)"
            })
        }
    })

    ScrollTrigger.batch('.skill-category', {
        onEnter: (elements) => {
            gsap.to(elements, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: "power2.out"
            })
        }
    })
})
</script>

<style scoped>
.skill-hex {
    width: 120px;
    height: 120px;
    position: relative;
    margin: 30px auto;
}

.skill-hex::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0891b2 0%, #0f766e 100%);
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    transition: all 0.3s ease;
}

.skill-hex:hover::before {
    box-shadow: 0 10px 30px rgba(8, 145, 178, 0.25);
    transform: scale(1.1) rotate(10deg);
}

.skill-hex-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 2;
}

.skill-hex-content>div {
    transition: all 0.3s ease;
}

.skill-hex:hover .skill-hex-content>div {
    transform: scale(1.1);
}

.skill-hex-content svg {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.dark .skill-hex-content svg {
    filter: drop-shadow(0 2px 4px rgba(255, 255, 255, 0.1));
}

/* Ensure icons are visible in dark mode */
.dark .skill-hex-content svg[fill="currentColor"] {
    color: white;
}
</style>
