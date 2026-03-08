<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
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
const hireToast = ref(false);
const saveFlash = ref(false);
const showGitLog = ref(false);
const showSudoModal = ref(false);
const sudoInput = ref("");
const sudoHistory = ref<
  { cmd: string; output: string; type: "output" | "error" }[]
>([]);
const sudoInputEl = ref<HTMLInputElement | null>(null);
const terminalBodyRef = ref<HTMLElement | null>(null);
const matrixActive = ref(false);
const matrixText = ref("");
const rainbowActive = ref(false);
let matrixInterval: ReturnType<typeof setInterval> | null = null;

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

const closeWindow = () => window.close();

const openSudoModal = () => {
  showSudoModal.value = true;
  sudoHistory.value = [];
  sudoInput.value = "";
  nextTick(() => sudoInputEl.value?.focus());
};

const closeSudoModal = () => {
  showSudoModal.value = false;
  sudoInput.value = "";
};

const runCheatCode = () => {
  const cmd = sudoInput.value.trim();
  sudoInput.value = "";
  if (!cmd) return;
  const cmdLower = cmd.toLowerCase();
  const CODES: Record<
    string,
    { output: string; type: "output" | "error"; effect?: () => void }
  > = {
    help: {
      output:
        "Available cheat codes:\n  whoami           who are you?\n  ls               list project files\n  cat baker.json   inspect the developer\n  git status       check repo health\n  npm install      install the universe\n  uname -a         system info\n  hack             initiate hacking sequence\n  dance            make it groove\n  matrix           go deeper\n  flip             table flip mode\n  rainbow          taste the rainbow\n  coffee           ☕\n  rm -rf /         don't\n  42               the answer\n  exit             close terminal",
      type: "output",
    },
    whoami: {
      output:
        "baker\nUID=1337(baker) GID=1337(developers)\ngroups=1337(developers),0(caffeine),42(late-nights)",
      type: "output",
    },
    ls: {
      output:
        "Hero.tsx  Experience.tsx  Contact.tsx\neaster-eggs/  .secrets  node_modules/ (227,342 items)\nbaker-cv.pdf  coffee.ts  TODO.md (1,847 unresolved items)",
      type: "output",
    },
    "cat baker.json": {
      output:
        '{\n  "name": "Baker Alazzawi",\n  "version": "25.0.0",\n  "type": "human",\n  "bugs": [],\n  "features": ["ships fast", "fixes faster", "coffee-dependent"],\n  "uptime": "24/7 (excluding coffee breaks)"\n}',
      type: "output",
    },
    "git status": {
      output:
        "On branch main\nYour branch is ahead of 'origin/main' by \u221e commits.\n\nChanges not staged:\n  modified:  life.ts\n  deleted:   free-time.ts\n  added:     more-side-projects.ts\n\nnothing to commit (but plenty to ship)",
      type: "output",
    },
    "npm install": {
      output:
        "added 847,291 packages in 0.3s\n\n\u26a0  found 0 vulnerabilities (suspicious)\n\u2713 node_modules now weighs more than the observable universe",
      type: "output",
    },
    "uname -a": {
      output:
        "BakerOS 25.0.0-coffee #1 SMP PREEMPT x86_64 GNU/Linux\nKernel: caffeine-powered  Uptime: too long  Load avg: maximum",
      type: "output",
    },
    "42": {
      output:
        "The answer to life, the universe, and everything.\n(also: the number of npm packages needed to center a div)",
      type: "output",
    },
    "rm -rf /": {
      output:
        "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\nbash: permission denied \u2014 nice try though \ud83d\ude04",
      type: "error",
    },
    coffee: {
      output:
        "\u2615 Brewing...\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%\nCaffeine level: MAXIMUM\nProductivity: 9000x\nWarning: may cause 3am coding sessions",
      type: "output",
    },
    hack: {
      output:
        "Initializing hack sequence...\nAccessing mainframe... \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%\nFirewall: bypassed\nTarget acquired: your attention\nStatus: you've been rickrolled\n\n> never gonna give you up...",
      type: "output",
    },
    dance: {
      output:
        "( \u2022_\u2022)\n( \u2022_\u2022)>\u2310\u25a0-\u25a0\n(\u2310\u25a0-\u25a0)  yeahhh",
      type: "output",
      effect: () => {
        setTimeout(() => closeSudoModal(), 600);
        if (ideRef.value) {
          gsap.to(ideRef.value, {
            x: -8,
            duration: 0.08,
            repeat: 11,
            yoyo: true,
            ease: "power1.inOut",
            onComplete: () => { gsap.set(ideRef.value!, { x: 0 }); },
          });
        }
      },
    },
    matrix: {
      output:
        "Wake up, Baker...\nThe Matrix has you...\nFollow the white rabbit. \ud83d\udc07\n\n[launching in 1s]",
      type: "output",
      effect: () => {
        setTimeout(() => {
          closeSudoModal();
          matrixActive.value = true;
          setTimeout(() => {
            matrixActive.value = false;
          }, 6000);
        }, 800);
      },
    },
    flip: {
      output:
        "( \u256f\u00b0\u25a1\u00b0\uff09\u256f \ufe35  \u253b\u2501\u253b",
      type: "output",
      effect: () => {
        setTimeout(() => closeSudoModal(), 400);
        if (ideRef.value) {
          gsap.to(ideRef.value, {
            rotationY: 360,
            duration: 0.8,
            ease: "power2.inOut",
            onComplete: () => { gsap.set(ideRef.value!, { rotationY: 0 }); },
          });
        }
      },
    },
    rainbow: {
      output: "\ud83c\udf08 Rainbow mode activated for 5 seconds...",
      type: "output",
      effect: () => {
        rainbowActive.value = true;
        setTimeout(() => {
          rainbowActive.value = false;
        }, 5000);
      },
    },
    exit: {
      output: "logout\nConnection to baker-portfolio closed.",
      type: "output",
      effect: () => {
        setTimeout(() => closeSudoModal(), 500);
      },
    },
  };
  const result = CODES[cmdLower];
  if (result) {
    sudoHistory.value.push({ cmd, output: result.output, type: result.type });
    result.effect?.();
  } else {
    sudoHistory.value.push({
      cmd,
      output: `bash: ${cmd}: command not found\nType 'help' for available commands.`,
      type: "error",
    });
  }
  nextTick(() => {
    if (terminalBodyRef.value)
      terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight;
    sudoInputEl.value?.focus();
  });
};

