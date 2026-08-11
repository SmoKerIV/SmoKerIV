<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { BookSection } from "../three/types";
import {
  identity,
  stats,
  STAT_MAX,
  spellSchools,
  quests,
  artifacts,
  contact,
  colophon,
} from "../data/content";

/** Deep-linked section (#/book/<section>) to scroll to on open. */
const props = defineProps<{
  section?: BookSection | null;
}>();
const emit = defineEmits<{
  "update:section": [section: BookSection];
}>();

const rootEl = ref<HTMLElement | null>(null);

/** The 3D tome's sections, mapped onto this page's anchors. */
const SECTION_ANCHORS: Partial<Record<BookSection, string>> = {
  whoami: "whoami",
  skills: "skills",
  career: "career",
  projects: "projects",
  runes: "contact", // no appendix here — land the reader on the nearest page
  contact: "contact",
};

/** Bottom bookmark strip: the tome's tabs, laid flat for thumbs. */
const NAV: { id: BookSection; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "whoami", label: "Who Am I" },
  { id: "skills", label: "Spells" },
  { id: "career", label: "Quests" },
  { id: "projects", label: "Artifacts" },
  { id: "contact", label: "Raven" },
];

/** Section currently in view; drives the strip and the #/book/ hash. */
const active = ref<BookSection>("cover");
/** Programmatic smooth scrolls sweep past sections — mute tracking. */
let muteTrackingUntil = 0;

function scrollToSection(
  section: BookSection | null | undefined,
  behavior: ScrollBehavior = "auto",
): void {
  const root = rootEl.value;
  if (!root || !section) return;
  const anchor = SECTION_ANCHORS[section];
  if (!anchor) {
    root.scrollTo({ top: 0, behavior });
    return;
  }
  root.querySelector(`#${anchor}`)?.scrollIntoView({ block: "start", behavior });
}

function go(id: BookSection): void {
  muteTrackingUntil = performance.now() + 700;
  active.value = id;
  emit("update:section", id);
  scrollToSection(id, "smooth");
}

/* Track the section under the reader (top third of the viewport). */
let scrollRaf = 0;
function onScroll(): void {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    if (performance.now() < muteTrackingUntil) return;
    const root = rootEl.value;
    if (!root) return;
    const probe = root.scrollTop + root.clientHeight * 0.33;
    let current: BookSection = "cover";
    for (const { id } of NAV) {
      const anchor = SECTION_ANCHORS[id];
      if (!anchor) continue;
      const el = root.querySelector<HTMLElement>(`#${anchor}`);
      if (el && el.offsetTop <= probe) current = id;
    }
    if (current !== active.value) {
      active.value = current;
      emit("update:section", current);
    }
  });
}

/* Touch: a horizontal flick hops to the neighbouring section. */
const SWIPE_MIN_X = 60;
const SWIPE_MAX_MS = 600;
let touchStartX = 0;
let touchStartY = 0;
let touchStartAt = 0;

function onTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) return;
  const t = event.touches[0]!;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartAt = performance.now();
}

function onTouchEnd(event: TouchEvent): void {
  const t = event.changedTouches[0];
  if (!t || performance.now() - touchStartAt > SWIPE_MAX_MS) return;
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  // Deliberate horizontal flicks only — vertical scrolling stays sacred.
  if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const index = NAV.findIndex((n) => n.id === active.value);
  const target = NAV[index + (dx < 0 ? 1 : -1)];
  if (target) go(target.id);
}

onMounted(() => {
  scrollToSection(props.section);
  onScroll();
});
watch(
  () => props.section,
  (section) => {
    // Ignore the echo of our own update:section emits.
    if (section && section !== active.value) scrollToSection(section);
  },
);
onBeforeUnmount(() => {
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});

const contactLines = [
  { kind: "Email", label: contact.email, href: `mailto:${contact.email}` },
  { kind: "Phone", label: contact.phone.label, href: `tel:${contact.phone.tel}` },
  { kind: "GitHub", label: contact.github.label, href: contact.github.url },
  { kind: "LinkedIn", label: contact.linkedin.label, href: contact.linkedin.url },
  { kind: "Instagram", label: contact.instagram.label, href: contact.instagram.url },
];
</script>

