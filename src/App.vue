<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { gsap } from "gsap";
import LoaderComponent from "./components/LoaderComponent.vue";
import HomeView from "./components/HomeView.vue";
import ExperienceView from "./components/ExperienceView.vue";
import ContactView from "./components/ContactView.vue";

const isLoading = ref(true);
const activeTab = ref<"hero" | "experience" | "contact">("hero");
const showIde = ref(false);
const easterEggTriggered = ref(false);
const ideRef = ref<HTMLDivElement | null>(null);
const konami = ref<string[]>([]);
const isLight = ref(false);
let keyBuffer = "";
let bufferTimeout: ReturnType<typeof setTimeout>;

const tabs = [
  { id: "hero" as const, label: "Hero.tsx", icon: "TS" },
  { id: "experience" as const, label: "Experience.tsx", icon: "TS" },
  { id: "contact" as const, label: "Contact.tsx", icon: "TS" },
];

const switchTab = (id: "hero" | "experience" | "contact") => {
  activeTab.value = id;
};

const closeTab = (id: string, e: Event) => {
  e.stopPropagation();
  const remaining = tabs.filter((t) => t.id !== id);
  if (remaining.length > 0 && activeTab.value === id) {
    activeTab.value = remaining[0].id;
  }
};

// Easter egg: Konami code → shows a fun console message
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

// Easter egg: Ctrl+Shift+P opens "command palette" alert
const handleKeyDown = (e: KeyboardEvent) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return;

  // Konami code
  konami.value.push(e.key);
  if (konami.value.length > KONAMI.length) konami.value.shift();
  if (
    konami.value.length === KONAMI.length &&
    konami.value.every((k, i) => k === KONAMI[i])
  ) {
    easterEggTriggered.value = true;
    konami.value = [];
    setTimeout(() => {
      easterEggTriggered.value = false;
    }, 3000);
  }

  // Ctrl+Shift+P "command palette"
  if (e.ctrlKey && e.shiftKey && e.key === "P") {
    e.preventDefault();
    console.log(
      "%c> Baker Alazzawi: Thanks for checking out my portfolio! 🎮",
      "color: #dcdcaa; background: #1e1e1e; font-size: 16px; padding: 8px; font-family: 'JetBrains Mono', monospace;",
    );
  }

  // Light/dark easter egg
  keyBuffer += e.key.toLowerCase();
  clearTimeout(bufferTimeout);
  bufferTimeout = setTimeout(() => {
    keyBuffer = "";
  }, 2000);
  if (keyBuffer.includes("light")) {
    isLight.value = true;
    keyBuffer = "";
  } else if (keyBuffer.includes("dark")) {
    isLight.value = false;
    keyBuffer = "";
  }
};

const currentTime = ref("");
const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const branchName = computed(() => "main");
const fileSize = computed(() => {
  const sizes: Record<string, string> = {
    hero: "2.4 KB",
    experience: "3.1 KB",
    contact: "1.8 KB",
  };
  return sizes[activeTab.value];
});

let timeInterval: ReturnType<typeof setInterval>;

