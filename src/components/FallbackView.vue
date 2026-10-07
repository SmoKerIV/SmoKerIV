<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { track } from "../composables/useAnalytics";
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
  contactLines,
  runesPage,
  statModifier,
  tomeCopy,
  tomeSections,
} from "../data/content";

/** Deep-linked section (#/book/<section>) to scroll to on open. */
const props = defineProps<{
  section?: BookSection | null;
  /** Set only when /baker-cv.pdf actually exists. */
  cvUrl?: string | null;
}>();
const emit = defineEmits<{
  "update:section": [section: BookSection];
  /** Reading direction, so a host's floating chrome can get out of the way. */
  "scroll-direction": [direction: "up" | "down"];
}>();

const rootEl = ref<HTMLElement | null>(null);

/** The tome's sections, mapped onto this page's anchors (cover = the top). */
const SECTION_ANCHORS: Partial<Record<BookSection, string>> = {
  whoami: "whoami",
  skills: "skills",
  career: "career",
  projects: "projects",
  runes: "runes",
  contact: "contact",
};

/** Bottom bookmark strip: the tome's tabs, laid flat for thumbs. */
const NAV = tomeSections;
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

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
let lastScrollTop = 0;
function onScroll(): void {
  const top = rootEl.value?.scrollTop ?? 0;
  if (top < 48 || top < lastScrollTop - 6) emit("scroll-direction", "up");
  else if (top > lastScrollTop + 6) emit("scroll-direction", "down");
  if (Math.abs(top - lastScrollTop) > 6 || top < 48) lastScrollTop = top;
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
    // On tall viewports the last section may never reach the probe line even
    // with the page scrolled to its end; the bottom of the page is Contact.
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
      current = NAV[NAV.length - 1]!.id;
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

/* Bookmark strip: keep the active tab in view, fade the clipped edges. */
const tabScroll = ref<HTMLElement | null>(null);
const tabEls = new Map<BookSection, HTMLElement>();
const fadeStart = ref(false);
const fadeEnd = ref(false);

function setTabEl(id: BookSection, el: unknown): void {
  if (el instanceof HTMLElement) tabEls.set(id, el);
  else tabEls.delete(id);
}

function updateFades(): void {
  const el = tabScroll.value;
  if (!el) return;
  fadeStart.value = el.scrollLeft > 4;
  fadeEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
}

function revealActiveTab(): void {
  const strip = tabScroll.value;
  const tab = tabEls.get(active.value);
  if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Centre the active tab; scrollTo on the strip only, never the page.
  strip.scrollTo({
    left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2,
    behavior: reduce ? "auto" : "smooth",
  });
}
watch(active, () => void nextTick(revealActiveTab));

onMounted(() => {
  scrollToSection(props.section);
  onScroll();
  updateFades();
  revealActiveTab();
  window.addEventListener("resize", updateFades);
});
watch(
  () => props.section,
  (section) => {
    // Ignore the echo of our own update:section emits.
    if (section && section !== active.value) scrollToSection(section);
  },
);
onBeforeUnmount(() => {
  window.removeEventListener("resize", updateFades);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});

/** Step-3 heptagram for the summoning circle (same figure as the tome). */
const starPoints = Array.from({ length: 8 }, (_, i) => {
  const k = (i * 3) % 7;
  const angle = (k * 2 * Math.PI) / 7 - Math.PI / 2;
  return `${(100 + 62 * Math.cos(angle)).toFixed(2)},${(100 + 62 * Math.sin(angle)).toFixed(2)}`;
}).join(" ");
const circleRunes = runesPage.circle.split("");

const SPELL_ICONS = [
  "M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-2 .8-3.6 2-5 .2 1.4 1 2.4 2 3 0-3.5.7-6.5 2-9z", // flame
  "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1", // portal rings
  "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", // spark
  "M10 3h4M12 3v6l5 9a2 2 0 0 1-1.8 3H8.8A2 2 0 0 1 7 18l5-9z", // alembic
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
    <main class="parchment book-page tome-page mx-auto max-w-3xl shadow-tome">
      <!-- Cover / title page -->
      <header class="mb-12 text-center">
        <p class="m-0 font-body text-sm italic tracking-wide text-ink-faint">herein lies</p>
        <p class="m-0 mt-2 text-gold" aria-hidden="true">✦ ❖ ✦</p>
        <h1 class="m-0 mt-3 font-decorative text-3xl leading-tight text-ink sm:text-4xl">
          The Tome of<br />{{ identity.name }}
        </h1>
        <p class="m-0 mt-3 text-gold" aria-hidden="true">✦ ❖ ✦</p>
        <p class="m-0 mt-4 font-heading text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
          {{ identity.fantasyClass }}
        </p>
        <p class="m-0 mt-1.5 font-body text-base italic text-ink-faint">
          {{ identity.profession }} · {{ identity.origin }}
        </p>
        <p
          class="m-0 mt-4 inline-flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-widest"
          :class="identity.status === 'available' ? 'text-arcane-dark' : 'text-wax'"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {{ identity.statusFlavor }}
        </p>

        <nav class="toc mx-auto mt-9 text-left" aria-label="Table of contents">
          <h2>Table of Contents</h2>
          <ol class="m-0 list-none p-0">
            <li v-for="(s, i) in NAV.slice(1)" :key="s.id">
              <button class="toc-line" @click="go(s.id)">
                <span class="toc-title">{{ s.title }}</span>
                <span class="toc-dots" aria-hidden="true" />
                <span class="toc-folio">{{ ROMAN[i] }}</span>
              </button>
            </li>
          </ol>
        </nav>

        <p class="m-0 mt-7 font-body text-sm italic text-ink-faint md:hidden">
          ✦ You hold the paper copy — visit on a bigger screen to sit at the
          candle-lit 3D table itself.
        </p>
      </header>

      <!-- Who am I -->
      <section id="whoami" class="mb-12">
        <h2>The Character Sheet</h2>
        <dl class="m-0 mb-4">
          <div class="sheet-row"><dt>Name</dt><dd>{{ identity.name }} — "{{ identity.handle }}"</dd></div>
          <div class="sheet-row"><dt>Class</dt><dd>{{ identity.fantasyClass }}</dd></div>
          <div class="sheet-row"><dt>Origin</dt><dd>{{ identity.origin }}</dd></div>
          <div class="sheet-row"><dt>Alignment</dt><dd>{{ identity.alignment }}</dd></div>
          <div class="sheet-row">
            <dt>Status</dt>
            <dd :class="identity.status === 'available' ? 'text-arcane-dark' : 'text-wax'">
              {{ identity.statusFlavor }}
            </dd>
          </div>
        </dl>
        <p class="dropcap">{{ identity.bio }}</p>

        <h2 class="mt-10">Attributes</h2>
        <div v-for="(stat, i) in stats" :key="stat.short" class="mb-3.5">
          <div class="mb-1.5 flex items-baseline justify-between gap-3 font-heading text-xs font-semibold uppercase tracking-wider text-ink-soft">
            <span>{{ stat.short }} · {{ stat.label }}</span>
            <span class="num shrink-0 text-ink">
              {{ stat.value }} <span class="text-ink-faint">({{ statModifier(stat.value) }})</span>
            </span>
          </div>
          <div class="stat-track">
            <div
              class="stat-fill"
              :style="{ width: (stat.value / STAT_MAX) * 100 + '%', animationDelay: `${i * 90}ms` }"
            />
          </div>
        </div>
        <p class="m-0 mt-4 text-center font-body text-sm italic text-ink-faint">
          {{ tomeCopy.attributesNote }}
        </p>
      </section>

      <!-- Spells -->
      <section id="skills" class="mb-12">
        <h2>Spells Known</h2>
        <p class="dropcap">{{ tomeCopy.spellsIntro }}</p>
        <div v-for="(school, si) in spellSchools" :key="school.school" class="school">
          <h3 class="school-name">
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-arcane-dark" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
              <path :d="SPELL_ICONS[si % SPELL_ICONS.length]" />
            </svg>
            {{ school.school }}
          </h3>
          <ul class="spell-list">
            <li v-for="spell in school.spells" :key="spell">{{ spell }}</li>
          </ul>
        </div>
        <p class="m-0 mt-5 text-center font-body text-sm italic text-ink-faint">
          {{ tomeCopy.spellsFootnote }}
        </p>
      </section>

      <!-- Quests -->
      <section id="career" class="mb-12">
        <h2>The Quest Log</h2>
        <article
          v-for="quest in quests"
          :key="quest.company"
          class="quest"
          :class="{ 'quest-current': quest.current }"
        >
          <h3 class="quest-title">
            {{ quest.role }} <span class="quest-at">at</span> {{ quest.company }}
          </h3>
          <div class="quest-meta">
            <p class="quest-period num">{{ quest.period }}</p>
            <span v-if="quest.current" class="active-badge">⟡ Active Quest</span>
            <span v-else class="stamp" aria-label="completed">Completed</span>
          </div>
          <p class="quest-summary">{{ quest.summary }}</p>
        </article>
      </section>

      <!-- Artifacts -->
      <section id="projects" class="mb-12">
        <h2>Artifacts Forged</h2>
        <p class="dropcap">{{ tomeCopy.artifactsIntro }}</p>
        <div v-for="artifact in artifacts" :key="artifact.name" class="artifact">
          <p class="artifact-kind">
            <span>{{ artifact.kind }}</span>
            <span v-if="artifact.badge" class="art-badge" :data-badge="artifact.badge">{{ artifact.badge }}</span>
          </p>
          <h3 class="artifact-name">{{ artifact.name }}</h3>
          <p class="artifact-desc">{{ artifact.description }}</p>
          <div class="flex flex-wrap items-center gap-1.5">
            <span v-for="tech in artifact.tech" :key="tech" class="rune-chip">{{ tech }}</span>
          </div>
          <a
            v-if="artifact.url"
            :href="artifact.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inspect-link"
          >Inspect<span aria-hidden="true" class="inspect-arrow">↗</span><span class="sr-only"> {{ artifact.name }} (opens in a new tab)</span></a>
        </div>
      </section>

      <!-- Runes -->
      <section id="runes" class="mb-12">
        <h2>Forbidden Appendix</h2>
        <figure class="m-0 flex flex-col items-center gap-2">
          <svg viewBox="0 0 200 200" class="circle-fig" aria-hidden="true">
            <circle cx="100" cy="100" r="94" fill="none" stroke="#5a2e1d" stroke-width="1.5" opacity="0.7" />
            <circle cx="100" cy="100" r="86" fill="none" stroke="#b08d3c" stroke-width="0.7" opacity="0.6" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="#5a2e1d" stroke-width="0.8" opacity="0.55" />
            <polygon :points="starPoints" fill="none" stroke="#2a796e" stroke-width="1" opacity="0.75" />
            <circle cx="100" cy="100" r="18" fill="none" stroke="#b08d3c" stroke-width="0.7" opacity="0.7" />
            <text x="100" y="106" text-anchor="middle" font-size="15" fill="#2a796e" opacity="0.9">ᛒ</text>
            <text
              v-for="(rune, i) in circleRunes"
              :key="i"
              x="100"
              y="30"
              text-anchor="middle"
              font-size="8.5"
              fill="#4a3826"
              opacity="0.85"
              :transform="`rotate(${(i * 360) / circleRunes.length} 100 100)`"
            >{{ rune }}</text>
          </svg>
          <figcaption class="m-0 text-center font-body text-sm italic text-ink-faint">
            {{ runesPage.caption }}
          </figcaption>
        </figure>
        <div class="mt-6">
          <p v-for="(line, i) in runesPage.text" :key="i" class="runic">{{ line }}</p>
          <p class="m-0 font-body text-sm italic text-ink-faint">{{ runesPage.translation }}</p>
        </div>
        <p class="scribbles" aria-hidden="true">
          <span
            v-for="(scribble, i) in runesPage.scribbles"
            :key="scribble"
            class="scribble"
            :style="{ transform: `rotate(${i % 2 === 0 ? -3 : 2.5}deg)` }"
          >{{ scribble }}</span>
        </p>
      </section>

      <!-- Contact -->
      <section id="contact" class="mb-10">
        <h2>Send a Raven</h2>
        <p class="dropcap">{{ tomeCopy.contactIntro }}</p>
        <ul class="m-0 mt-1 list-none p-0">
          <li v-for="line in contactLines" :key="line.href" class="contact-line">
            <span class="contact-kind">❖ {{ line.kind }}</span>
            <a
              :href="line.href"
              :target="line.href.startsWith('http') ? '_blank' : undefined"
              :rel="line.href.startsWith('http') ? 'noopener noreferrer' : undefined"
              class="contact-link"
            >{{ line.label }}<span v-if="line.href.startsWith('http')" class="sr-only"> (opens in a new tab)</span></a>
          </li>
        </ul>
        <div class="mt-8 flex flex-col items-center gap-4 text-center">
          <a
            :href="`mailto:${contact.email}`"
            class="btn-wax seal"
            :aria-label="tomeCopy.sealLabel"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 8l8 5 8-5M4 8v9h16V8M4 8l8-4 8 4" />
            </svg>
            <span class="text-xs leading-tight tracking-[0.02em]">Send<br />the Raven</span>
          </a>
          <a
            v-if="cvUrl"
            :href="cvUrl"
            download="Baker Alazzawi CV.pdf"
            class="btn-leather cv-link"
            @click="track('cv_download')"
          >{{ tomeCopy.cvLabel }}</a>
        </div>
      </section>

      <footer class="border-t border-gold/40 pt-5 text-center font-body text-sm italic text-ink-faint">
        {{ colophon }}
      </footer>
    </main>

    <!-- Bookmark strip: leather index tabs laid flat at the reader's thumb -->
    <nav class="tab-strip" aria-label="Tome sections">
      <div
        ref="tabScroll"
        class="tab-scroll"
        :class="{ 'fade-start': fadeStart, 'fade-end': fadeEnd }"
        @scroll.passive="updateFades"
      >
        <button
          v-for="n in NAV"
          :key="n.id"
          :ref="(el) => setTabEl(n.id, el)"
          class="tab"
          :class="{ 'tab-active': n.id === active }"
          :aria-current="n.id === active ? 'page' : undefined"
          @click="go(n.id)"
        >
          {{ n.tab }}
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* The page itself: side gutters respect notches, vertical rhythm is the
   tome's. Anchored sections clear the top edge when scrolled to. */
.tome-page {
  margin-top: 1rem;
  margin-inline: max(0.5rem, var(--safe-left)) max(0.5rem, var(--safe-right));
  padding: 2.5rem 1.35rem 2.25rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(176, 141, 60, 0.35);
  border-radius: 4px;
}
@media (min-width: 640px) {
  .tome-page {
    margin-inline: auto;
    margin-top: 1.5rem;
    padding: 4rem 3.5rem 3rem;
  }
}
section {
  scroll-margin-top: 1rem;
}
/* Phone body copy: a notch under the desktop 18px, still ≥ 16px. */
.tome-page p {
  font-size: 1.0625rem;
  line-height: 1.62;
}
@media (min-width: 640px) {
  .tome-page p {
    font-size: 1.125rem;
    line-height: 1.7;
  }
}

/* Table of contents on the cover */
.toc {
  max-width: 24rem;
}
.toc h2 {
  justify-content: center;
  font-size: 1rem;
}
.toc-line {
  display: flex;
  align-items: baseline;
  width: 100%;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.25rem;
  text-align: left;
  border-radius: 3px;
}
.toc-line:active {
  background: rgba(42, 121, 110, 0.12);
}
.toc-title {
  font-family: "Cinzel", serif;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-variant: small-caps;
  color: var(--ink);
}
.toc-dots {
  flex: 1;
  min-width: 0.75rem;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.55);
  transform: translateY(-3px);
}
.toc-folio {
  font-family: "Cinzel", serif;
  font-size: 0.8rem;
  color: var(--ink-faint);
}

/* Character sheet rows */
.sheet-row {
  display: flex;
  gap: 0.8rem;
  padding: 0.5rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.35);
  align-items: baseline;
}
.sheet-row dt {
  width: 5.6rem;
  flex-shrink: 0;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.sheet-row dd {
  margin: 0;
  min-width: 0;
}

/* Attribute bars: ruled track with tick marks, hatched teal ink */
.stat-track {
  position: relative;
  height: 10px;
  border: 1px solid rgba(42, 31, 20, 0.5);
  border-radius: 2px;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent calc(10% - 1px),
    rgba(74, 56, 38, 0.3) calc(10% - 1px),
    rgba(74, 56, 38, 0.3) 10%
  );
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  transform-origin: left center;
  animation: statFill 0.9s cubic-bezier(0.25, 0.9, 0.4, 1) both;
  background: repeating-linear-gradient(
    -55deg,
    rgba(42, 121, 110, 0.85) 0 3px,
    rgba(42, 121, 110, 0.45) 3px 6px
  );
}