<template>
  <div
    ref="rootEl"
    class="fixed inset-0 overflow-y-auto bg-night"
    @scroll.passive="onScroll"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <main
      class="parchment book-page mx-auto my-6 max-w-3xl px-6 py-10 shadow-tome sm:px-12 sm:py-14"
      style="
        border: 1px solid rgba(176, 141, 60, 0.35);
        border-radius: 4px;
        margin-bottom: calc(1.5rem + var(--safe-bottom));
      "
    >
      <!-- Header -->
      <header class="mb-10 text-center">
        <p class="m-0 font-body text-sm italic text-ink-faint">herein lies</p>
        <h1 class="m-0 mt-2 font-decorative text-3xl font-bold text-ink sm:text-4xl">
          The Tome of {{ identity.name }}
        </h1>
        <p class="m-0 mt-3 font-heading text-xs uppercase tracking-[0.3em] text-ink-soft">
          {{ identity.fantasyClass }}
        </p>
        <p class="m-0 mt-1 font-body text-sm italic text-ink-faint">
          {{ identity.profession }} · {{ identity.origin }}
        </p>
        <p
          class="m-0 mt-3 font-heading text-[11px] uppercase tracking-widest"
          :class="identity.status === 'available' ? 'text-arcane-dim' : 'text-wax'"
        >
          ⟡ {{ identity.statusFlavor }}
        </p>
        <p class="m-0 mt-4 font-body text-sm italic text-ink-soft md:hidden">
          ✦ You hold the humble paper copy — visit on a bigger screen to sit
          at the candle-lit 3D table itself.
        </p>
      </header>

      <!-- Who am I -->
      <section id="whoami" class="mb-10 scroll-mt-16">
        <h2>The Character Sheet</h2>
        <p class="dropcap">{{ identity.bio }}</p>
        <dl class="m-0 mt-4">
          <div class="row"><dt>Name</dt><dd>{{ identity.name }} — "{{ identity.handle }}"</dd></div>
          <div class="row"><dt>Class</dt><dd>{{ identity.fantasyClass }}</dd></div>
          <div class="row"><dt>Origin</dt><dd>{{ identity.origin }}</dd></div>
          <div class="row"><dt>Alignment</dt><dd>{{ identity.alignment }}</dd></div>
        </dl>
        <div class="mt-6">
          <div v-for="stat in stats" :key="stat.short" class="mb-3">
            <div class="mb-1 flex items-baseline justify-between font-heading text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <span>{{ stat.short }} · {{ stat.label }}</span>
              <span class="text-ink">{{ stat.value }}</span>
            </div>
            <div class="track"><div class="fill" :style="{ width: (stat.value / STAT_MAX) * 100 + '%' }" /></div>
          </div>
        </div>
      </section>

      <!-- Skills -->
      <section id="skills" class="mb-10 scroll-mt-16">
        <h2>Spells Known</h2>
        <div v-for="school in spellSchools" :key="school.school" class="mb-5">
          <h3 class="m-0 mb-2 font-heading text-sm font-semibold text-leather">
            {{ school.school }}
          </h3>
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
            <li v-for="spell in school.spells" :key="spell" class="chip">{{ spell }}</li>
          </ul>
        </div>
      </section>

      <!-- Career -->
      <section id="career" class="mb-10 scroll-mt-16">
        <h2>The Quest Log</h2>
        <article
          v-for="quest in quests"
          :key="quest.company"
          class="mb-4 border-l-2 pl-4"
          :style="{ borderColor: quest.current ? 'var(--arcane-dim)' : 'rgba(176, 141, 60, 0.55)' }"
        >
          <h3 class="m-0 font-heading text-base font-bold text-ink">
            {{ quest.role }}
            <span class="font-body font-normal italic text-ink-faint">at</span>
            {{ quest.company }}
            <span v-if="quest.current" class="ml-2 font-heading text-[10px] font-semibold uppercase tracking-widest text-arcane-dim">⟡ Active Quest</span>
          </h3>
          <p class="m-0 mt-0.5 font-heading text-[11px] uppercase tracking-widest text-ink-faint">
            {{ quest.period }}
          </p>
          <p class="m-0 mt-1 italic text-ink-soft">{{ quest.summary }}</p>
        </article>
      </section>

      <!-- Projects -->
      <section id="projects" class="mb-10 scroll-mt-16">
        <h2>Artifacts Forged</h2>
        <div
          v-for="artifact in artifacts"
          :key="artifact.name"
          class="mb-4 rounded border border-leather/35 bg-white/25 px-4 py-3"
        >
          <p class="m-0 font-heading text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
            {{ artifact.kind }}
          </p>
          <h3 class="m-0 mt-0.5 font-heading text-base font-bold text-ink">{{ artifact.name }}</h3>
          <p class="m-0 mt-1 italic text-ink-soft">{{ artifact.description }}</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="tech in artifact.tech" :key="tech" class="chip">{{ tech }}</span>
          </div>
          <a
            v-if="artifact.url"
            :href="artifact.url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-leather mt-3 inline-block rounded px-4 py-1.5 text-[10px]"
          >
            Inspect Artifact ↗
          </a>
        </div>
      </section>

      <!-- Contact -->
      <section id="contact" class="mb-8 scroll-mt-16">
        <h2>Send a Raven</h2>
        <ul class="m-0 list-none p-0">
          <li
            v-for="line in contactLines"
            :key="line.href"
            class="flex flex-wrap items-baseline gap-x-3 border-b border-dotted border-ink-soft/35 py-2.5"
          >
            <span class="w-24 font-heading text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
              {{ line.kind }}
            </span>
            <a
              :href="line.href"
              :target="line.href.startsWith('http') ? '_blank' : undefined"
              :rel="line.href.startsWith('http') ? 'noopener noreferrer' : undefined"
              class="text-ink underline decoration-dotted underline-offset-4 transition hover:text-arcane-dim"
            >{{ line.label }}</a>
          </li>
        </ul>
        <div class="mt-6 text-center">
          <a :href="`mailto:${contact.email}`" class="btn-wax inline-block px-8 py-3.5 text-xs">
            Send the Raven
          </a>
        </div>
      </section>

      <footer class="border-t border-gold/50 pt-5 text-center font-body text-xs italic text-ink-faint">
        {{ colophon }}
      </footer>
    </main>

    <!-- Bookmark strip: sticky at the reader's thumb, scrolls to sections -->
    <nav class="tab-strip" aria-label="Tome sections">
      <button
        v-for="n in NAV"
        :key="n.id"
        class="tab"
        :class="{ 'tab-active': n.id === active }"
        :aria-current="n.id === active ? 'page' : undefined"
        @click="go(n.id)"
      >
        {{ n.label }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: 0.8rem;
  padding: 0.4rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.35);
  align-items: baseline;
}
.row dt {
  width: 6.5rem;
  flex-shrink: 0;
  font-family: "Cinzel", serif;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.row dd {
  margin: 0;
}
.track {
  height: 11px;
  border: 1px solid rgba(42, 31, 20, 0.4);
  border-radius: 2px;
  background: rgba(255, 250, 235, 0.45);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--arcane-dim), var(--arcane));
}
.chip {
  font-family: "Cinzel", serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--arcane-dim);
  border: 1px solid rgba(30, 133, 119, 0.45);
  border-radius: 3px;
  padding: 0.3em 0.6em;
  background: rgba(53, 208, 186, 0.08);
}
/* Legibility floor for fingers-and-arm's-length reading. */
@media (pointer: coarse) {
  .chip {
    font-size: 11px;
  }
}

