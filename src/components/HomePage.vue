/* eslint-disable */
<template>
  <main class="relative">
    <!-- Hero Section -->
    <section id="home" class="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div class="animate-fade-in-up">
          <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight">
            Hi, I'm <span class="gradient-text">Baker Alazzawi</span>
          </h1>
          <p class="text-xl sm:text-2xl lg:text-3xl mb-8 opacity-80">
            Full-Stack Software Developer
          </p>
          <p class="text-lg sm:text-xl max-w-4xl mx-auto mb-8 leading-relaxed opacity-70">
            Computer Science graduate specializing in AI with professional experience in full-stack web development.
            Currently working at PureTik, building innovative SaaS solutions and e-commerce platforms.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a href="#contact" class="btn-primary">Get In Touch</a>
            <a href="#experience" class="btn-secondary">View Experience</a>
            <a href="mailto:baker.alazzawi0@gmail.com" class="btn-secondary">
              📧 baker.alazzawi0@gmail.com
            </a>
          </div>
          <div class="flex justify-center space-x-6 text-sm opacity-70">
            <span>📍 Baghdad, Iraq</span>
            <span>📱 +964-773-098-2555</span>
          </div>
        </div>
      </div>

      <!-- Background Animation -->
      <div class="absolute inset-0 overflow-hidden opacity-10">
        <div
          class="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob">
        </div>
        <div
          class="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000">
        </div>
        <div
          class="absolute bottom-20 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000">
        </div>
      </div>
    </section>

    <!-- About Section -->
    <section id="about" class="py-20 bg-gray-50 dark:bg-slate-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-6">About Me</h2>
          <p class="text-lg opacity-70 max-w-2xl mx-auto">
            Passionate about AI and web development with a strong foundation in computer science
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="space-y-6">
            <p class="text-lg leading-relaxed">
              I'm a recent Computer Science graduate from the University of Technology with a specialization
              in Artificial Intelligence. Currently working as a Software Developer at PureTik, I focus
              primarily on web development while exploring various innovative projects.
            </p>
            <p class="text-lg leading-relaxed">
              My passion lies in combining AI knowledge with practical web development skills to create
              meaningful solutions. I'm committed to continuous learning and contributing to innovative
              projects in both AI and web development domains.
            </p>
            <div class="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <h4 class="font-semibold text-blue-800 dark:text-blue-200 mb-3">Objective</h4>
              <p class="text-blue-700 dark:text-blue-300">
                Eager to contribute my skills and enthusiasm to innovative projects, leveraging my
                AI background and web development expertise to build impactful solutions.
              </p>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-700 p-8 rounded-2xl shadow-lg card-hover">
            <h3 class="text-2xl font-bold mb-6">Quick Facts</h3>
            <div class="space-y-4">
              <div class="flex justify-between">
                <span class="font-medium">Education:</span>
                <span>BS Computer Science (AI)</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Experience:</span>
                <span>1+ Years Professional</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Location:</span>
                <span>Baghdad, Iraq</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Languages:</span>
                <span>Arabic (Native), English (Fluent)</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Specialization:</span>
                <span>Full-Stack & AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Experience Section -->
    <section id="experience" class="py-20">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-6">Professional Experience</h2>
          <p class="text-lg opacity-70">My journey in software development</p>
        </div>

        <div class="max-w-4xl mx-auto space-y-8">
          <!-- Current Positions -->
          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover border-l-4 border-green-500">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold mb-2">Software Developer</h3>
                <p class="text-green-600 dark:text-green-400 font-semibold mb-2">PureTik · Full-Time</p>
                <p class="text-gray-600 dark:text-gray-400 mb-3">Jun 2024 - Present</p>
              </div>
              <span class="status-badge status-current">Current</span>
            </div>
            <ul class="space-y-3 text-gray-700 dark:text-gray-300">
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Built fully functional UI components during training, developing strong front-end skills
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Working on multiple SaaS projects as full-stack developer using React, Next.js, Prisma, PostgreSQL, and
                Electron.js
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Developed major e-commerce platform for leading electronics company, handling all development aspects
                from UI to hosting
              </li>
            </ul>
          </div>

          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover border-l-4 border-green-500">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold mb-2">Software Developer</h3>
                <p class="text-green-600 dark:text-green-400 font-semibold mb-2">Alrabiaa TV · Part-Time</p>
                <p class="text-gray-600 dark:text-gray-400 mb-3">Feb 2025 - Present</p>
              </div>
              <span class="status-badge status-current">Current</span>
            </div>
            <p class="text-gray-700 dark:text-gray-300">
              Contributing to a promising emerging project with significant growth potential
            </p>
          </div>

          <!-- Previous Positions -->
          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover border-l-4 border-blue-500">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold mb-2">Front-End Developer & UI Designer</h3>
                <p class="text-blue-600 dark:text-blue-400 font-semibold mb-2">Makers of Baghdad · Internship</p>
                <p class="text-gray-600 dark:text-gray-400 mb-3">Jul 2023 - Aug 2023</p>
              </div>
              <span class="status-badge status-completed">Completed</span>
            </div>
            <ul class="space-y-3 text-gray-700 dark:text-gray-300">
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Quality Assurance for IoTKIDS Website with focus on performance optimization
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Revamped UI using Figma to enhance design and user experience
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Developed entire project from scratch using ReactJS and Bootstrap
              </li>
            </ul>
          </div>

          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover border-l-4 border-gray-500">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold mb-2">Archive Officer</h3>
                <p class="text-gray-600 dark:text-gray-400 font-semibold mb-2">ZainCash · Full-Time</p>
                <p class="text-gray-600 dark:text-gray-400 mb-3">Jan 2023 - Feb 2023</p>
              </div>
              <span class="status-badge status-completed">Completed</span>
            </div>
            <ul class="space-y-3 text-gray-700 dark:text-gray-300">
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Managed archive system for app wallet platform
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-3 mt-1">▶</span>
                Documented user information and ensured efficient data organization
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Education Section -->
    <section id="education" class="py-20 bg-gray-50 dark:bg-slate-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-6">Education</h2>
          <p class="text-lg opacity-70">Academic background and professional training</p>
        </div>

        <div class="max-w-4xl mx-auto space-y-8">
          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover">
            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold mb-2">Bachelor's in Computer Science</h3>
                <p class="text-purple-600 dark:text-purple-400 font-semibold mb-2">University of Technology · Artificial
                  Intelligence Specialization</p>
                <p class="text-gray-600 dark:text-gray-400 mb-4">2020 - 2024</p>
                <ul class="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>• Specialized in Artificial Intelligence with focus on machine learning and data analysis</li>
                  <li>• Developed age estimation program using Support Vector Machines (SVM) in Python for graduation
                    project</li>
                  <li>• Applied AI techniques to achieve accurate predictions and enhance ML algorithm understanding
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg card-hover">
            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fill-rule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-3a2 2 0 00-2 2v2a2 2 0 002 2h3v1a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 5a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold mb-2">Full-Stack Web Development Bootcamp</h3>
                <p class="text-green-600 dark:text-green-400 font-semibold mb-2">Aon.iq</p>
                <p class="text-gray-600 dark:text-gray-400 mb-4">Oct 2023 - Feb 2024</p>
                <ul class="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>• Intensive in-person course covering HTML, CSS, JavaScript fundamentals</li>
                  <li>• Advanced front-end frameworks: React.js and Next.js</li>
                  <li>• Back-end technologies: Node.js and Express.js</li>
                  <li>• Weekly graded tasks under mentorship</li>
                  <li>• Independently developed full-stack website from inception to production</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Skills Section -->
    <section id="skills" class="py-20">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-6">Skills & Technologies</h2>
          <p class="text-lg opacity-70">Professional technical expertise</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div v-for="skill in skills" :key="skill.name" class="skill-card">
            <div class="text-3xl mb-3">{{ skill.icon }}</div>
            <h3 class="font-semibold mb-2">{{ skill.name }}</h3>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div class="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-1000"
                :style="`width: ${skill.level}%`"></div>
            </div>
            <span class="text-sm opacity-70 mt-2 block">{{ skill.level }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact Section -->
    <section id="contact" class="py-20 bg-gray-50 dark:bg-slate-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-6">Get In Touch</h2>
          <p class="text-lg opacity-70 max-w-2xl mx-auto">
            Ready to collaborate on innovative projects? Let's discuss opportunities in AI and web development!
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div class="space-y-8">
            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-2">Email</h3>
                <a href="mailto:baker.alazzawi0@gmail.com" class="text-blue-600 dark:text-blue-400 hover:underline">
                  baker.alazzawi0@gmail.com
                </a>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-2">Phone</h3>
                <a href="tel:+9647730982555" class="text-green-600 dark:text-green-400 hover:underline">
                  +964-773-098-2555
                </a>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-2">Location</h3>
                <p class="text-gray-600 dark:text-gray-400">Baghdad, Iraq</p>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                    clip-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-2">Professional Links</h3>
                <div class="flex flex-col space-y-2">
                  <a href="https://www.linkedin.com/in/baker-alazzawi-2a7453226/" target="_blank"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">LinkedIn
                    Profile</a>
                  <a href="https://github.com/SmoKerIV" target="_blank"
                    class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">GitHub
                    Portfolio</a>
                  <a href="https://www.instagram.com/smoker_iv/" target="_blank"
                    class="text-pink-600 hover:text-pink-800 dark:text-pink-400 dark:hover:text-pink-200">Instagram</a>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-700 p-8 rounded-2xl shadow-lg">
            <form @submit.prevent="sendMessage" class="space-y-6">
              <div>
                <label class="block text-sm font-medium mb-2">Name</label>
                <input v-model="form.name" type="text" required class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                              bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 
                              focus:border-transparent transition-all duration-200">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Email</label>
                <input v-model="form.email" type="email" required class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                              bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 
                              focus:border-transparent transition-all duration-200">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Message</label>
                <textarea v-model="form.message" required rows="4" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 
                                 focus:border-transparent transition-all duration-200"></textarea>
              </div>
              <button type="submit" class="btn-primary w-full">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

defineProps<{
  isDark: boolean
}>()

const form = reactive({
  name: '',
  email: '',
  message: ''
})

const skills = ref([
  { name: 'JavaScript', icon: '🟨', level: 90 },
  { name: 'React.js', icon: '⚛️', level: 85 },
  { name: 'Next.js', icon: '▲', level: 85 },
  { name: 'Vue.js', icon: '💚', level: 80 },
  { name: 'Nuxt.js', icon: '💚', level: 75 },
  { name: 'Node.js', icon: '🟢', level: 80 },
  { name: 'Express.js', icon: '🚀', level: 80 },
  { name: 'PostgreSQL', icon: '🐘', level: 75 },
  { name: 'SQLite', icon: '🗄️', level: 70 },
  { name: 'TailwindCSS', icon: '🎨', level: 90 },
  { name: 'Python', icon: '🐍', level: 75 },
  { name: 'Git', icon: '📝', level: 85 },
  { name: 'Postman API', icon: '📡', level: 80 },
  { name: 'Prisma', icon: '🔷', level: 75 },
  { name: 'AI/ML', icon: '🤖', level: 70 },
  { name: 'Figma', icon: '🎨', level: 75 }
])

const sendMessage = () => {
  alert('Thank you for your message! I\'ll get back to you soon.')
  Object.assign(form, { name: '', email: '', message: '' })
}
</script>

<style scoped>
.btn-primary {
  @apply px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl;
}

.btn-secondary {
  @apply px-8 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400 dark:hover:text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105;
}

.skill-card {
  @apply bg-white dark:bg-slate-700 p-6 rounded-xl shadow-lg text-center card-hover border border-gray-100 dark:border-gray-600;
}

.animate-fade-in-up {
  animation: fadeInUp 1s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }

  33% {
    transform: translate(30px, -50px) scale(1.1);
  }

  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }

  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

/* Professional hover effects */
.card-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-hover:hover {
  transform: translateY(-8px) scale(1.02);
}
</style>
