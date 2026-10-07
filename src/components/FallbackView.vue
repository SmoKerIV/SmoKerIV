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
  credits,
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
  // The tome's "runes" appendix is decorative (no real content) and has no
  // flat equivalent, so #/book/runes lands on the nearest page, Contact. The
  // scroll-spy then reports "contact" and the hash settles on it.
  runes: "contact",
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
      class="parchment book-page mx-auto my-6 max-w-3xl px-6 py-12 shadow-tome sm:px-14 sm:py-16"
      style="
        border: 1px solid rgba(176, 141, 60, 0.35);
        border-radius: 4px;
        margin-bottom: calc(1.5rem + var(--safe-bottom));
      "
    >
      <!-- Title page -->
      <header class="mb-12 text-center">
        <p class="m-0 font-heading text-xs font-semibold uppercase tracking-[0.35em] text-ink-faint">
          Herein Lies
        </p>
        <h1 class="m-0 mt-3 font-decorative text-3xl text-ink sm:text-4xl">
          The Tome of {{ identity.name }}
        </h1>
        <div class="ornament mx-auto mt-5" aria-hidden="true"><span /></div>
        <p class="m-0 mt-5 font-heading text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          {{ identity.fantasyClass }}
        </p>
        <p class="m-0 mt-1.5 font-body text-base text-ink-soft">
          {{ identity.profession }} · {{ identity.origin }}
        </p>
        <p
          class="m-0 mt-4 font-heading text-xs font-semibold uppercase tracking-widest"
          :class="identity.status === 'available' ? 'text-arcane-dim' : 'text-wax'"
        >
          ⟡ {{ identity.statusFlavor }}
        </p>
        <p class="m-0 mt-6 font-body text-sm italic text-ink-faint md:hidden">
          ✦ You hold the paper copy — visit on a bigger screen to sit at the
          candle-lit 3D table itself.
        </p>
      </header>

      <!-- Who am I -->
      <section id="whoami" class="mb-12 scroll-mt-16">
        <h2>The Character Sheet</h2>
        <p class="dropcap">{{ identity.bio }}</p>
        <dl class="m-0 mt-5 sm:grid sm:grid-cols-2 sm:gap-x-10">
          <div class="row"><dt>Name</dt><dd>{{ identity.name }} — "{{ identity.handle }}"</dd></div>
          <div class="row"><dt>Class</dt><dd>{{ identity.fantasyClass }}</dd></div>
          <div class="row"><dt>Origin</dt><dd>{{ identity.origin }}</dd></div>
          <div class="row"><dt>Alignment</dt><dd>{{ identity.alignment }}</dd></div>
        </dl>
        <div class="mt-7">
          <div v-for="stat in stats" :key="stat.short" class="mb-3.5">
            <div class="mb-1.5 flex items-baseline justify-between">
              <span class="font-heading text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {{ stat.short }} · {{ stat.label }}
              </span>
              <span class="font-heading text-xs font-semibold text-ink">
                {{ stat.value }}<span class="font-normal text-ink-faint"> / {{ STAT_MAX }}</span>
              </span>
            </div>
            <div class="track"><div class="fill" :style="{ width: (stat.value / STAT_MAX) * 100 + '%' }" /></div>
          </div>
        </div>
      </section>

      <!-- Skills -->
      <section id="skills" class="mb-12 scroll-mt-16">
        <h2>Spells Known</h2>
        <div v-for="school in spellSchools" :key="school.school" class="mb-6">
          <h3 class="school m-0 mb-2.5">{{ school.school }}</h3>
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
            <li v-for="spell in school.spells" :key="spell" class="chip">{{ spell }}</li>
          </ul>
        </div>
      </section>

      <!-- Career -->
      <section id="career" class="mb-12 scroll-mt-16">
        <h2>The Quest Log</h2>
        <article
          v-for="quest in quests"
          :key="quest.company"
          class="mb-5 border-l-2 pl-4"
          :style="{ borderColor: quest.current ? 'var(--arcane-dim)' : 'rgba(176, 141, 60, 0.45)' }"
        >
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 class="m-0 font-heading text-[15px] font-bold text-ink">{{ quest.role }}</h3>
            <span class="font-body text-ink-faint">at</span>
            <span class="font-heading text-sm font-semibold text-leather">{{ quest.company }}</span>
            <span v-if="quest.current" class="badge">Active Quest</span>
          </div>
          <p class="m-0 mt-1 font-heading text-xs uppercase tracking-[0.18em] text-ink-faint">
            {{ quest.period }}
          </p>
          <p class="m-0 mt-1.5 italic text-ink-soft">{{ quest.summary }}</p>
        </article>
      </section>

      <!-- Projects -->
      <section id="projects" class="mb-12 scroll-mt-16">
        <h2>Artifacts Forged</h2>
        <div
          v-for="artifact in artifacts"
          :key="artifact.name"
          class="mb-5 rounded border border-leather/25 bg-[rgba(255,252,240,0.35)] px-5 py-4"
        >
          <p class="m-0 font-heading text-xs font-semibold uppercase tracking-[0.24em] text-[#7a5c1a]">
            {{ artifact.kind }}
            <span v-if="artifact.badge" class="badge ml-2 align-middle">{{ artifact.badge }}</span>
          </p>
          <h3 class="m-0 mt-1 font-heading text-base font-bold text-ink">{{ artifact.name }}</h3>
          <p class="m-0 mt-1.5 text-ink-soft">{{ artifact.description }}</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <span v-for="tech in artifact.tech" :key="tech" class="chip">{{ tech }}</span>
          </div>
          <a
            v-if="artifact.url"
            :href="artifact.url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-leather mt-3.5 inline-block rounded px-4 py-1.5 text-xs"
          >
            Inspect Artifact ↗
          </a>
        </div>
      </section>

      <!-- Contact -->
      <section id="contact" class="mb-10 scroll-mt-16">
        <h2>Send a Raven</h2>
        <ul class="m-0 list-none p-0">
          <li
            v-for="line in contactLines"
            :key="line.href"
            class="flex flex-wrap items-baseline gap-x-3 border-b border-dotted border-ink-soft/35 py-2.5"
          >
            <span class="w-24 font-heading text-xs font-semibold uppercase tracking-widest text-ink-faint">
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
        <div class="mt-7 text-center">
          <a :href="`mailto:${contact.email}`" class="btn-wax inline-block px-8 py-3.5 text-xs">
            Send the Raven
          </a>
          <a
            href="/baker-cv.pdf"
            download="Baker Alazzawi CV.pdf"
            class="btn-leather ml-3 inline-block rounded px-5 py-3.5 text-xs"
          >
            Download the CV
          </a>
        </div>
      </section>

      <footer class="border-t border-gold/40 pt-5 text-center font-body text-xs italic text-ink-faint">
        {{ colophon }}
        <ul class="m-0 mt-3 list-none space-y-1 p-0 text-xs not-italic">
          <li v-for="credit in credits" :key="credit">{{ credit }}</li>
        </ul>
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
/* Gold hairline rule with a small diamond — the title page's ornament. */
.ornament {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 13rem;
  color: var(--gold);
}
.ornament::before,
.ornament::after {
  content: "";
  height: 1px;
  flex: 1;
}
.ornament::before {
  background: linear-gradient(90deg, transparent, var(--gold));
}
.ornament::after {
  background: linear-gradient(90deg, var(--gold), transparent);
}
.ornament span {
  width: 5px;
  height: 5px;
  flex-shrink: 0;
  transform: rotate(45deg);
  background: var(--gold);
}

