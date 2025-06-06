<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
    EnvelopeIcon,
    PhoneIcon,
    MapPinIcon,
    PaperAirplaneIcon
} from '@heroicons/vue/24/outline'

gsap.registerPlugin(ScrollTrigger)

const form = reactive({
    name: '',
    email: '',
    subject: '',
    message: ''
})

const contactMethods = [
    {
        type: 'Email',
        value: 'baker.alazzawi0@gmail.com',
        href: 'mailto:baker.alazzawi0@gmail.com',
        icon: EnvelopeIcon
    },
    {
        type: 'Phone',
        value: '+964-773-098-2555',
        href: 'tel:+9647730982555',
        icon: PhoneIcon
    },
    {
        type: 'Location',
        value: 'Baghdad, Iraq',
        href: '#',
        icon: MapPinIcon
    }
]

const sendMessage = () => {
    // Handle form submission
    alert('Thank you for your message! I\'ll get back to you soon.')
    Object.assign(form, { name: '', email: '', subject: '', message: '' })
}

onMounted(() => {
    gsap.set('.contact-card', { opacity: 0, y: 80, scale: 0.9 })
    gsap.set('.contact-form', { opacity: 0, y: 100 })

    ScrollTrigger.create({
        trigger: '#contact',
        start: 'top 80%',
        onEnter: () => {
            gsap.to('.contact-card', {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                stagger: 0.15,
                ease: "power2.out"
            })

            gsap.to('.contact-form', {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: "power2.out",
                delay: 0.3
            })
        }
    })
})
</script>

<template>
    <section id="contact" class="py-20 bg-white dark:bg-gray-900">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold gradient-text mb-6">Let's Build Something Amazing</h2>
                <p class="text-lg text-slate-700 dark:text-gray-300">Ready to turn ideas into reality? Let's connect!
                </p>
            </div>

            <div class="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
                <a v-for="contact in contactMethods" :key="contact.type" :href="contact.href"
                    class="contact-card glass rounded-2xl p-8 text-center floating-card contact-method-card group">
                    <div
                        class="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center">
                        <component :is="contact.icon"
                            class="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 class="text-xl font-bold mb-2 gradient-text">{{ contact.type }}</h3>
                    <p class="text-slate-700 dark:text-gray-300">{{ contact.value }}</p>
                </a>
            </div>

            <div class="max-w-2xl mx-auto">
                <div class="contact-form glass rounded-2xl p-8 floating-card">
                    <h3 class="text-2xl font-bold gradient-text mb-6 text-center">Send me a message</h3>
                    <form @submit.prevent="sendMessage" class="space-y-6">
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <label
                                    class="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">Name</label>
                                <input v-model="form.name" type="text" required class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-gray-600 
                              bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm text-slate-800 dark:text-white
                              focus:ring-2 focus:ring-cyan-500 focus:border-transparent 
                              transition-all duration-200">
                            </div>
                            <div>
                                <label
                                    class="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">Email</label>
                                <input v-model="form.email" type="email" required class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-gray-600 
                              bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm text-slate-800 dark:text-white
                              focus:ring-2 focus:ring-cyan-500 focus:border-transparent 
                              transition-all duration-200">
                            </div>
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">Subject</label>
                            <input v-model="form.subject" type="text" required class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-gray-600 
                            bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm text-slate-800 dark:text-white
                            focus:ring-2 focus:ring-cyan-500 focus:border-transparent 
                            transition-all duration-200">
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">Message</label>
                            <textarea v-model="form.message" required rows="5" class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-gray-600 
                               bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm text-slate-800 dark:text-white
                               focus:ring-2 focus:ring-cyan-500 focus:border-transparent 
                               transition-all duration-200 resize-none"></textarea>
                        </div>
                        <button type="submit" class="morph-btn w-full">
                            <span class="flex items-center justify-center">
                                <PaperAirplaneIcon class="w-5 h-5 mr-2" />
                                Send Message
                            </span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.contact-method-card {
    transition: all 0.3s ease;
    box-shadow: 0 6px 20px rgba(8, 145, 178, 0.15);
}

.contact-method-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 12px 35px rgba(8, 145, 178, 0.20);
}

.dark .contact-method-card {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.dark .contact-method-card:hover {
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
}
</style>
