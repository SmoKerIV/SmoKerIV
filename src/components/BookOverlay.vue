<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { BookPageScreenTransforms, BookSection } from "../three/types";
import type { Artifact, Quest } from "../data/content";
import { PAGE_CSS_W, PAGE_CSS_H } from "../three/types";
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
import { useAudio } from "../composables/useAudio";
import { useSettings } from "../composables/useSettings";
import { track } from "../composables/useAnalytics";

/**
 * The diegetic tome: no backdrop, no frame — just two transparent "ink"
 * panes pinned onto the 3D book's open pages via matrix3d transforms
 * streamed from the scene, plus floating chrome (tabs/strap/arrows).
 */
const props = defineProps<{
  section: BookSection;
  /** matrix3d strings from the scene; null until the tome is readable. */
  transforms: BookPageScreenTransforms | null;
  /** Set only when /baker-cv.pdf actually exists. */
  cvUrl?: string | null;
}>();
const emit = defineEmits<{
  "update:section": [section: BookSection];
  close: [];
}>();

const audio = useAudio();
const settings = useSettings();

const SECTIONS: { id: BookSection; tab: string; title: string }[] = [
  { id: "cover", tab: "Cover", title: "Cover" },
  { id: "whoami", tab: "Who Am I", title: "The Character Sheet" },
  { id: "skills", tab: "Spells", title: "Spells Known" },
  { id: "career", tab: "Quests", title: "The Quest Log" },
  { id: "projects", tab: "Artifacts", title: "Artifacts Forged" },
  { id: "runes", tab: "Runes", title: "Forbidden Appendix" },
  { id: "contact", tab: "Raven", title: "Send a Raven" },
];

const sectionIndex = computed(() =>
  SECTIONS.findIndex((s) => s.id === props.section),
);

/**
 * Long sections span several spreads (two pages each). The tome's section
 * (tabs, TOC, #/book/<section>) stays the unit of navigation; `spread` is
 * the page-turn inside it.
 */
const spread = ref(0);
/** Spread to land on after the next section change (set when paging back). */
let pendingSpread = 0;

const questPages: Quest[][] = [
  quests.slice(0, 3),
  quests.slice(3, 6),
  quests.slice(6),
];

/** Artifacts per page; the first page also carries the section intro. */
const ARTIFACT_PAGE_SIZES = [2, 3, 2, 2];
const artifactPages: Artifact[][] = [];
{
  let at = 0;
  for (const size of ARTIFACT_PAGE_SIZES) {
    artifactPages.push(artifacts.slice(at, at + size));
    at += size;
  }
  // Anything added beyond the plan still gets pages (two per page).
  while (at < artifacts.length) {
    artifactPages.push(artifacts.slice(at, at + 2));
    at += 2;
  }
}

function spreadCountFor(section: BookSection): number {
  if (section === "career") return Math.ceil(questPages.length / 2);
  if (section === "projects") return Math.ceil(artifactPages.length / 2);
  return 1;
}
const spreadCount = computed(() => spreadCountFor(props.section));

const canPrev = computed(() => sectionIndex.value > 0 || spread.value > 0);
const canNext = computed(
  () =>
    sectionIndex.value < SECTIONS.length - 1 ||
    spread.value < spreadCount.value - 1,
);

const paneBase = {
  width: `${PAGE_CSS_W}px`,
  height: `${PAGE_CSS_H}px`,
} as const;

/** a–f of a CSS `matrix(...)` string (the scene never sends matrix3d). */
function parseMatrix(
  s: string,
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const m = s.match(/matrix\(([^)]+)\)/);
  if (!m) return null;
  const [a, b, c, d, e, f] = m[1]!.split(",").map(Number);
  if ([a, b, c, d, e, f].some((n) => n === undefined || Number.isNaN(n))) {
    return null;
  }
  return { a: a!, b: b!, c: c!, d: d!, e: e!, f: f! };
}

/**
 * Section tabs sit on the top edge of the open spread, like index tabs
 * glued to the pages: centred over the two panes, bottoms touching the
 * highest projected top corner of the papers.
 */
const tabsStyle = computed<Record<string, string> | null>(() => {
  const t = props.transforms;
  if (!t) return null;
  const L = parseMatrix(t.left);
  const R = parseMatrix(t.right);
  if (!L || !R) return null;
  // Top corners of each pane: (0,0) → (e, f), (W,0) → (aW+e, bW+f).
  const top = Math.min(
    L.f,
    L.b * PAGE_CSS_W + L.f,
    R.f,
    R.b * PAGE_CSS_W + R.f,
  );
  const leftX = L.e; // left pane, outer top corner
  const rightX = R.a * PAGE_CSS_W + R.e; // right pane, outer top corner
  return {
    left: `${(leftX + rightX) / 2}px`,
    top: `${top}px`,
    transform: "translate(-50%, -100%)",
  };
});

