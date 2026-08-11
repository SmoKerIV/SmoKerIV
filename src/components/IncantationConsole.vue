<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import type { BookSection } from "../three/types";
import { useSettings } from "../composables/useSettings";

/**
 * The wizard's prepared-spell page: a parchment sheet of proper D&D spells,
 * each cast with a click (no terminal, no typing). Opened by typing
 * sudo / magic / cast anywhere at the table.
 */
const emit = defineEmits<{
  close: [];
  /** Fireball — a real projectile in the 3D scene (CSS shake at impact). */
  fireball: [];
  /** Divination spells open the tome at a section. */
  "open-section": [section: BookSection];
  /** Wish — the quest-offer toast. */
  wish: [];
  roll: [value: number];
}>();

const settings = useSettings();

interface Spell {
  name: string;
  school: string;
  flavor: string;
  /** Casts the spell and returns the line for the casting log. */
  cast: () => string;
}

const lastCast = ref(
  "The page hums faintly, waiting. Touch a spell to cast it.",
);
const closeBtn = ref<HTMLButtonElement | null>(null);

const reducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Add a one-shot animation class to #app, removed when it ends. */
function animateApp(className: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.remove(className);
  void app.offsetWidth; // restart if already running
  app.classList.add(className);
  app.addEventListener(
    "animationend",
    () => app.classList.remove(className),
    { once: true },
  );
}

/* Prestidigitation — falling runes on a fullscreen canvas for ~6 s */
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
let fallingRunesCleanup: (() => void) | null = null;