/* Spell schools */
.school {
  margin-bottom: 1.25rem;
}
.school-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.45rem;
  font-family: "Cinzel", serif;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--leather);
}
.spell-list {
  margin: 0;
  padding: 0;
  list-style: none;
  columns: 2;
  column-gap: 1.25rem;
}
.spell-list li {
  padding: 0.22rem 0;
  font-size: 1rem;
  line-height: 1.35;
  break-inside: avoid;
}
.spell-list li::before {
  content: "✦";
  margin-right: 0.45rem;
  font-size: 0.7em;
  color: var(--arcane-dark);
}

/* Quest log */
.quest {
  position: relative;
  margin-bottom: 1.1rem;
  padding: 0.1rem 0 0.1rem 0.85rem;
  border-left: 2px solid rgba(176, 141, 60, 0.55);
}
.quest-current {
  border-left-color: var(--arcane-dim);
}
.quest-title {
  margin: 0;
  font-family: "Cinzel", serif;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
}
.quest-at {
  font-weight: 400;
  font-style: italic;
  font-family: "EB Garamond", serif;
  color: var(--ink-faint);
}
.quest-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0.15rem 0 0.2rem;
  min-height: 2.1rem;
}
.tome-page .quest-period {
  margin: 0;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  letter-spacing: 0.1em;
  white-space: nowrap;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.tome-page .quest-summary {
  margin: 0;
  font-size: 1rem;
  font-style: italic;
  color: var(--ink-soft);
}
.active-badge {
  flex-shrink: 0;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1d5c52;
  border: 1px solid rgba(20, 101, 90, 0.6);
  border-radius: 3px;
  padding: 0.3em 0.55em;
}
.stamp {
  flex-shrink: 0;
  transform: rotate(-9deg);
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(139, 35, 32, 0.8);
  border: 2px double rgba(139, 35, 32, 0.65);
  border-radius: 9999px;
  padding: 0.4em 0.7em;
}

/* Artifacts as ruled ledger entries — ink only, no card boxes */
.artifact {
  margin-bottom: 1.1rem;
  padding-bottom: 1rem;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.4);
}
.artifact:last-child {
  border-bottom: none;
}
.tome-page .artifact-kind {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.7rem;
  margin: 0 0 0.2rem;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #7a5c1a;
}
.artifact-name {
  margin: 0 0 0.3rem;
  font-family: "Cinzel", serif;
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
}
.tome-page .artifact-desc {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-style: italic;
  color: var(--ink-soft);
}
.rune-chip {
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1d5c52;
  border: 1px solid rgba(20, 101, 90, 0.5);
  border-radius: 3px;
  padding: 0.28em 0.6em;
}
.inspect-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  min-height: 2.75rem;
  margin-top: 0.15rem;
  padding: 0 0.1em;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #1d5c52;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.35em;
}
.inspect-link:hover,
.inspect-link:focus-visible {
  color: var(--ink);
}
.inspect-link:focus-visible {
  outline: 2px solid #1d5c52;
  outline-offset: 3px;
}