.row {
  display: flex;
  gap: 0.8rem;
  padding: 0.45rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.3);
  align-items: baseline;
}
.row dt {
  width: 6rem;
  flex-shrink: 0;
  font-family: "Cinzel", serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.row dd {
  margin: 0;
}

.track {
  height: 8px;
  border: 1px solid rgba(42, 31, 20, 0.35);
  border-radius: 2px;
  background: rgba(255, 250, 235, 0.4);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--arcane-dim), var(--arcane));
}

/* Spell-school subheads: quiet engraved caps with a trailing hairline. */
.school {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-family: "Cinzel", serif;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--leather);
}
.school::after {
  content: "";
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, rgba(176, 141, 60, 0.45), transparent);
}

/* Ink-on-parchment chips; the arcane teal stays reserved for accents. */
.chip {
  font-family: "Cinzel", serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
  border: 1px solid rgba(90, 46, 29, 0.35);
  border-radius: 3px;
  padding: 0.32em 0.65em;
  background: rgba(255, 252, 240, 0.4);
}
/* Legibility floor for fingers-and-arm's-length reading. */
@media (pointer: coarse) {
  .chip {
    font-size: 12px;
  }
}

.badge {
  font-family: "Cinzel", serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--arcane-dim);
  border: 1px solid rgba(42, 121, 110, 0.4);
  border-radius: 999px;
  padding: 0.2em 0.7em;
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
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(234, 217, 184, 0.75);
  background: linear-gradient(180deg, var(--leather-light) 0%, var(--leather) 55%, var(--leather-dark) 100%);
  border: 1px solid rgba(20, 8, 4, 0.85);
  border-radius: 5px 5px 0 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.45);
  transition: color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.tab:hover {
  color: #f3e6cb;
  filter: brightness(1.15);
}
/* Active tab: raised, arcane ink on darker leather — no teal slab. */
.tab-active {
  transform: translateY(-3px);
  color: var(--arcane);
  background: linear-gradient(180deg, #4a2818 0%, var(--leather-dark) 100%);
  box-shadow:
    inset 0 2px 0 var(--arcane-dim),
    0 -2px 8px rgba(0, 0, 0, 0.45);
}
</style>