/* ------------------------------------------------------------- */
/* Bookmark strip — the tome's leather tabs, laid flat for thumbs  */
/* ------------------------------------------------------------- */
.tab-strip {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.9rem 0.75rem calc(0.5rem + var(--safe-bottom));
  background: linear-gradient(180deg, transparent, rgba(13, 10, 8, 0.94) 42%);
  scrollbar-width: none;
}
.tab-strip::-webkit-scrollbar {
  display: none;
}
/* Auto margins center the tabs when they fit, without clipping the
   start of the row when they overflow (justify-content: center would). */
.tab:first-child {
  margin-left: auto;
}
.tab:last-child {
  margin-right: auto;
}
.tab {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 2.75rem;
  padding: 0.4rem 0.85rem;
  font-family: "Cinzel", serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(234, 217, 184, 0.75);
  background: linear-gradient(180deg, var(--leather-light) 0%, var(--leather) 55%, var(--leather-dark) 100%);
  border: 1px solid rgba(20, 8, 4, 0.85);
  border-radius: 5px 5px 0 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.45);
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}
.tab:hover {
  color: #f3e6cb;
  filter: brightness(1.15);
}
.tab-active {
  transform: translateY(-3px);
  color: var(--arcane);
  background: linear-gradient(180deg, #1c6f63 0%, var(--arcane-dim) 45%, #0f4d45 100%);
}
</style>
