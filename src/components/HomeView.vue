<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { gsap } from "gsap";

const codeRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  await nextTick();
  if (codeRef.value) {
    const lines = codeRef.value.querySelectorAll(".code-line");
    gsap.set(lines, { opacity: 0 });
    gsap.to(lines, { opacity: 1, duration: 0.03, stagger: 0.04, ease: "none" });
  }
});
</script>

<template>
  <div ref="codeRef" class="text-[13px] leading-6 pb-16">
    <!-- Line 1 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >1</span
      >
      <span><span class="syn-comment">// Hero.tsx — Baker Alazzawi</span></span>
    </div>
    <!-- Line 2 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >2</span
      >
      <span
        ><span class="syn-comment">// Full-Stack Software Developer</span></span
      >
    </div>
    <!-- Line 3 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >3</span
      >
      <span>&nbsp;</span>
    </div>
    <!-- Line 4 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >4</span
      >
      <span
        ><span class="syn-keyword">import</span>
        <span class="syn-bracket">{</span>
        <span class="syn-variable">passion</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-variable">dedication</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-variable">caffeine</span>
        <span class="syn-bracket">}</span> <span class="syn-keyword">from</span>
        <span class="syn-string">"life"</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 5 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >5</span
      >
      <span
        ><span class="syn-keyword">import</span>
        <span class="syn-bracket">{</span>
        <span class="syn-variable">React</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-variable">Vue</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-variable">Node</span>
        <span class="syn-bracket">}</span> <span class="syn-keyword">from</span>
        <span class="syn-string">"skills"</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 6 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >6</span
      >
      <span>&nbsp;</span>
    </div>
    <!-- Line 7 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >7</span
      >
      <span
        ><span class="syn-keyword">interface</span>
        <span class="syn-interface">Developer</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <!-- Line 8 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >8</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">name</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 9 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >9</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">title</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 10 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >10</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">location</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 11 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >11</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">status</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"available"</span>
        <span class="syn-operator">|</span>
        <span class="syn-string">"busy"</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 12 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >12</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">skills</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-bracket2">[]</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 13 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >13</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-function">build</span
        ><span class="syn-operator">:</span>
        <span class="syn-punctuation">(</span
        ><span class="syn-variable">idea</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">)</span>
        <span class="syn-keyword">=&gt;</span>
        <span class="syn-type">Promise</span
        ><span class="syn-operator">&lt;</span
        ><span class="syn-type">Product</span
        ><span class="syn-operator">&gt;</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 14 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >14</span
      >
      <span><span class="syn-bracket">}</span></span>
    </div>
    <!-- Line 15 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >15</span
      >
      <span>&nbsp;</span>
    </div>
    <!-- Line 16 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >16</span
      >
      <span
        ><span class="syn-keyword">const</span>
        <span class="syn-const">baker</span><span class="syn-operator">:</span>
        <span class="syn-interface">Developer</span>
        <span class="syn-operator">=</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <!-- Line 17 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >17</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">name</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Baker Alazzawi"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 18 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >18</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">title</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Full-Stack Software Developer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 19 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >19</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">location</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Baghdad, Iraq"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 20 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >20</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">status</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"available"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 21 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >21</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">skills</span
        ><span class="syn-operator">:</span>
        <span class="syn-bracket2">[</span></span
      >
    </div>
    <!-- Line 22 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >22</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-string">"TypeScript"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"React"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Vue"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Node.js"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Express.js"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 23 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >23</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-string">"NestJS"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Next.js"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Nuxt.js"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Supabase"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Firebase"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 24 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >24</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-string">"Linux"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"PostgreSQL"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Docker"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Prisma"</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-string">"Drizzle"</span></span
      >
    </div>
    <!-- Line 25 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >25</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">]</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Line 26 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >26</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-function">build</span
        ><span class="syn-operator">:</span>
        <span class="syn-keyword">async</span>
        <span class="syn-punctuation">(</span
        ><span class="syn-variable">idea</span
        ><span class="syn-punctuation">)</span>
        <span class="syn-keyword">=&gt;</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <!-- Line 27 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >27</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-keyword">const</span>
        <span class="syn-const">result</span>
        <span class="syn-operator">=</span>
        <span class="syn-keyword">await</span>
        <span class="syn-function">develop</span
        ><span class="syn-punctuation">(</span
        ><span class="syn-variable">idea</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-bracket">{</span>
        <span class="syn-property">passion</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-property">dedication</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-property">caffeine</span>
        <span class="syn-bracket">}</span><span class="syn-punctuation">)</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 28 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >28</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-keyword">return</span>
        <span class="syn-variable">result</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 29 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >29</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">}</span></span>
    </div>
    <!-- Line 30 -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >30</span
      >
      <span
        ><span class="syn-bracket">}</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <!-- Line 31 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >31</span
      >
      <span>&nbsp;</span>
    </div>
    <!-- Line 32 -->
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >32</span
      >
      <span
        ><span class="syn-keyword">export</span>
        <span class="syn-keyword">default</span>
        <span class="syn-variable">baker</span
        ><span class="syn-punctuation">;</span><span class="cursor-blink"></span
      ></span>
    </div>
  </div>
</template>