watch(matrixActive, (val) => {
  if (val) {
    const chars =
      "\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd0123456789ABCDEF<>{}[]/\\|?!@#$%";
    matrixInterval = setInterval(() => {
      const cols = Math.floor(window.innerWidth / 10);
      const rows = Math.floor(window.innerHeight / 16);
      matrixText.value = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () =>
          Math.random() > 0.65
            ? chars[Math.floor(Math.random() * chars.length)]
            : " ",
        ).join(""),
      ).join("\n");
    }, 80);
  } else {
    if (matrixInterval) clearInterval(matrixInterval);
    matrixText.value = "";
  }
});

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

// Easter egg: Shift+B opens "command palette" alert
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

  // Shift+B  "command palette"
  if (e.shiftKey && e.key === "b") {
    e.preventDefault();
    console.log(
      "%c> Baker Alazzawi: Thanks for checking out my portfolio! 🎮",
      "color: #dcdcaa; background: #1e1e1e; font-size: 16px; padding: 8px; font-family: 'JetBrains Mono', monospace;",
    );
  }

  // Ctrl+S → fake save feedback in status bar
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveFlash.value = true;
    setTimeout(() => {
      saveFlash.value = false;
    }, 2000);
  }

  // Light/dark/hire easter egg key buffer
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
  } else if (keyBuffer.includes("hire")) {
    hireToast.value = true;
    keyBuffer = "";
  } else if (keyBuffer.includes("sudo")) {
    openSudoModal();
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
    '%c   hint: try Shift+B, Konami code, Ctrl+S, type "light" or "hire"...',
    "color: #6a9955; font-size: 12px; font-family: 'JetBrains Mono', monospace;",
  );
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  clearInterval(timeInterval);
  clearTimeout(bufferTimeout);
  if (matrixInterval) clearInterval(matrixInterval);
});
</script>