onMounted(() => {
  setTimeout(() => {
    isLoading.value = false;
    showIde.value = true;
    nextTick(() => {
      if (ideRef.value) {
        gsap.fromTo(
          ideRef.value,
          { opacity: 0, scale: 0.98 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" },
        );
      }
    });
  }, 1500);

  window.addEventListener("keydown", handleKeyDown);
  updateTime();
  timeInterval = setInterval(updateTime, 30000);

  console.log(
    "%c🎮 Easter eggs hidden in this portfolio. Can you find them all?",
    "color: #569cd6; font-size: 13px; font-family: 'JetBrains Mono', monospace;",
  );
  console.log(
    '%c   hint: try Ctrl+Shift+P, the Konami code, or type "light"...',
    "color: #6a9955; font-size: 12px; font-family: 'JetBrains Mono', monospace;",
  );
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  clearInterval(timeInterval);
  clearTimeout(bufferTimeout);
});
</script>

<template>
  <LoaderComponent v-if="isLoading" />
  <div
    v-else-if="showIde"
    ref="ideRef"
    class="ide-shell h-screen flex flex-col text-sm overflow-hidden transition-colors duration-500"
    :class="isLight ? 'bg-[#ffffff]' : 'bg-[#1e1e1e]'"
    style="opacity: 0"
  >
    <!-- Title Bar -->
    <div
      class="flex items-center justify-between h-8 px-3 text-xs select-none shrink-0 transition-colors duration-500"
      :class="
        isLight ? 'bg-[#dddddd] text-[#333333]' : 'bg-[#323233] text-[#cccccc]'
      "
    >
      <div class="flex items-center gap-2">
        <span class="hidden sm:inline">Baker Alazzawi — Portfolio</span>
        <span class="sm:hidden">Portfolio</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-70"></div>
        <div class="w-3 h-3 rounded-full bg-[#28c840] opacity-70"></div>
        <div class="w-3 h-3 rounded-full bg-[#ff5f57] opacity-70"></div>
      </div>
    </div>

    <!-- Tab Bar -->
    <div
      class="flex items-end overflow-x-auto shrink-0 transition-colors duration-500"
      :class="
        isLight
          ? 'bg-[#ececec] border-b border-[#ffffff]'
          : 'bg-[#252526] border-b border-[#1e1e1e]'
      "
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="switchTab(tab.id)"
        class="group flex items-center gap-2 px-4 py-2 text-xs transition-colors whitespace-nowrap"
        :class="[
          isLight ? 'border-r border-[#ffffff]' : 'border-r border-[#1e1e1e]',
          activeTab === tab.id
            ? isLight
              ? 'bg-[#ffffff] text-[#333333] border-t-2 border-t-[#007acc]'
              : 'bg-[#1e1e1e] text-[#ffffff] border-t-2 border-t-[#007acc]'
            : isLight
              ? 'bg-[#ececec] text-[#888888] hover:bg-[#e0e0e0] border-t-2 border-t-transparent'
              : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80 border-t-2 border-t-transparent',
        ]"
      >
        <span
          class="text-[10px] font-bold px-1 py-0.5 rounded"
          :class="activeTab === tab.id ? 'text-[#519aba]' : 'text-[#519aba]/60'"
          >TS</span
        >
        <span>{{ tab.label }}</span>
        <span
          @click="closeTab(tab.id, $event)"
          class="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] rounded px-1 transition-opacity"
          >×</span
        >
      </button>
    </div>

    <!-- Breadcrumb -->
    <div
      class="flex items-center gap-1 px-4 py-1 text-[11px] border-b shrink-0 transition-colors duration-500"
      :class="
        isLight
          ? 'bg-[#ffffff] text-[#888888] border-[#e0e0e0]'
          : 'bg-[#1e1e1e] text-[#969696] border-[#2d2d2d]'
      "
    >
      <span>src</span>
      <span class="text-[#555]">&gt;</span>
      <span>components</span>
      <span class="text-[#555]">&gt;</span>
      <span :class="isLight ? 'text-[#333333]' : 'text-[#cccccc]'">{{
        tabs.find((t) => t.id === activeTab)?.label
      }}</span>
    </div>

    <!-- Editor Area -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Line gutters + code -->
      <div class="flex-1 overflow-y-auto editor-scroll relative">
        <HomeView v-if="activeTab === 'hero'" />
        <ExperienceView v-else-if="activeTab === 'experience'" />
        <ContactView v-else-if="activeTab === 'contact'" />

        <!-- Minimap -->
        <div class="minimap hidden md:block"></div>
      </div>
    </div>

    <!-- Easter egg overlay -->
    <Transition name="fade">
      <div
        v-if="easterEggTriggered"
        class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      >
        <div class="text-4xl md:text-6xl animate-bounce">🎮 +30 XP</div>
      </div>
    </Transition>

    <!-- Status Bar -->
    <div
      class="flex items-center justify-between h-6 bg-[#007acc] text-white text-[11px] px-3 select-none shrink-0"
    >
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14.5 3.5L5 13 1.5 9.5l1-1L5 11l8.5-8.5 1 1z" />
          </svg>
          {{ branchName }}
        </span>
        <span class="hidden sm:inline">0 errors · 0 warnings</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline">{{ fileSize }}</span>
        <span>TypeScript</span>
        <span>UTF-8</span>
        <span>{{ currentTime }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
