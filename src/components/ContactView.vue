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
      <span><span class="syn-comment">// Contact.tsx</span></span>
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
        ><span class="syn-keyword">enum</span>
        <span class="syn-enum">Platform</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >4</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">Email</span>
        <span class="syn-operator">=</span>
        <span class="syn-string">"EMAIL"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >5</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">GitHub</span>
        <span class="syn-operator">=</span>
        <span class="syn-string">"GITHUB"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >6</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">LinkedIn</span>
        <span class="syn-operator">=</span>
        <span class="syn-string">"LINKEDIN"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >7</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">Phone</span>
        <span class="syn-operator">=</span>
        <span class="syn-string">"PHONE"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >8</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-property">Instagram</span>
        <span class="syn-operator">=</span>
        <span class="syn-string">"INSTAGRAM"</span
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >9</span
      >
      <span><span class="syn-bracket">}</span></span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >10</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >11</span
      >
      <span
        ><span class="syn-keyword">type</span>
        <span class="syn-interface">ContactMap</span>
        <span class="syn-operator">=</span> <span class="syn-type">Record</span
        ><span class="syn-operator">&lt;</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">,</span>
        <span class="syn-type">string</span
        ><span class="syn-operator">&gt;</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >12</span
      >
      <span>&nbsp;</span>
    </div>
    <!-- Contact object -->
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >13</span
      >
      <span
        ><span class="syn-keyword">const</span>
        <span class="syn-const">contact</span
        ><span class="syn-operator">:</span>
        <span class="syn-interface">ContactMap</span>
        <span class="syn-operator">=</span>
        <span class="syn-bracket">{</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >14</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">[</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">.</span
        ><span class="syn-property">Email</span
        ><span class="syn-bracket2">]</span><span class="syn-operator">:</span>
        <a href="mailto:baker.alazzawi0@gmail.com" class="syn-link"
          >"baker.alazzawi0@gmail.com"</a
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >15</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">[</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">.</span
        ><span class="syn-property">GitHub</span
        ><span class="syn-bracket2">]</span><span class="syn-operator">:</span>
        <a
          href="https://github.com/SmoKerIV"
          target="_blank"
          rel="noopener noreferrer"
          class="syn-link"
          >"github.com/SmoKerIV"</a
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >16</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">[</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">.</span
        ><span class="syn-property">LinkedIn</span
        ><span class="syn-bracket2">]</span><span class="syn-operator">:</span>
        <a
          href="https://linkedin.com/in/baker-alazzawi"
          target="_blank"
          rel="noopener noreferrer"
          class="syn-link"
          >"linkedin.com/in/baker-alazzawi"</a
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >17</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">[</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">.</span
        ><span class="syn-property">Phone</span
        ><span class="syn-bracket2">]</span><span class="syn-operator">:</span>
        <a href="tel:+9647730982555" class="syn-link">"+964 773 098 2555"</a
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >18</span
      >
      <span
        >&nbsp;&nbsp;<span class="syn-bracket2">[</span
        ><span class="syn-enum">Platform</span
        ><span class="syn-punctuation">.</span
        ><span class="syn-property">Instagram</span
        ><span class="syn-bracket2">]</span><span class="syn-operator">:</span>
        <a
          href="https://instagram.com/SmoKer_IV"
          target="_blank"
          rel="noopener noreferrer"
          class="syn-link"
          >"@SmoKer_IV"</a
        ><span class="syn-punctuation">,</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06] line-highlight">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >19</span
      >
      <span
        ><span class="syn-bracket">}</span
        ><span class="syn-punctuation">;</span></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >20</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >21</span
      >
      <span
        ><span class="syn-comment"
          >// click any value to reach out ↑</span
        ></span
      >
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >22</span
      >
      <span>&nbsp;</span>
    </div>
    <div class="code-line flex hover:bg-[#ffffff06]">
      <span class="w-12 shrink-0 text-right pr-5 text-[#858585] select-none"
        >23</span
      >
      <span
        ><span class="syn-keyword">export</span>
        <span class="syn-keyword">default</span>
        <span class="syn-variable">contact</span
        ><span class="syn-punctuation">;</span><span class="cursor-blink"></span
      ></span>
    </div>
  </div>
</template>
