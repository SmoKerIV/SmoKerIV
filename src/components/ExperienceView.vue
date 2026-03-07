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
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >1</span
      >
      <span><span class="syn-comment">// Experience.tsx</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >2</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >3</span
      >
      <span
        ><span class="syn-keyword">interface</span>
        <span class="syn-interface">Role</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >4</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >5</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >6</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span> <span class="syn-type">string</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >7</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">current</span
        ><span class="syn-operator">?:</span>
        <span class="syn-type">boolean</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >8</span
      >
      <span><span class="syn-bracket">}</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >9</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >10</span
      >
      <span
        ><span class="syn-keyword">const</span>
        <span class="syn-const">experience</span
        ><span class="syn-operator">:</span>
        <span class="syn-interface">Role</span
        ><span class="syn-bracket2">[]</span>
        <span class="syn-operator">=</span>
        <span class="syn-bracket2">[</span></span
      >
    </div>
    <!-- Qi Card -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >11</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >12</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Qi Card"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >13</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Software Developer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >14</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Jul 2025 — Present"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >15</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">current</span
        ><span class="syn-operator">:</span> <span class="syn-const">true</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >16</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Alrabiaa TV -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >17</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >18</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Alrabiaa TV"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >19</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Software Developer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >20</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Feb — Jun 2025"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >21</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Puretik -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >22</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >23</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Puretik"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >24</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Software Developer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >25</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Jun 2024 — Jun 2025"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >26</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Aon -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >27</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >28</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Aon"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >29</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Assistant Trainer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >30</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Oct — Dec 2024"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >31</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Vitex -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >32</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >33</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Vitex"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >34</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Software Developer"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >35</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Jan — Jun 2024"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >36</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <!-- Makers of Baghdad -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >37</span
      >
      <span>&nbsp;&nbsp;<span class="syn-bracket">{</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >38</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">company</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Makers of Baghdad"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >39</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">position</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Frontend Intern"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >40</span
      >
      <span
        >&nbsp;&nbsp;&nbsp;&nbsp;<span class="syn-property">period</span
        ><span class="syn-operator">:</span>
        <span class="syn-string">"Jul — Aug 2023"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >41</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket">}</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >42</span
      >
      <span
        ><span class="syn-bracket2">]</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >43</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >44</span
      >
      <span><span class="syn-comment">// 6 roles and counting...</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >45</span
      >
      <span
        ><span class="syn-keyword">export</span>
        <span class="syn-keyword">default</span>
        <span class="syn-variable">experience</span
        ><span class="syn-punctuation">;</span><span class="cursor-blink"></span
      ></span>
    </div>
  </div>
</template>