/* Runes page */
.circle-fig {
  width: min(100%, 17rem);
  height: auto;
  animation: slowSpin 90s linear infinite;
}
.tome-page .runic {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  line-height: 1.85;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  word-break: break-word;
}
.scribbles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.25rem;
  margin: 1.25rem 0 0;
}
.tome-page .scribble {
  font-family: "EB Garamond", serif;
  font-style: italic;
  font-size: 0.95rem;
  line-height: 1.3;
  color: rgba(94, 19, 15, 0.8);
}

/* Contact */
.contact-line {
  display: flex;
  flex-direction: column;
  padding: 0.55rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.35);
}
.contact-kind {
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.contact-link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  max-width: 100%;
  font-size: 1.05rem;
  color: var(--ink);
  text-decoration: underline dotted;
  text-underline-offset: 0.3em;
  overflow-wrap: anywhere;
}
.contact-link:hover {
  color: var(--arcane-dark);
}
.seal {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 7rem;
  height: 7rem;
  border-radius: 9999px;
  text-align: center;
}
.cv-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.5rem 1.1rem;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.35;
  text-align: center;
}

/* ------------------------------------------------------------- */
/* Bookmark strip — the tome's oxblood leather tabs, laid flat      */
/* ------------------------------------------------------------- */
.tab-strip {
  position: sticky;
  bottom: 0;
  z-index: 10;
  padding: 0.9rem 0 calc(0.5rem + var(--safe-bottom));
  background: linear-gradient(180deg, transparent, #0d0a08 58%);
}
.tab-scroll {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 1.5rem;
  padding: 0.35rem max(0.75rem, var(--safe-left)) 0 max(0.75rem, var(--safe-right));
  scrollbar-width: none;
}
.tab-scroll::-webkit-scrollbar {
  display: none;
}
/* Edge fades hint that more tabs wait off-screen; they only show on the
   side that is actually clipped. */
.tab-scroll.fade-end {
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 2rem), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 2rem), transparent);
}
.tab-scroll.fade-start {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 2rem);
  mask-image: linear-gradient(90deg, transparent, #000 2rem);
}
.tab-scroll.fade-start.fade-end {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 2rem, #000 calc(100% - 2rem), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 2rem, #000 calc(100% - 2rem), transparent);
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
  scroll-snap-align: center;
  min-height: 2.75rem;
  padding: 0.4rem 0.95rem;
  font-family: "Cinzel", serif;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #f0e2c4;
  background: linear-gradient(180deg, #4a1810, #7a2e1f 60%, #5c2116);
  border: 0;
  border-radius: 7px 7px 0 0;
  box-shadow: 0 -2px 7px rgba(0, 0, 0, 0.45);
  transition:
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.25s,
    color 0.25s;
}
.tab:hover {
  filter: brightness(1.12);
}
/* Active tab: raised, parchment page-stock with a thin gold inset ring. */
.tab-active {
  transform: translateY(-5px);
  color: var(--ink);
  background: linear-gradient(180deg, #e4d5b0, var(--parchment));
  box-shadow:
    0 -3px 8px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(184, 145, 61, 0.6);
}
@media (prefers-reduced-motion: reduce) {
  .tab {
    transition: none;
  }
}
</style>