<template>
  <LoaderComponent v-if="isLoading" />
  <div v-else-if="showIde" ref="ideRef"
    class="ide-shell h-screen flex flex-col text-sm overflow-hidden transition-colors duration-500"
    :class="isLight ? 'bg-[#ffffff]' : 'bg-[#1e1e1e]'" style="opacity: 0">
    <!-- Title Bar -->
    <div class="flex items-center justify-between h-8 px-3 text-xs select-none shrink-0 transition-colors duration-500"
      :class="isLight ? 'bg-[#dddddd] text-[#333333]' : 'bg-[#323233] text-[#cccccc]'
        ">
      <div class="flex items-center gap-2">
        <span class="hidden sm:inline">Baker Alazzawi — Portfolio</span>
        <span class="sm:hidden">Portfolio</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-70"></div>
        <div class="w-3 h-3 rounded-full bg-[#28c840] opacity-70"></div>
        <button @click="closeWindow"
          class="w-3 h-3 rounded-full bg-[#ff5f57] opacity-70 hover:opacity-100 transition-opacity cursor-pointer"></button>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="flex items-end overflow-x-auto shrink-0 transition-colors duration-500" :class="isLight
        ? 'bg-[#ececec] border-b border-[#ffffff]'
        : 'bg-[#252526] border-b border-[#1e1e1e]'
      ">
      <button v-for="tab in tabs" :key="tab.id" @click="switchTab(tab.id)"
        class="group flex items-center gap-2 px-4 py-2 text-xs transition-colors whitespace-nowrap" :class="[
          isLight ? 'border-r border-[#ffffff]' : 'border-r border-[#1e1e1e]',
          activeTab === tab.id
            ? isLight
              ? 'bg-[#ffffff] text-[#333333] border-t-2 border-t-[#007acc]'
              : 'bg-[#1e1e1e] text-[#ffffff] border-t-2 border-t-[#007acc]'
            : isLight
              ? 'bg-[#ececec] text-[#888888] hover:bg-[#e0e0e0] border-t-2 border-t-transparent'
              : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80 border-t-2 border-t-transparent',
        ]">
        <span class="text-[10px] font-bold px-1 py-0.5 rounded"
          :class="activeTab === tab.id ? 'text-[#519aba]' : 'text-[#519aba]/60'">TS</span>
        <span>{{ tab.label }}</span>
        <span @click="closeTab(tab.id, $event)"
          class="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] rounded px-1 transition-opacity">×</span>
      </button>
    </div>

    <!-- Breadcrumb -->
    <div class="flex items-center gap-1 px-4 py-1 text-[11px] border-b shrink-0 transition-colors duration-500" :class="isLight
        ? 'bg-[#ffffff] text-[#888888] border-[#e0e0e0]'
        : 'bg-[#1e1e1e] text-[#969696] border-[#2d2d2d]'
      ">
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

    <!-- Matrix overlay -->
    <Transition name="fade">
      <div v-if="matrixActive"
        class="fixed inset-0 z-40 pointer-events-none bg-black/90 overflow-hidden font-mono text-[#00ff41] text-[11px] leading-4 select-none">
        <pre class="p-1 opacity-80">{{ matrixText }}</pre>
      </div>
    </Transition>

    <!-- Sudo terminal modal -->
    <Transition name="fade">
      <div v-if="showSudoModal" class="fixed inset-0 z-50 flex items-end justify-center" @click.self="closeSudoModal">
        <div
          class="w-full max-w-3xl bg-[#1e1e1e] border border-[#3c3c3c] border-b-0 h-64 flex flex-col font-mono text-[12px] shadow-2xl">
          <div
            class="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0 select-none">
            <div class="flex items-center gap-2 text-[#cccccc]">
              <span class="text-[#4ec9b0]">⚡</span>
              <span class="text-[11px] uppercase tracking-wider">Terminal — bash (sudo)</span>
            </div>
            <button @click="closeSudoModal"
              class="text-[#969696] hover:text-white transition-colors text-base leading-none">
              ×
            </button>
          </div>
          <div ref="terminalBodyRef" class="flex-1 overflow-y-auto p-3 editor-scroll">
            <div class="text-[#6a9955] mb-0.5">bash-5.2# sudo -s</div>
            <div class="text-[#569cd6] mb-2">
              Welcome, root. Type <span class="text-[#ce9178]">'help'</span> for
              cheat codes.
            </div>
            <template v-for="(entry, i) in sudoHistory" :key="i">
              <div class="text-[#569cd6]">root@baker:~# {{ entry.cmd }}</div>
              <div :class="entry.type === 'error' ? 'text-[#f44747]' : 'text-[#cccccc]'
                " class="whitespace-pre pl-2 mb-1.5 leading-5">
                {{ entry.output }}
              </div>
            </template>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-[#569cd6] shrink-0">root@baker:~#</span>
              <input ref="sudoInputEl" v-model="sudoInput" @keydown.enter.prevent="runCheatCode"
                @keydown.escape.prevent="closeSudoModal"
                class="bg-transparent outline-none text-[#cccccc] flex-1 caret-[#cccccc] ml-1" autocomplete="off"
                spellcheck="false" placeholder="enter cheat code..." />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Hire notification toast -->
    <Transition name="fade">
      <div v-if="hireToast"
        class="fixed bottom-8 right-3 z-50 bg-[#252526] border border-[#3c3c3c] text-[#cccccc] text-[12px] p-4 w-72 shadow-2xl">
        <div class="flex justify-between items-start mb-2">
          <span class="text-[#4ec9b0] text-[11px] uppercase tracking-wider font-bold">● Notification</span>
          <button @click="hireToast = false" class="text-[#969696] hover:text-white leading-none ml-4">
            ×
          </button>
        </div>
        <p class="text-[#cccccc] mb-3 font-mono text-[11px] leading-5">
          An employer() wants to<br />hire baker. Accept?
        </p>
        <div class="flex gap-2">
          <button @click="
            activeTab = 'contact';
          hireToast = false;
          " class="px-3 py-1 bg-[#007acc] text-white text-[11px] hover:bg-[#006bb3] transition-colors">
            Yes
          </button>
          <button @click="hireToast = false"
            class="px-3 py-1 bg-[#3c3c3c] text-[#cccccc] text-[11px] hover:bg-[#4a4a4a] transition-colors">
            I need coffee first
          </button>
        </div>
      </div>
    </Transition>

    <!-- Easter egg overlay -->
    <Transition name="fade">
      <div v-if="easterEggTriggered" class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div class="text-4xl md:text-6xl animate-bounce">🎮 +30 XP</div>
      </div>
    </Transition>

    <!-- Status Bar -->
    <div
      class="flex items-center justify-between h-6 text-white text-[11px] px-3 select-none shrink-0 transition-colors"
      :class="rainbowActive ? 'rainbow-status' : 'bg-[#007acc]'">
      <div class="flex items-center gap-3">
        <div class="relative">
          <button @click="showGitLog = !showGitLog"
            class="flex items-center gap-1 hover:bg-white/10 px-1 rounded transition-colors">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14.5 3.5L5 13 1.5 9.5l1-1L5 11l8.5-8.5 1 1z" />
            </svg>
            {{ branchName }}
          </button>
          <div v-if="showGitLog"
            class="absolute bottom-full left-0 mb-2 bg-[#1e1e1e] border border-[#3c3c3c] text-[11px] py-2 min-w-[320px] z-50 shadow-2xl">
            <div class="px-3 py-1 text-[#569cd6] border-b border-[#3c3c3c] mb-1 flex justify-between items-center">
              <span class="font-mono">git log --oneline main</span>
              <button @click.stop="showGitLog = false" class="text-[#969696] hover:text-white ml-4">
                ×
              </button>
            </div>
            <div class="px-3 font-mono space-y-0.5 text-[#cccccc] py-1">
              <div>
                <span class="text-[#f0ad4e]">a3f9c21</span> feat: rewrote
                everything from scratch (again)
              </div>
              <div>
                <span class="text-[#f0ad4e]">7e2b4d8</span> fix: it works, don't
                ask why
              </div>
              <div>
                <span class="text-[#f0ad4e]">1c6e9f3</span> chore: commented out
                the broken parts
              </div>
              <div>
                <span class="text-[#f0ad4e]">3d8a1b5</span> perf: removed 47
                console.logs, kept 3
              </div>
              <div>
                <span class="text-[#f0ad4e]">9f4c2e7</span> init: added the
                whole internet as a dep
              </div>
            </div>
          </div>
        </div>
        <span class="hidden sm:inline">0 errors · 0 warnings</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline">
          <span v-if="saveFlash" class="text-[#4ec9b0]">✓ baker.ts saved</span>
          <span v-else>{{ fileSize }}</span>
        </span>
        <span>TypeScript</span>
        <span>UTF-8</span>
        <span>{{ currentTime }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rainbow-status {
  animation: rainbow-bg 1s linear infinite;
}

@keyframes rainbow-bg {
  0% {
    background-color: #e74c3c;
  }

  17% {
    background-color: #e67e22;
  }

  33% {
    background-color: #f1c40f;
  }

  50% {
    background-color: #2ecc71;
  }

  67% {
    background-color: #3498db;
  }

  83% {
    background-color: #9b59b6;
  }

  100% {
    background-color: #e74c3c;
  }
}
</style>