function navigate(to: BookSection): void {
  if (to === props.section) return;
  if (pendingSpread !== 0 && SECTIONS[sectionIndex.value - 1]?.id !== to) {
    pendingSpread = 0; // only prev() pages back onto a last spread
  }
  audio.playFlip();
  emit("update:section", to);
}

function next(): void {
  if (spread.value < spreadCount.value - 1) {
    audio.playFlip();
    spread.value += 1;
  } else if (sectionIndex.value < SECTIONS.length - 1) {
    navigate(SECTIONS[sectionIndex.value + 1]!.id);
  }
}
function prev(): void {
  if (spread.value > 0) {
    audio.playFlip();
    spread.value -= 1;
  } else if (sectionIndex.value > 0) {
    const target = SECTIONS[sectionIndex.value - 1]!.id;
    pendingSpread = spreadCountFor(target) - 1;
    navigate(target);
  }
}

/* ------------------------------------------------------------------ */
/* Keyboard, focus trap, focus restore                                  */
/* ------------------------------------------------------------------ */
const rootEl = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

function focusables(): HTMLElement[] {
  if (!rootEl.value) return [];
  return Array.from(
    rootEl.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

function trapTab(event: KeyboardEvent): void {
  const els = focusables();
  if (els.length === 0) return;
  const first = els[0]!;
  const last = els[els.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !rootEl.value?.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !rootEl.value?.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (!event.defaultPrevented) {
      event.preventDefault();
      emit("close");
    }
    return;
  }
  if (event.key === "Tab") {
    trapTab(event);
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    return;
  }
  if (event.key === "ArrowRight") next();
  else if (event.key === "ArrowLeft") prev();
}

/* ------------------------------------------------------------------ */
/* Touch: a horizontal swipe turns the page (tablets reading the tome)  */
/* ------------------------------------------------------------------ */
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
  // Deliberate horizontal flicks only — never hijack taps or scrolls.
  if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx < 0) next();
  else prev();
}

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null;
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  void nextTick(() => {
    closeBtn.value?.focus();
    fitPages();
  });
  // Late font swaps change line wrapping — refit once the faces settle.
  void document.fonts?.ready.then(fitPages);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("touchstart", onTouchStart);
  window.removeEventListener("touchend", onTouchEnd);
  previouslyFocused?.focus?.();
});

/* ------------------------------------------------------------------ */
/* Decorative data                                                      */
/* ------------------------------------------------------------------ */