function startFallingRunes(): void {
  fallingRunesCleanup?.();
  const overlay = document.createElement("div");
  overlay.className = "egg-matrix-overlay";
  const canvas = document.createElement("canvas");
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const fontSize = 18;
  const cols = Math.ceil(canvas.width / fontSize);
  const drops = Array.from({ length: cols }, () => Math.random() * -40);
  const speeds = Array.from({ length: cols }, () => 0.6 + Math.random() * 0.9);

  let raf = 0;
  const draw = (): void => {
    if (!ctx) return;
    ctx.fillStyle = "rgba(4, 10, 9, 0.16)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px serif`;
    for (let i = 0; i < cols; i++) {
      const glyph = RUNES[Math.floor(Math.random() * RUNES.length)];
      const y = drops[i] * fontSize;
      ctx.fillStyle = Math.random() > 0.9 ? "#7df2df" : "#35d0ba";
      ctx.fillText(glyph, i * fontSize, y);
      drops[i] += speeds[i];
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const fadeTimer = setTimeout(() => overlay.classList.add("egg-matrix-fade"), 5200);
  const endTimer = setTimeout(() => fallingRunesCleanup?.(), 6000);
  fallingRunesCleanup = () => {
    cancelAnimationFrame(raf);
    clearTimeout(fadeTimer);
    clearTimeout(endTimer);
    overlay.remove();
    fallingRunesCleanup = null;
  };
}

function openSectionSoon(section: BookSection): void {
  setTimeout(() => emit("open-section", section), 650);
}

const SPELLS: Spell[] = [
  {
    name: "Fireball",
    school: "Evocation · 3rd level",
    flavor: "a bead of flame; the rafters disapprove",
    cast: () => {
      emit("fireball");
      return "You trace the sigil of flame… FWOOOSH. The tankards rattle and the innkeeper glares.";
    },
  },
  {
    name: "Prestidigitation",
    school: "Transmutation · cantrip",
    flavor: "part the veil; watch the runes fall",
    cast: () => {
      startFallingRunes();
      return "A flick of the fingers — the veil parts and the runes come down like rain.";
    },
  },
  {
    name: "Daylight",
    school: "Evocation · 3rd level",
    flavor: "spill morning light through the shutters",
    cast: () => {
      settings.timeOfDay = "day";
      return "Daylight blooms — the sun spills through the shutters and the inn wakes.";
    },
  },
  {
    name: "Darkness",
    school: "Evocation · 2nd level",
    flavor: "let night settle back onto the inn",
    cast: () => {
      settings.timeOfDay = "night";
      return "Darkness falls — the candles reclaim the room and night settles on the table.";
    },
  },
  {
    name: "Identify",
    school: "Divination · 1st level",
    flavor: "read the wizard's character sheet",
    cast: () => {
      openSectionSoon("whoami");
      return "You pass a hand over the tome… it falls open at the character sheet.";
    },
  },
  {
    name: "Legend Lore",
    school: "Divination · 5th level",
    flavor: "recite the whole quest log",
    cast: () => {
      openSectionSoon("career");
      return "Old campaigns unspool in the candle smoke… the quest log opens itself.";
    },
  },
  {
    name: "Sending",
    school: "Evocation · 3rd level",
    flavor: "twenty-five words, straight to Baghdad",
    cast: () => {
      openSectionSoon("contact");
      return "You whisper to the wind… the tome opens at 'Send a Raven'.";
    },
  },
  {
    name: "Divination",
    school: "Divination · 4th level",
    flavor: "consult the d20 of fate",
    cast: () => {
      const n = 1 + Math.floor(Math.random() * 20);
      emit("roll", n);
      return n === 20
        ? "The d20 of fate turns up a NATURAL TWENTY. The tavern erupts."
        : n === 1
          ? "The d20 of fate rolls a natural 1 and hides under the table in shame."
          : `The d20 of fate turns up a ${n}.`;
    },
  },
  {
    name: "Levitate",
    school: "Transmutation · 2nd level",
    flavor: "turn the whole inn on its head",
    cast: () => {
      if (reducedMotion()) {
        return "(╯°□°）╯︵ ┻━┻ — the inn politely declines to levitate.";
      }
      animateApp("egg-flip");
      return "The whole inn lifts and cartwheels. The ale, miraculously, stays put.";
    },
  },
  {
    name: "Otto's Irresistible Dance",
    school: "Enchantment · 6th level",
    flavor: "the floorboards strike up a jig",
    cast: () => {
      if (reducedMotion()) {
        return "The bard plays. You nod, respectfully, without moving.";
      }
      animateApp("egg-wobble");
      return "♪ Otto's jig takes hold. The floorboards approve. ♪";
    },
  },
  {
    name: "Wish",
    school: "Conjuration · 9th level",
    flavor: "wish for a Computer Wizard",
    cast: () => {
      setTimeout(() => emit("wish"), 650);
      return "The mightiest of spells… a summoning contract materializes.";
    },
  },
  {
    name: "Counterspell",
    school: "Abjuration · 3rd level",
    flavor: "dispel this page and return to the inn",
    cast: () => {
      setTimeout(() => emit("close"), 350);
      return "The glow fades… the spellbook closes itself.";
    },
  },
];

function cast(spell: Spell): void {
  lastCast.value = spell.cast();
}

onMounted(() => {
  void nextTick(() => closeBtn.value?.focus());
});

onUnmounted(() => {
  fallingRunesCleanup?.();
});
</script>

<template>
  <div
    class="fixed inset-0 z-70 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="The wizard's prepared spells"
  >
    <div class="absolute inset-0 bg-night/70" @click="emit('close')" />

    <div
      class="parchment book-page relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded shadow-tome"
      style="border: 1px solid rgba(176, 141, 60, 0.45)"
    >
      <!-- header -->
      <header class="flex items-start justify-between gap-4 px-6 pt-5 sm:px-8">
        <div>
          <h2 class="!mb-1">Prepared Spells</h2>
          <p class="m-0 font-body text-sm italic text-ink-faint">
            The wizard's daily allotment — touch a sigil to cast. Slots: ∞
            (cantrip abuse).
          </p>
        </div>
        <button
          ref="closeBtn"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
          aria-label="Close the spell page"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <!-- spell list -->
      <div class="grid gap-x-8 overflow-y-auto px-6 py-4 sm:grid-cols-2 sm:px-8">
        <button
          v-for="spell in SPELLS"
          :key="spell.name"
          class="spell-row"
          @click="cast(spell)"
        >
          <span class="spell-name">✦ {{ spell.name }}</span>
          <span class="spell-school">{{ spell.school }}</span>
          <span class="spell-flavor">{{ spell.flavor }}</span>
        </button>
      </div>

      <!-- casting log -->
      <footer
        class="border-t border-gold/40 px-6 py-3 text-center font-body text-sm italic text-ink-soft sm:px-8"
        aria-live="polite"
      >
        {{ lastCast }}
      </footer>
    </div>
  </div>
</template>

<style scoped>
.spell-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  text-align: left;
  border-radius: 3px;
  border-bottom: 1px dotted rgba(74, 56, 38, 0.3);
  transition: background 0.15s ease;
}
.spell-row:hover {
  background: rgba(30, 133, 119, 0.1);
}
.spell-row:focus-visible {
  outline: 2px solid var(--arcane-dim);
  outline-offset: -2px;
}
.spell-name {
  font-family: "Cinzel", serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink);
}
.spell-row:hover .spell-name {
  color: var(--arcane-dim);
}
.spell-school {
  font-family: "Cinzel", serif;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8a6b25;
}
.spell-flavor {
  font-family: "EB Garamond", serif;
  font-size: 0.88rem;
  font-style: italic;
  color: var(--ink-faint);
}
</style>