/** Step-3 heptagram for the spell circle. */
const starPoints = Array.from({ length: 8 }, (_, i) => {
  const k = (i * 3) % 7;
  const angle = (k * 2 * Math.PI) / 7 - Math.PI / 2;
  return `${(100 + 62 * Math.cos(angle)).toFixed(2)},${(100 + 62 * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const CIRCLE_RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛊ".split("");

const RUNIC_TEXT = [
  "ᚦᚨ ᛊᛖᚱᚡᛖᚱ ᛁᛊ ᛞᛟᚹᚾ ᚨᚷᚨᛁᚾ᛫ ᚺᚨᚡᛖ ᚤᛟᚢ ᛏᚱᛁᛖᛞ ᛏᚢᚱᚾᛁᚾᚷ ᛁᛏ ᛟᚠᚠ ᚨᚾᛞ ᛟᚾ ᚨᚷᚨᛁᚾ᛬",
  "ᚾᛖᚡᛖᚱ ᛞᛖᛈᛚᛟᚤ ᛟᚾ ᚨ ᚠᚱᛁᛞᚨᚤ᛫ ᚦᛖ ᛖᛚᛞᛖᚱ ᛞᛖᚡᛊ ᚹᚨᚱᚾᛖᛞ ᚢᛊ᛫ ᚨᚾᛞ ᛊᛏᛁᛚᛚ ᚹᛖ ᛞᛁᛞ᛬",
  "ᚦᛁᛊ ᛈᚨᚱᚨᚷᚱᚨᛈᚺ ᛁᛊ ᛞᛖᚲᛟᚱᚨᛏᛁᚡᛖ᛫ ᛁᚠ ᚤᛟᚢ ᚲᚨᚾ ᚱᛖᚨᛞ ᛁᛏ᛫ ᛈᛚᛖᚨᛊᛖ ᚨᛈᛈᛚᚤ ᚹᛁᚦᛁᚾ᛬",
];

const MARGIN_SCRIBBLES = [
  "do not summon in prod",
  "works on my grimoire",
  "TODO: refactor this ritual",
  "here be segfaults →",
];

const SPELL_ICONS: Record<number, string> = {
  0: "M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-2 .8-3.6 2-5 .2 1.4 1 2.4 2 3 0-3.5.7-6.5 2-9z", // flame
  1: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1", // portal rings
  2: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", // spark
  3: "M10 3h4M12 3v6l5 9a2 2 0 0 1-1.8 3H8.8A2 2 0 0 1 7 18l5-9z", // alembic
};

const contactLines = [
  {
    kind: "By raven (email)",
    label: contact.email,
    href: `mailto:${contact.email}`,
  },
  {
    kind: "By speaking-horn",
    label: contact.phone.label,
    href: `tel:${contact.phone.tel}`,
  },
  {
    kind: "Grimoire repository",
    label: contact.github.label,
    href: contact.github.url,
  },
  {
    kind: "Guild registry",
    label: contact.linkedin.label,
    href: contact.linkedin.url,
  },
  {
    kind: "Scrying mirror",
    label: contact.instagram.label,
    href: contact.instagram.url,
  },
];

const artifactsLeft = computed(() => artifactPages[spread.value * 2] ?? []);
const artifactsRight = computed(
  () => artifactPages[spread.value * 2 + 1] ?? [],
);
const questsLeft = computed(() => questPages[spread.value * 2] ?? []);
const questsRight = computed(() => questPages[spread.value * 2 + 1] ?? []);

/** D&D ability modifier, formatted +N / −N / ±0. */
function statMod(value: number): string {
  const m = Math.floor((value - 10) / 2);
  if (m === 0) return "±0";
  return m > 0 ? `+${m}` : `−${Math.abs(m)}`;
}

/* ------------------------------------------------------------------ */
/* Fit-to-page: pages can't scroll, so shrink overflowing ink instead   */
/* ------------------------------------------------------------------ */
const leftPadEl = ref<HTMLElement | null>(null);
const rightPadEl = ref<HTMLElement | null>(null);
const fitScale = reactive({ left: 1, right: 1 });
const MIN_FIT = 0.7;

function fitStyle(side: "left" | "right"): Record<string, string> | undefined {
  const s = fitScale[side];
  if (s >= 0.999) return undefined;
  // Lay the content out wider/taller, then scale it back down — keeps the
  // visual width at 100% while everything (rem sizes included) shrinks.
  return {
    width: `${100 / s}%`,
    height: `${100 / s}%`,
    transform: `scale(${s})`,
  };
}

async function fitPane(side: "left" | "right"): Promise<void> {
  const pad = side === "left" ? leftPadEl.value : rightPadEl.value;
  const wrap = pad?.firstElementChild as HTMLElement | null | undefined;
  if (!wrap) return;
  fitScale[side] = 1;
  await nextTick();
  // Re-measure after each shrink: narrower text rewraps, so converge in
  // a couple of steps rather than trusting the first ratio.
  for (let i = 0; i < 3; i++) {
    const need = wrap.scrollHeight;
    const room = wrap.clientHeight;
    if (need <= room + 1) break;
    const next = Math.max(MIN_FIT, fitScale[side] * (room / need) * 0.98);
    if (next >= fitScale[side] - 0.005) break;
    fitScale[side] = next;
    await nextTick();
  }
}

function fitPages(): void {
  void fitPane("left");
  void fitPane("right");
}

/* ------------------------------------------------------------------ */
/* Inscribe reveal: hold new ink until the 3D flip settles, then sweep  */
/* ------------------------------------------------------------------ */
const hasNavigated = ref(false);
/**
 * clip-path/opacity only — never display/visibility: the fit-to-page pass
 * measures scrollHeight on the freshly keyed wrapper, and clip-path leaves
 * layout (and thus those measurements) untouched.
 */
const inscribe = computed(
  () => hasNavigated.value && !settings.reducedMotion,
);

watch(
  () => props.section,
  () => {
    // Only page turns get the inscribe reveal — the very first mount (book
    // just opened) shows content immediately; the open animation covered it.
    hasNavigated.value = true;
    spread.value = pendingSpread;
    pendingSpread = 0;
    void nextTick(fitPages);
  },
);
// The panes are display:none until the scene streams the first transforms,
// so the mount-time fit measured nothing — refit once they become visible.
watch(
  () => props.transforms !== null,
  (visible) => {
    if (visible) void nextTick(fitPages);
  },
);
watch(spread, () => {
  hasNavigated.value = true;
  void nextTick(fitPages);
});
</script>

<template>
  <div
    ref="rootEl"
    class="pointer-events-none fixed inset-0 z-40"
    role="document"
    aria-label="The Tome of Baker Alazzawi"
  >
    <!-- LEFT INK PANE -------------------------------------------------- -->
    <div
      v-show="transforms"
      class="ink-pane"
      :style="{ ...paneBase, transform: transforms?.left ?? 'none' }"
    >
      <div
        :key="`${section}-${spread}`"
        ref="leftPadEl"
        class="ink-pad book-page"
        :class="{ 'ink-inscribe': inscribe }"
        aria-live="polite"
      >
        <div class="fit-wrap" :style="fitStyle('left')">
          <!-- cover -->
          <template v-if="section === 'cover'">
            <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span class="font-body text-sm italic tracking-wide text-ink-faint">herein lies</span>
              <span class="text-gold" aria-hidden="true">✦ ❖ ✦</span>
              <h1 class="m-0 font-decorative text-3xl leading-tight text-ink">
                The Tome of<br />{{ identity.name }}
              </h1>
              <span class="text-gold" aria-hidden="true">✦ ❖ ✦</span>
              <p class="m-0 font-heading text-xs uppercase tracking-[0.3em] text-ink-soft">
                {{ identity.fantasyClass }}
              </p>
              <p class="m-0 font-body text-sm italic text-ink-faint">
                {{ identity.profession }} · {{ identity.origin }}
              </p>
              <span
                class="mt-1 inline-flex items-center gap-2 font-heading text-[11px] uppercase tracking-widest"
                :class="identity.status === 'available' ? 'text-arcane-dark' : 'text-wax'"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {{ identity.statusFlavor }}
              </span>
            </div>
          </template>

          <!-- whoami -->
          <template v-else-if="section === 'whoami'">
            <h2>Character Sheet</h2>
            <dl class="m-0 mb-3">
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
          </template>

          <!-- skills -->
          <template v-else-if="section === 'skills'">
            <h2>Spells Known</h2>
            <p class="dropcap">
              Spells mastered across long campaigns — cast daily, in production, without a saving throw.
            </p>
            <div v-for="(school, si) in spellSchools.slice(0, 2)" :key="school.school" class="school">
              <h3 class="school-name">
                <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-arcane-dark" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
                  <path :d="SPELL_ICONS[si]" />
                </svg>
                {{ school.school }}
              </h3>
              <ul class="spell-list">
                <li v-for="spell in school.spells" :key="spell">{{ spell }}</li>
              </ul>
            </div>
          </template>

          <!-- career -->
          <template v-else-if="section === 'career'">
            <h2>The Quest Log<span v-if="spread > 0" class="continued"> · continued</span></h2>
            <article
              v-for="quest in questsLeft"
              :key="quest.company"
              class="quest"
              :class="{ 'quest-current': quest.current }"
            >
              <span v-if="quest.current" class="active-badge">⟡ Active Quest</span>
              <span v-else class="stamp" aria-label="completed">Completed</span>
              <h3 class="quest-title">{{ quest.role }} <span class="quest-at">at</span> {{ quest.company }}</h3>
              <p class="quest-period">{{ quest.period }}</p>
              <p class="quest-summary">{{ quest.summary }}</p>
            </article>
          </template>

          <!-- projects -->
          <template v-else-if="section === 'projects'">
            <h2>Artifacts Forged<span v-if="spread > 0" class="continued"> · continued</span></h2>
            <p v-if="spread === 0" class="dropcap">
              Relics recovered from past expeditions. Handle with clean hands and a stable connection.
            </p>
            <div v-for="artifact in artifactsLeft" :key="artifact.name" class="artifact">
              <p class="artifact-kind">
                {{ artifact.kind }}
                <span v-if="artifact.badge" class="artifact-badge" :data-badge="artifact.badge">{{ artifact.badge }}</span>
              </p>
              <h3 class="artifact-name">{{ artifact.name }}</h3>
              <p class="artifact-desc">{{ artifact.description }}</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <span v-for="tech in artifact.tech" :key="tech" class="rune-chip">{{ tech }}</span>
                <a
                  v-if="artifact.url"
                  :href="artifact.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inspect-link"
                >Inspect ↗</a>
              </div>
            </div>
          </template>

          <!-- runes -->
          <template v-else-if="section === 'runes'">
            <div class="flex h-full flex-col items-center justify-center gap-2">
              <svg
                viewBox="0 0 200 200"
                class="h-[300px] w-[300px] max-h-[75%]"
                :style="settings.reducedMotion ? {} : { animation: 'slowSpin 90s linear infinite' }"
                aria-hidden="true"
              >
                <circle cx="100" cy="100" r="94" fill="none" stroke="#5a2e1d" stroke-width="1.5" opacity="0.7" />
                <circle cx="100" cy="100" r="86" fill="none" stroke="#b08d3c" stroke-width="0.7" opacity="0.6" />
                <circle cx="100" cy="100" r="62" fill="none" stroke="#5a2e1d" stroke-width="0.8" opacity="0.55" />
                <polygon :points="starPoints" fill="none" stroke="#2a796e" stroke-width="1" opacity="0.75" />
                <circle cx="100" cy="100" r="18" fill="none" stroke="#b08d3c" stroke-width="0.7" opacity="0.7" />
                <text x="100" y="106" text-anchor="middle" font-size="15" fill="#2a796e" opacity="0.9">ᛒ</text>
                <text
                  v-for="(rune, i) in CIRCLE_RUNES"
                  :key="i"
                  x="100"
                  y="30"
                  text-anchor="middle"
                  font-size="8.5"
                  fill="#4a3826"
                  opacity="0.85"
                  :transform="`rotate(${(i * 360) / CIRCLE_RUNES.length} 100 100)`"
                >{{ rune }}</text>
              </svg>
              <p class="m-0 text-center font-body text-xs italic text-ink-faint">
                fig. 1 — the summoning circle, as drawn by the author at 3 a.m.
              </p>
            </div>
          </template>

          <!-- contact -->
          <template v-else-if="section === 'contact'">
            <h2>Send a Raven</h2>
            <p class="dropcap">
              Quests, contracts, collaborations, or a simple hail — the ravens know the way to Baghdad, and the inbox is always watched.
            </p>
            <ul class="m-0 mt-1 list-none p-0">
              <li v-for="line in contactLines.slice(0, 3)" :key="line.href" class="contact-line">
                <span class="contact-kind">❖ {{ line.kind }}</span>
                <a
                  :href="line.href"
                  :target="line.href.startsWith('http') ? '_blank' : undefined"
                  :rel="line.href.startsWith('http') ? 'noopener noreferrer' : undefined"
                  class="contact-link"
                >{{ line.label }}</a>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>

    <!-- RIGHT INK PANE ------------------------------------------------- -->
    <div
      v-show="transforms"
      class="ink-pane"
      :style="{ ...paneBase, transform: transforms?.right ?? 'none' }"
    >
      <div
        :key="`${section}-${spread}`"
        ref="rightPadEl"
        class="ink-pad book-page"
        :class="{ 'ink-inscribe': inscribe }"
      >
        <div class="fit-wrap" :style="fitStyle('right')">
          <!-- cover: table of contents -->
          <template v-if="section === 'cover'">
            <h2>Table of Contents</h2>
            <ol class="m-0 mt-3 list-none p-0">
              <li v-for="(s, i) in SECTIONS.slice(1)" :key="s.id">
                <button class="toc-line" @click="navigate(s.id)">
                  <span class="font-heading text-sm font-semibold tracking-wide text-ink" style="font-variant: small-caps">
                    {{ s.title }}
                  </span>
                  <span class="toc-dots" aria-hidden="true" />
                  <span class="font-heading text-xs text-ink-faint">{{ ["I", "II", "III", "IV", "V", "VI"][i] }}</span>
                </button>
              </li>
            </ol>
            <p class="mt-5 text-center font-body text-xs italic text-ink-faint">
              — turn the pages with the arrows, the arrow keys, or the bookmarks —
            </p>
          </template>

          <!-- whoami: attributes -->
          <template v-else-if="section === 'whoami'">
            <h2>Attributes</h2>
            <div v-for="(stat, i) in stats" :key="stat.short" class="mb-2.5">
              <div class="mb-1 flex items-baseline justify-between font-heading text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                <span>{{ stat.short }} · {{ stat.label }}</span>
                <span class="text-ink">{{ stat.value }} <span class="text-ink-faint">({{ statMod(stat.value) }})</span></span>
              </div>
              <div class="stat-track">
                <div
                  class="stat-fill"
                  :style="{ width: (stat.value / STAT_MAX) * 100 + '%', animationDelay: `${i * 90}ms` }"
                />
              </div>
            </div>
            <p class="mt-3 text-center font-body text-xs italic text-ink-faint">
              * rolled honestly; the dungeon master was not bribed
            </p>
          </template>

          <!-- skills: schools 3 & 4 -->
          <template v-else-if="section === 'skills'">
            <div v-for="(school, si) in spellSchools.slice(2)" :key="school.school" class="school">
              <h3 class="school-name">
                <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-arcane-dark" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
                  <path :d="SPELL_ICONS[si + 2]" />
                </svg>
                {{ school.school }}
              </h3>
              <ul class="spell-list">
                <li v-for="spell in school.spells" :key="spell">{{ spell }}</li>
              </ul>
            </div>
            <p class="mt-2 text-center font-body text-xs italic text-ink-faint">
              new spells learned nightly, usually instead of sleeping
            </p>
          </template>

          <!-- career: remaining quests -->
          <template v-else-if="section === 'career'">
            <article
              v-for="quest in questsRight"
              :key="quest.company"
              class="quest"
              :class="{ 'quest-current': quest.current }"
            >
              <span v-if="quest.current" class="active-badge">⟡ Active Quest</span>
              <span v-else class="stamp" aria-label="completed">Completed</span>
              <h3 class="quest-title">{{ quest.role }} <span class="quest-at">at</span> {{ quest.company }}</h3>
              <p class="quest-period">{{ quest.period }}</p>
              <p class="quest-summary">{{ quest.summary }}</p>
            </article>
            <p v-if="questsRight.length === 0" class="folio mt-6">
              — the log is still being written —
            </p>
            <p v-else-if="spreadCount > 1" class="folio">
              folio {{ spread + 1 }} of {{ spreadCount }}
            </p>
          </template>

          <!-- projects: remaining artifacts -->
          <template v-else-if="section === 'projects'">
            <div v-for="artifact in artifactsRight" :key="artifact.name" class="artifact">
              <p class="artifact-kind">
                {{ artifact.kind }}
                <span v-if="artifact.badge" class="artifact-badge" :data-badge="artifact.badge">{{ artifact.badge }}</span>
              </p>
              <h3 class="artifact-name">{{ artifact.name }}</h3>
              <p class="artifact-desc">{{ artifact.description }}</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <span v-for="tech in artifact.tech" :key="tech" class="rune-chip">{{ tech }}</span>
                <a
                  v-if="artifact.url"
                  :href="artifact.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inspect-link"
                >Inspect ↗</a>
              </div>
            </div>
          <p v-if="spreadCount > 1" class="folio">
              folio {{ spread + 1 }} of {{ spreadCount }}
            </p>
          </template>

          <!-- runes: forbidden appendix -->
          <template v-else-if="section === 'runes'">
            <h2>Forbidden Appendix</h2>
            <div class="relative pr-14">
              <p v-for="(line, i) in RUNIC_TEXT" :key="i" class="runic">{{ line }}</p>
              <p class="mt-3 font-body text-xs italic text-ink-faint">
                translation withheld by order of the Archmage of Legal.
              </p>
              <!-- margin scribbles -->
              <div class="absolute -right-1 top-0 flex w-20 flex-col gap-5" aria-hidden="true">
                <span
                  v-for="(scribble, i) in MARGIN_SCRIBBLES"
                  :key="scribble"
                  class="scribble"
                  :style="{ transform: `rotate(${i % 2 === 0 ? -6 : 5}deg)`, marginTop: `${i * 10}px` }"
                >{{ scribble }}</span>
              </div>
            </div>
          </template>

          <!-- contact: seal + colophon + remaining lines -->
          <template v-else-if="section === 'contact'">
            <ul class="m-0 list-none p-0">
              <li v-for="line in contactLines.slice(3)" :key="line.href" class="contact-line">
                <span class="contact-kind">❖ {{ line.kind }}</span>
                <a
                  :href="line.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="contact-link"
                >{{ line.label }}</a>
              </li>
            </ul>
            <div class="mt-4 flex flex-col items-center gap-3 text-center">
              <a
                :href="`mailto:${contact.email}`"
                class="btn-wax flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-full text-center"
                aria-label="Send an email"
              >
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 8l8 5 8-5M4 8v9h16V8M4 8l8-4 8 4" />
                </svg>
                <span class="text-[10px] leading-tight">Send<br />the Raven</span>
              </a>
              <a
                v-if="cvUrl"
                :href="cvUrl"
                download
                class="btn-leather inline-flex items-center gap-2 rounded px-4 py-1.5 text-[10px]"
                aria-label="Download the CV"
                @click="track('cv_download')"
              >
                Take the Adventurer's Contract (CV)
              </a>
              <p class="m-0 max-w-[40ch] border-t border-gold/50 pt-2 font-body text-[11px] italic leading-relaxed text-ink-faint">
                {{ colophon }}
              </p>
              <ul class="m-0 max-w-[44ch] list-none p-0 font-body text-[11px] leading-snug text-ink-faint opacity-80">
                <li v-for="credit in credits" :key="credit">{{ credit }}</li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- FLOATING CHROME (untransformed) -------------------------------- -->
    <!-- Flex-wrapper centering (not translate-x): transform-based
         centering gets clobbered by any transition/hover transform. -->
    <div
      class="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style="top: calc(1rem + var(--safe-top))"
    >
      <button
        ref="closeBtn"
        class="btn-leather pointer-events-auto whitespace-nowrap rounded-b-lg rounded-t-sm px-5 py-2 text-[11px] opacity-90"
        @click="emit('close')"
      >
        ⟨ Return to the Table
      </button>
    </div>

    <button
      v-if="canPrev"
      class="corner corner-prev pointer-events-auto"
      aria-label="Previous page"
      @click="prev"
    >‹</button>
    <button
      v-if="canNext"
      class="corner corner-next pointer-events-auto"
      aria-label="Next page"
      @click="next"
    >›</button>

    <nav
      v-if="tabsStyle"
      class="pointer-events-auto fixed z-30 flex items-end gap-1"
      :style="tabsStyle"
      aria-label="Tome sections"
    >
      <button
        v-for="s in SECTIONS"
        :key="s.id"
        class="bookmark"
        :class="{ 'bookmark-active': s.id === section }"
        :aria-current="s.id === section ? 'page' : undefined"
        @click="navigate(s.id)"
      >
        {{ s.tab }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* ------------------------------------------------------------- */
/* Ink panes — transparent, pinned onto the 3D pages               */
/* ------------------------------------------------------------- */
.ink-pane {
  position: fixed;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  pointer-events: none;
  color: var(--ink);
  /* The scene supplies flat 2D matrices (top-down reading camera), never
     matrix3d: perspective-transformed text layers made Chromium blank the
     ink intermittently. Keep this pane free of will-change/3D hints. */
}
.ink-pad {
  pointer-events: auto;
  width: 100%;
  height: 100%;
  padding: 30px 42px 34px;
  /* NEVER a scroll container: scrollable boxes inside a transformed
     layer break compositing (blank pages). Content must fit —
     .fit-wrap shrinks anything that would overflow. */
  overflow: hidden;
}
.fit-wrap {
  height: 100%;
  transform-origin: 0 0;
}
/* Inscribe reveal: hold the fresh ink hidden for 0.45s (the 3D page flip
   runs 0.5s), then sweep it in top-to-bottom as if being written. `both`
   fill keeps the pre-delay state at the hidden first frame without JS
   timers, and clip-path/opacity never disturb the fit measurements. */
.ink-inscribe {
  animation: inkInscribe 0.7s cubic-bezier(0.3, 0.1, 0.35, 1) 0.45s both;
}
@keyframes inkInscribe {
  0% {
    clip-path: inset(0 0 100% 0);
    opacity: 0;
    filter: sepia(0.7) contrast(0.85);
  }
  22% {
    opacity: 1;
  }
  100% {
    clip-path: inset(0 0 0 0);
    opacity: 1;
    filter: none;
  }
}
/* Slightly tighter than the global book-page scale — pages don't scroll. */
.ink-pad.book-page,
.ink-pad.book-page p {
  font-size: 1.03rem;
  line-height: 1.55;
}
.ink-pad.book-page p {
  margin-bottom: 0.55em;
}


/* ------------------------------------------------------------- */
/* Floating chrome                                                 */
/* ------------------------------------------------------------- */
.corner {
  position: fixed;
  bottom: calc(22px + var(--safe-bottom));
  z-index: 30;
  width: 2.6rem;
  height: 2.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Cinzel", serif;
  font-size: 1.5rem;
  line-height: 1;
  color: rgba(234, 217, 184, 0.85);
  background: rgba(20, 12, 6, 0.55);
  border: 1px solid rgba(176, 141, 60, 0.45);
  border-radius: 9999px;
  backdrop-filter: blur(2px);
  transition: transform 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.corner:hover {
  color: var(--arcane);
  border-color: var(--arcane-dim);
}
.corner-prev { left: calc(26px + var(--safe-left)); }
.corner-next { right: calc(26px + var(--safe-right)); }

/* Fingers need ≥44px targets. */
@media (pointer: coarse) {
  .corner {
    width: 3rem;
    height: 3rem;
  }
  .bookmark {
    padding: 0.7rem 0.9rem 0.85rem;
    font-size: 11px;
  }
}

.bookmark {
  padding: 0.5rem 0.75rem 0.65rem;
  font-family: "Cinzel", serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(234, 217, 184, 0.75);
  background:
    linear-gradient(180deg, var(--leather-light) 0%, var(--leather) 55%, var(--leather-dark) 100%);
  border: 1px solid rgba(20, 8, 4, 0.85);
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.bookmark:hover {
  color: #f3e6cb;
  filter: brightness(1.15);
}
.bookmark-active {
  transform: translateY(-5px);
  color: var(--arcane);
  background: linear-gradient(180deg, #256b61 0%, var(--arcane-dim) 45%, #174540 100%);
}

/* ------------------------------------------------------------- */
/* Section ink styles (no boxes — rules and stamps only)           */
/* ------------------------------------------------------------- */
.sheet-row {
  display: flex;
  gap: 0.8rem;
  padding: 0.32rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.35);
  align-items: baseline;
}
.sheet-row dt {
  width: 6.2rem;
  flex-shrink: 0;
  font-family: "Cinzel", serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.sheet-row dd {
  margin: 0;
  font-size: 0.98rem;
}

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

.school {
  margin-bottom: 1rem;
}
.school-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.4rem;
  font-family: "Cinzel", serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--leather);
}
.spell-list {
  margin: 0;
  padding: 0;
  list-style: none;
  columns: 2;
  column-gap: 1.5rem;
}
.spell-list li {
  padding: 0.16rem 0;
  font-size: 0.95rem;
  break-inside: avoid;
}
.spell-list li::before {
  content: "✦";
  margin-right: 0.5rem;
  font-size: 0.7em;
  color: var(--arcane-dark, #2a796e);
}

.quest {
  position: relative;
  margin-bottom: 0.85rem;
  padding: 0.1rem 5.4rem 0.1rem 0.8rem;
  border-left: 2px solid rgba(176, 141, 60, 0.55);
}
.quest-current {
  border-left-color: #2a796e;
}
.quest-title {
  margin: 0;
  font-family: "Cinzel", serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink);
}
.quest-at {
  font-weight: 400;
  font-style: italic;
  font-family: "EB Garamond", serif;
  color: var(--ink-faint);
}
.quest-period {
  margin: 0.05rem 0 0.15rem;
  font-family: "Cinzel", serif;
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.artifact-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0 0.4rem;
  border: 1px solid currentColor;
  border-radius: 2px;
  font-size: 0.85em;
  letter-spacing: 0.12em;
  vertical-align: 1px;
  color: var(--ink-faint);
}
.artifact-badge[data-badge="Live"] {
  color: #2a796e;
}
.artifact-badge[data-badge="Work"] {
  color: #5a2e1d;
}
.continued {
  font-weight: 400;
  font-style: italic;
  font-size: 0.8em;
  color: var(--ink-faint);
}
.folio {
  margin: 0.4rem 0 0;
  text-align: center;
  font-family: "EB Garamond", serif;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--ink-faint);
}
.quest-summary {
  margin: 0;
  font-size: 0.92rem;
  font-style: italic;
  color: var(--ink-soft);
}
.active-badge {
  position: absolute;
  right: 0;
  top: 0.2rem;
  font-family: "Cinzel", serif;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1d5c52;
  border: 1px solid rgba(20, 101, 90, 0.6);
  border-radius: 3px;
  padding: 0.3em 0.55em;
}
.stamp {
  position: absolute;
  right: 0.1rem;
  top: 0.2rem;
  transform: rotate(-11deg);
  font-family: "Cinzel", serif;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(139, 35, 32, 0.8);
  border: 2px double rgba(139, 35, 32, 0.65);
  border-radius: 9999px;
  padding: 0.45em 0.7em;
}

/* Artifacts as ruled ledger entries — ink only, no card boxes. */
.artifact {
  margin-bottom: 0.8rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.4);
}
.artifact:last-child {
  border-bottom: none;
}
.artifact-kind {
  margin: 0;
  font-family: "Cinzel", serif;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a6b25;
}
.artifact-name {
  margin: 0.1rem 0 0.25rem;
  font-family: "Cinzel", serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}
.artifact-desc {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  font-style: italic;
  color: var(--ink-soft);
}
.rune-chip {
  font-family: "Cinzel", serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1d5c52;
  border: 1px solid rgba(20, 101, 90, 0.5);
  border-radius: 3px;
  padding: 0.26em 0.55em;
}
.inspect-link {
  margin-left: 0.35rem;
  font-family: "Cinzel", serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1d5c52;
  text-decoration: underline dotted rgba(20, 101, 90, 0.6);
  text-underline-offset: 3px;
}
.inspect-link:hover {
  color: var(--ink);
}

.toc-line {
  display: flex;
  align-items: baseline;
  width: 100%;
  gap: 0.5rem;
  padding: 0.42rem 0.25rem;
  text-align: left;
  border-radius: 3px;
  transition: background 0.15s ease;
}
.toc-line:hover {
  background: rgba(42, 121, 110, 0.1);
}
.toc-dots {
  flex: 1;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.55);
  transform: translateY(-3px);
}

.runic {
  font-size: 0.95rem;
  line-height: 1.85;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  word-break: break-word;
}
.scribble {
  font-family: "EB Garamond", serif;
  font-style: italic;
  font-size: 10.5px;
  line-height: 1.3;
  color: rgba(94, 19, 15, 0.75);
}

.contact-line {
  display: flex;
  flex-direction: column;
  padding: 0.42rem 0;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.35);
}
.contact-kind {
  font-family: "Cinzel", serif;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.contact-link {
  align-self: flex-start;
  margin-top: 0.08rem;
  font-size: 0.98rem;
  color: var(--ink);
  text-decoration: none;
  background-image: linear-gradient(90deg, #1d5c52, #2a796e);
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 1.5px;
  transition: background-size 0.25s ease, color 0.2s ease;
}
.contact-link:hover {
  color: #1d5c52;
  background-size: 100% 1.5px;
}
</style>
