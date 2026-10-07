<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type {
  BookPageScreenTransforms,
  BookSection,
  ItemId,
  SceneEvents,
} from "./three/types";
import type { SceneManager as SceneManagerT } from "./three/SceneManager";
import { ITEM_LABELS } from "./three/types";
import type { FocusCardItem } from "./data/content";
import { useSettings } from "./composables/useSettings";
import { useAudio } from "./composables/useAudio";
import { sceneAudio, installUiHover } from "./composables/useSceneAudio";
import { track } from "./composables/useAnalytics";
import LoaderScreen from "./components/LoaderScreen.vue";
import ItemTooltip from "./components/ItemTooltip.vue";
import ItemFocusCard from "./components/ItemFocusCard.vue";
import BookOverlay from "./components/BookOverlay.vue";
import HudBar from "./components/HudBar.vue";
import DiceToast from "./components/DiceToast.vue";
import type { ToastPayload } from "./components/DiceToast.vue";

/* Not needed for the first frame: each streams in as its own chunk the first
   time it renders (console / ledger on open, parchment page for flat mode). */
const loadConsole = () => import("./components/IncantationConsole.vue");
const loadSettings = () => import("./components/SettingsPanel.vue");
const IncantationConsole = defineAsyncComponent(loadConsole);
const SettingsPanel = defineAsyncComponent(loadSettings);
const FallbackView = defineAsyncComponent(
  () => import("./components/FallbackView.vue"),
);

const settings = useSettings();
const audio = useAudio();

/* ------------------------------------------------------------------ */
/* WebGL detection / flat mode                                          */
/* ------------------------------------------------------------------ */
function webgl2Available(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const flatRequested =
  new URLSearchParams(window.location.search).get("flat") === "1";
const useFallback = flatRequested || !webgl2Available();

/* ------------------------------------------------------------------ */
/* App state                                                            */
/* ------------------------------------------------------------------ */
type AppPhase = "loading" | "entering" | "table" | "focused";

const canvasEl = ref<HTMLCanvasElement | null>(null);
const appPhase = ref<AppPhase>("loading");
const progress = ref(0);
const sceneReady = ref(false);

const focusedItem = ref<ItemId | null>(null);
const hoveredItem = ref<ItemId | null>(null);
/** Screen-reader text for the keyboard-highlighted curio (Tab cycling). */
const highlightAnnouncement = ref("");
/** True after a Tab-cycle keypress, false once the pointer moves again. */
let keyboardHighlighting = false;
/** Suppresses hover ticks while the cycle fast-forwards to a target curio. */
let silentHighlight = false;
/** Last curio the keyboard cycle highlighted (null once focus leaves the ring). */
const kbItem = ref<ItemId | null>(null);
/** Curio that was activated from the keyboard: re-highlighted when the camera returns. */
let restoreItem: ItemId | null = null;
/** DOM focus anchor while a curio is highlighted, so the next Tab continues the cycle. */
const curioProxy = ref<HTMLElement | null>(null);
const hoverX = ref(0);
const hoverY = ref(0);

/** True only once the focus zoom has settled (cue for the payoff card). */
const focusCardShown = ref(false);
/** The tome opens its own overlay and the die never takes focus. */
const focusCardItem = computed<FocusCardItem | null>(() => {
  const item = focusedItem.value;
  if (!item || item === "spellbook" || item === "dice") return null;
  return item;
});

const bookOpen = ref(false);
const bookSection = ref<BookSection>("cover");
const settingsOpen = ref(false);
const consoleOpen = ref(false);
/** matrix3d transforms pinning the DOM ink onto the 3D pages. */
const pageTransforms = ref<BookPageScreenTransforms | null>(null);
/** Mobile / coarse pointer: the tome opens as a plain scrollable page. */
const flatBookOpen = ref(false);
/** The flat tome's "Back" strap slides away while reading down the page. */
const flatBackHidden = ref(false);
watch(flatBookOpen, () => (flatBackHidden.value = false));

/**
 * Small screens: the pinned 3D ink can't stay readable — serve the flat
 * tome. Width-only, so a large touch screen (iPad in landscape) still gets
 * the real 3D book; 960px covers every phone in landscape.
 */
const flatBookQuery = window.matchMedia("(max-width: 960px)");
function flatBookDevice(): boolean {
  return flatBookQuery.matches;
}
/** Coarse primary pointer: no hover discovery — show touch-first chrome.
 * Live-tracked so rotating a tablet / docking a keyboard updates it. */
const coarseQuery = window.matchMedia("(pointer: coarse)");
const isCoarseDevice = ref(coarseQuery.matches);
function onCoarseChange(event: MediaQueryListEvent): void {
  isCoarseDevice.value = event.matches;
}
coarseQuery.addEventListener("change", onCoarseChange);

/** URL of the downloadable CV, set only if /baker-cv.pdf actually exists. */
const cvUrl = ref<string | null>(null);

const toast = ref<ToastPayload | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;
let toastAction: (() => void) | null = null;

let scene: SceneManagerT | null = null;

/** Book section requested via #/book/<section> before the scene was ready. */
const BOOK_SECTIONS: BookSection[] = [
  "cover",
  "whoami",
  "skills",
  "career",
  "projects",
  "runes",
  "contact",
];
let pendingBookSection: BookSection | null = parseBookHash();

/** `#/book/<section>` → section; anything else (or empty) → null. */
function parseBookHash(hash: string = window.location.hash): BookSection | null {
  const match = hash.match(/^#\/book\/([a-z]+)$/);
  const candidate = match?.[1] as BookSection | undefined;
  return candidate && BOOK_SECTIONS.includes(candidate) ? candidate : null;
}

/**
 * Write the hash without echoing: a write that already matches is skipped,
 * so history navigation (which sets the hash itself) never re-pushes.
 * `push` for user-initiated moves (Back works), `replace` for continuous
 * ones like scroll-spy.
 */
function writeHash(section: BookSection | null, mode: "push" | "replace"): void {
  const hash = section ? `#/book/${section}` : "";
  if (window.location.hash === hash) return;
  const url = window.location.pathname + window.location.search + hash;
  if (mode === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

/** Back/forward or a typed hash: open, turn or close the tome to match. */
function applyHash(): void {
  const section = parseBookHash();
  if (useFallback) {
    // The flat page is always "open": just scroll to the section.
    bookSection.value = section ?? "cover";
    return;
  }
  if (section) {
    if (bookOpen.value || flatBookOpen.value) bookSection.value = section;
    else openBookAt(section);
  } else {
    pendingBookSection = null;
    if (bookOpen.value) closeBook();
    flatBookOpen.value = false;
  }
}

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */
function showToast(
  text: string,
  tone: ToastPayload["tone"] = "normal",
  actionLabel?: string,
  onAction?: () => void,
): void {
  toast.value = { id: ++toastId, text, tone, actionLabel };
  sceneAudio.toast(tone);
  toastAction = onAction ?? null;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 4000);
}

function onToastAction(): void {
  toastAction?.();
  toast.value = null;
}

function handleDiceResult(value: number): void {
  track("dice_roll", { value });
  sceneAudio.diceResult(value);
  if (value === 20) {
    showToast("NATURAL 20! The whole tavern erupts in cheers!", "nat20");
  } else if (value === 1) {
    showToast("Natural 1… the die rolls under the table in shame.", "nat1");
  } else {
    showToast(`You rolled a ${value}!`, "normal");
  }
}

/* ------------------------------------------------------------------ */
/* Scene wiring                                                         */
/* ------------------------------------------------------------------ */
const events: SceneEvents = {
  onProgress: (p) => {
    progress.value = p;
  },
  onReady: () => {
    sceneReady.value = true;
    // Warm the on-demand panels once the scene is up so the first open
    // doesn't wait on the network.
    const warm = () => {
      void loadSettings().catch(() => undefined);
      void loadConsole().catch(() => undefined);
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm);
    else setTimeout(warm, 2000);
  },
  onHover: (item, screen) => {
    if (appPhase.value !== "table") {
      hoveredItem.value = null;
      return;
    }
    // A tick when a new curio is hovered (mouse) or highlighted (keyboard);
    // never on touch, where a tap is a select, not a hover.
    if (
      item &&
      item !== hoveredItem.value &&
      !silentHighlight &&
      (!isCoarseDevice.value || keyboardHighlighting)
    ) {
      sceneAudio.hover();
    }
    hoveredItem.value = item;
    if (item && keyboardHighlighting) kbItem.value = item;
    highlightAnnouncement.value =
      item && keyboardHighlighting
        ? `${ITEM_LABELS[item].name}. Press Enter to open.`
        : "";
    if (item && screen) {
      hoverX.value = screen.x;
      hoverY.value = screen.y;
    }
  },
  onSelect: (item) => {
    if (item === "dice") {
      // The die never takes camera focus — it just rolls. Drop the nameplate
      // so it doesn't sit on the die (or its number in the phone peek).
      hoveredItem.value = null;
      scene?.rollDice();
      return;
    }
    if (item === "spellbook" && flatBookDevice()) {
      hoveredItem.value = null;
      restoreItem = keyboardHighlighting ? item : null;
      flatBookOpen.value = true;
      track("book_open", { mode: "flat" });
      return;
    }
    if (item !== "spellbook") track("item_focus", { item });
    hoveredItem.value = null;
    restoreItem = keyboardHighlighting ? item : null;
    // Re-clicks on the already-focused item (candle snuffing) must not
    // hide the card — focusItem is idempotent and won't settle again.
    const refocus = focusedItem.value === item;
    if (!refocus) {
      focusCardShown.value = false;
      sceneAudio.itemFocus(item);
    }
    focusedItem.value = item;
    appPhase.value = "focused";
    scene?.focusItem(item);
  },
  onFocusSettled: (item) => {
    if (item === "spellbook") {
      bookOpen.value = true;
    } else if (item === null) {
      focusCardShown.value = false;
      focusedItem.value = null;
      if (appPhase.value === "focused") appPhase.value = "table";
      restoreCurioFocus();
    } else {
      focusCardShown.value = true;
    }
  },
  onBookPageTransforms: (t) => {
    pageTransforms.value = t;
  },
  onDiceResult: handleDiceResult,
  onDiceImpact: (strength, hard) => sceneAudio.diceImpact(strength, hard),
  onFireballCast: (flight) => sceneAudio.fireballCast(flight),
  onFireballImpact: (position) => {
    // The 3D detonation just fired — shake the DOM on the same beat.
    screenShake();
    sceneAudio.fireballImpact(position);
  },
  onLightning: (position) => sceneAudio.lightning(position),
  onGust: () => sceneAudio.gust(),
  onObjectHop: (hop) => sceneAudio.objectHop(hop),
  onEmberPop: () => sceneAudio.emberPop(),
  onLanternSway: () => sceneAudio.lanternSway(),
  onTimeOfDay: (resolved) => sceneAudio.timeOfDay(resolved),
  onSources: (sources) => sceneAudio.sources(sources),
  onListener: (position, forward) => sceneAudio.listener(position, forward),
  onCandleSnuff: (state) => {
    sceneAudio.candleSnuff(state);
    const { snuffed, bothOut } = state;
    if (!snuffed) {
      showToast("A match flares — light returns.");
    } else if (bothOut) {
      showToast("Both candles out. The darkness is grateful.");
    } else {
      showToast("The candle hisses out. The shadows lean closer.");
    }
  },
  onAutoQuality: (quality) => {
    // Keep the ledger honest: sync the setting to what the scene actually runs.
    if (settings.quality !== quality) settings.quality = quality;
    showToast(
      "The innkeeper dims the lanterns — smoother magic on this device.",
      "normal",
    );
    track("quality_autodrop", { quality });
  },
};

function openBookAt(section: BookSection): void {
  bookSection.value = section;
  consoleOpen.value = false;
  if (useFallback) return; // fallback shows everything already
  if (flatBookDevice()) {
    flatBookOpen.value = true;
    track("book_open", { mode: "flat" });
    return;
  }
  if (bookOpen.value) return;
  if (!scene || appPhase.value === "loading" || appPhase.value === "entering") {
    pendingBookSection = section;
    return;
  }
  events.onSelect?.("spellbook");
}

function closeBook(): void {
  if (!bookOpen.value) return;
  bookOpen.value = false; // hide immediately (fade handled by <Transition>)
  sceneAudio.bookClose();
  scene?.focusItem(null);
}

function unfocus(): void {
  // Hide the payoff card the instant the return flight starts.
  focusCardShown.value = false;
  scene?.focusItem(null);
}

/* ------------------------------------------------------------------ */
/* Loader → table                                                       */
/* ------------------------------------------------------------------ */
function enterInn(): void {
  if (appPhase.value !== "loading") return;
  track("enter_inn");
  // First visits arrive here from the "Enter the Inn" click (a real user
  // gesture); returning visitors auto-enter, so the AudioContext may start
  // suspended and resumes on the first click/keypress (see onMounted).
  audio.setSfxOn(settings.sfxOn);
  audio.setBusVolume("ambience", settings.ambienceVolume);
  audio.setBusVolume("sfx", settings.sfxVolume);
  audio.setBusVolume("ui", settings.uiVolume);
  audio.setAmbienceOn(settings.ambienceOn);
  audio.unlock();
  sceneAudio.afterEnter();
  appPhase.value = "entering";
  window.setTimeout(() => {
    appPhase.value = "table";
    if (pendingBookSection) {
      openBookAt(pendingBookSection);
      pendingBookSection = null;
    } else {
      // Let the entrance settle before speaking up.
      window.setTimeout(maybeShowTouchHint, 1400);
    }
  }, 900);
}

/** First real user gesture: resume the (autoplay-blocked) AudioContext. */
function unlockAudioOnGesture(): void {
  audio.unlock();
}

/**
 * One-time touch onboarding: without hover there is nothing hinting that
 * the tabletop curios are interactive — say it once, then stay quiet.
 */
const TOUCH_HINT_KEY = "smokeriv-touch-hint-shown";
function maybeShowTouchHint(): void {
  if (!isCoarseDevice.value) return;
  try {
    if (localStorage.getItem(TOUCH_HINT_KEY)) return;
    localStorage.setItem(TOUCH_HINT_KEY, "1");
  } catch {
    /* storage unavailable — the hint simply repeats; harmless */
  }
  showToast("Tap the curios on the table — every one of them answers.", "quest");
}

/* ------------------------------------------------------------------ */
/* Keyboard + typing-buffer easter eggs                                 */
/* ------------------------------------------------------------------ */
let typeBuffer = "";

function hireEgg(): void {
  showToast(
    "A raven lands with a quest offer: “Seeking one Computer Wizard…”",
    "quest",
    "Read the contract",
    () => openBookAt("contact"),
  );
}

function bufferKey(key: string): void {
  if (key.length !== 1 || !/[a-z]/i.test(key)) return;
  typeBuffer = (typeBuffer + key.toLowerCase()).slice(-10);
  if (typeBuffer.endsWith("sudo") || typeBuffer.endsWith("magic") || typeBuffer.endsWith("cast")) {
    typeBuffer = "";
    consoleOpen.value = true;
  } else if (typeBuffer.endsWith("hire")) {
    typeBuffer = "";
    hireEgg();
  }
}

/* ↑↑↓↓←→←→BA — the hidden path from the old site. */
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
let konamiIndex = 0;

function trackKonami(key: string): void {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k !== KONAMI[konamiIndex]) {
    konamiIndex = k === KONAMI[0] ? 1 : 0;
    return;
  }
  konamiIndex++;
  if (konamiIndex < KONAMI.length) return;
  konamiIndex = 0;
  track("konami");
  // Fanfare + the natural-20 screen sparkles.
  sceneAudio.konami();
  showToast("🎮 +30 XP — a hidden path reveals itself", "nat20");
}

/**
 * The curios in the scene's own keyboard order (src/three/interaction.ts).
 * Tab walks these, then the HUD buttons in DOM order, then wraps.
 */
const CURIO_ORDER: ItemId[] = [
  "spellbook",
  "sword",
  "shield",
  "potion",
  "scroll",
  "dice",
  "tankard",
  "candle",
];

function hudFocusables(): HTMLElement[] {
  const hud = document.querySelector<HTMLElement>("[data-hud]");
  if (!hud) return [];
  return Array.from(hud.querySelectorAll<HTMLElement>("button, a[href]")).filter(
    (el) => el.offsetParent !== null,
  );
}

/** Drop the 3D highlight (the scene clears it on pointer leave). */
function clearCurioHighlight(): void {
  kbItem.value = null;
  canvasEl.value?.dispatchEvent(
    new PointerEvent("pointerleave", { pointerType: "mouse" }),
  );
}

/** Highlight the curio at `index`, stepping the scene's cycle quietly. */
function highlightCurio(index: number): void {
  if (!scene) return;
  const target = CURIO_ORDER[index]!;
  keyboardHighlighting = true;
  silentHighlight = true;
  try {
    for (let i = 0; i <= CURIO_ORDER.length; i++) {
      if (scene.highlightNext(1) === target) break;
    }
  } finally {
    silentHighlight = false;
  }
  sceneAudio.hover();
  curioProxy.value?.focus({ preventScroll: true });
}

function handleTab(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const back = event.shiftKey;
  // Shift+Tab from the skip link leaves the page, as it should.
  if (back && target?.closest(".skip-link")) return;
  // Nothing focused yet (fresh page): the DOM's first stop is the skip link.
  const nothingFocused = !target || target === document.body;
  if (!back && nothingFocused && !hoveredItem.value && !kbItem.value) return;

  const hud = hudFocusables();
  const hudIndex = target ? hud.indexOf(target) : -1;
  if (hudIndex >= 0) {
    // Inside the HUD native Tab order does the work; only its ends wrap.
    if (back ? hudIndex > 0 : hudIndex < hud.length - 1) return;
    event.preventDefault();
    highlightCurio(back ? CURIO_ORDER.length - 1 : 0);
    return;
  }

  event.preventDefault();
  keyboardHighlighting = true;
  const current = hoveredItem.value ?? kbItem.value;
  const at = current ? CURIO_ORDER.indexOf(current) : -1;
  if (at < 0) {
    highlightCurio(back ? CURIO_ORDER.length - 1 : 0);
  } else if (back ? at === 0 : at === CURIO_ORDER.length - 1) {
    // Off the end of the curios: into the HUD, or round again without one.
    const edge = hud[back ? hud.length - 1 : 0];
    if (edge) {
      clearCurioHighlight();
      edge.focus();
    } else {
      highlightCurio(back ? CURIO_ORDER.length - 1 : 0);
    }
  } else {
    scene?.highlightNext(back ? -1 : 1);
    curioProxy.value?.focus({ preventScroll: true });
  }
}

/** Focus moved onto a HUD button: the 3D highlight steps aside. */
function onFocusIn(event: FocusEvent): void {
  if (appPhase.value !== "table") return;
  if ((event.target as HTMLElement | null)?.closest("[data-hud]")) {
    if (hoveredItem.value || kbItem.value) clearCurioHighlight();
  }
}

/**
 * After a curio opened from the keyboard is closed again, put the highlight
 * and DOM focus back on it so the next Tab carries on round the cycle.
 */
function restoreCurioFocus(): void {
  const item = restoreItem;
  restoreItem = null;
  if (!item || !keyboardHighlighting || !scene) return;
  void nextTick(() => {
    if (appPhase.value !== "table" || bookOpen.value || settingsOpen.value) return;
    highlightCurio(CURIO_ORDER.indexOf(item));
  });
}

/** The skip link: straight to the tome without cycling the curios. */
function skipToTome(): void {
  openBookAt("cover");
}

function onPointerMove(): void {
  keyboardHighlighting = false;
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const typingInField =
    !!target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable);

  if (!typingInField) {
    bufferKey(event.key);
    trackKonami(event.key);
  }

  if (consoleOpen.value) {
    if (event.key === "Escape") {
      event.preventDefault();
      consoleOpen.value = false;
    }
    return;
  }
  if (settingsOpen.value && event.key === "Escape") {
    event.preventDefault();
    settingsOpen.value = false;
    return;
  }
  if (flatBookOpen.value && event.key === "Escape") {
    event.preventDefault();
    flatBookOpen.value = false;
    return;
  }
  // While the book is open, BookOverlay owns Escape/Tab/arrows; the ledger
  // and the flat tome are ordinary pages whose Tab/Enter must stay native.
  if (
    bookOpen.value ||
    settingsOpen.value ||
    flatBookOpen.value ||
    typingInField ||
    useFallback
  ) {
    return;
  }

  if (event.key === "Tab") {
    if (scene && appPhase.value === "table") handleTab(event);
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    // Buttons and links (HUD, skip link) keep their native activation.
    if (target?.closest("button, a[href], [role='button']")) return;
    if (scene && appPhase.value === "table" && (hoveredItem.value || kbItem.value)) {
      event.preventDefault();
      scene.activateHighlighted();
    }
    return;
  }
  if (event.key === "Escape" && focusedItem.value) {
    event.preventDefault();
    unfocus();
  }
}

/* ------------------------------------------------------------------ */
/* Console effects                                                      */
/* ------------------------------------------------------------------ */
let shakeTimer: ReturnType<typeof setTimeout> | null = null;
function screenShake(): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.remove("screen-shake");
  // restart the animation if it's already running
  void app.offsetWidth;
  app.classList.add("screen-shake");
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => app.classList.remove("screen-shake"), 700);
}

function castFireball(): void {
  // The 3D cast fires onFireballImpact when it detonates, which triggers
  // the CSS shake at the right beat; flat mode keeps the plain shake.
  if (scene) scene.castFireball();
  else screenShake();
}

function castAnimate(): void {
  // Under reduced motion nothing hops, so the hop-timed sounds never fire.
  if (settings.reducedMotion) sceneAudio.animateStill();
  scene?.castAnimateObjects();
}

function castDivination(): void {
  // Roll the physical d20 (the result toast arrives via onDiceResult);
  // flat mode falls back to a plain oracle roll.
  if (scene) scene.rollDice();
  else handleDiceResult(1 + Math.floor(Math.random() * 20));
}

/* ------------------------------------------------------------------ */
/* Settings → scene/audio                                               */
/* ------------------------------------------------------------------ */
watch(() => settings.quality, (quality) => scene?.setQuality(quality));
watch(() => settings.timeOfDay, (mode) => scene?.setTimeOfDay(mode));
watch(
  () => settings.reducedMotion,
  (reduced) => {
    scene?.setReducedMotion(reduced);
    document.documentElement.classList.toggle("reduce-motion", reduced);
  },
);
watch(() => settings.ambienceOn, (on) => {
  audio.setAmbienceOn(on);
  track(on ? "music_on" : "music_off");
});
watch(() => settings.ambienceVolume, (v) => audio.setBusVolume("ambience", v));
watch(() => settings.sfxVolume, (v) => audio.setBusVolume("sfx", v));
watch(() => settings.uiVolume, (v) => audio.setBusVolume("ui", v));
watch(() => settings.sfxOn, (on) => audio.setSfxOn(on));
/* Flat tome (small screens): the same book thump on open and close. */
watch(flatBookOpen, (open, wasOpen) => {
  if (open && !wasOpen) void audio.play("book-open");
  else if (!open && wasOpen) {
    sceneAudio.bookClose();
    restoreCurioFocus();
  }
});
/* The console and ledger hand focus back to what held it; if that was
   nothing (typed `sudo`), land on the highlighted curio instead of BODY. */
watch([consoleOpen, settingsOpen], ([consoleNow, settingsNow], [consoleWas, settingsWas]) => {
  if ((consoleNow && !consoleWas) || (settingsNow && !settingsWas)) return;
  void nextTick(() => {
    const active = document.activeElement;
    if ((!active || active === document.body) && kbItem.value && appPhase.value === "table") {
      curioProxy.value?.focus({ preventScroll: true });
    }
  });
});
watch(consoleOpen, (open) => {
  if (!open) return;
  track("console_open");
  audio.prefetch("spells");
});

/* Hash sync (#/book/<section> while the tome is open) + book analytics */
watch(
  [bookOpen, bookSection],
  ([open, section], [wasOpen, prevSection]) => {
    // Only touch the hash if the book was actually open, so a deep link
    // (#/book/<section>) present before "Enter the Inn" is not clobbered.
    // Opening / turning / closing are user moves → pushState (Back works).
    if (open) writeHash(section, "push");
    else if (wasOpen) writeHash(null, "push");

    if (open && !wasOpen) {
      track("book_open");
      track("book_section", { section });
    } else if (open && section !== prevSection) {
      track("book_section", { section });
      // Cosmetic 3D page turn under the crossfading ink.
      const dir =
        BOOK_SECTIONS.indexOf(section) >= BOOK_SECTIONS.indexOf(prevSection)
          ? 1
          : -1;
      scene?.flipBookPage(dir as 1 | -1);
    } else if (!open && wasOpen) {
      track("book_close");
    }
  },
);

/* Flat tome (coarse pointers) shares the same #/book/<section> deep links. */
watch(
  [flatBookOpen, bookSection],
  ([open, section], [wasOpen, prevSection]) => {
    if (useFallback) {
      // Scroll-spy changes the section continuously — replace, never push.
      if (section !== prevSection) writeHash(section, "replace");
      return;
    }
    if (open && !wasOpen) writeHash(section, "push");
    else if (open && section !== prevSection) writeHash(section, "replace");
    else if (!open && wasOpen) writeHash(null, "push");
  },
);

/* ------------------------------------------------------------------ */
/* Lifecycle                                                            */
/* ------------------------------------------------------------------ */
/** Only offer the CV if the file is actually deployed — no dead links. */
async function probeCv(): Promise<void> {
  try {
    const res = await fetch("/baker-cv.pdf", { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    // Dev/SPA servers answer missing files with the index page — reject those.
    if (res.ok && !type.includes("text/html")) cvUrl.value = "/baker-cv.pdf";
  } catch {
    /* offline or blocked — simply don't show the button */
  }
}

onMounted(async () => {
  document.documentElement.classList.toggle(
    "reduce-motion",
    settings.reducedMotion,
  );
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("focusin", onFocusIn);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("popstate", applyHash);
  window.addEventListener("pointerdown", unlockAudioOnGesture, { once: true });
  window.addEventListener("keydown", unlockAudioOnGesture, { once: true });
  uninstallUiHover = installUiHover(
    () => !useFallback && (appPhase.value === "table" || appPhase.value === "focused"),
  );
  void probeCv();

  if (useFallback) {
    appPhase.value = "table";
    // Deep links still work on the plain page — hand it the section.
    if (pendingBookSection) {
      bookSection.value = pendingBookSection;
      pendingBookSection = null;
    }
    return;
  }

  const { SceneManager } = await import("./three/SceneManager");
  if (!canvasEl.value) return;
  scene = new SceneManager(canvasEl.value, events, {
    quality: settings.quality,
    reducedMotion: settings.reducedMotion,
  });
  scene.setTimeOfDay(settings.timeOfDay);
});

let uninstallUiHover: (() => void) | null = null;

function teardown(): void {
  uninstallUiHover?.();
  uninstallUiHover = null;
  sceneAudio.cancelIdle();
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("focusin", onFocusIn);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("hashchange", applyHash);
  window.removeEventListener("popstate", applyHash);
  window.removeEventListener("pointerdown", unlockAudioOnGesture);
  window.removeEventListener("keydown", unlockAudioOnGesture);
  coarseQuery.removeEventListener("change", onCoarseChange);
  scene?.dispose();
  scene = null;
  audio.dispose();
}

onBeforeUnmount(teardown);
import.meta.hot?.dispose(() => teardown());
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-night">
    <!-- No WebGL2 / ?flat=1 → plain parchment page -->
    <FallbackView v-if="useFallback" v-model:section="bookSection" />

    <template v-else>
      <!-- first stop for keyboard users: straight to the tome -->
      <a href="#/book/cover" class="skip-link" @click.prevent="skipToTome">
        Skip to the tome (book)
      </a>

      <!-- DOM focus anchor for the Tab-cycled 3D curios -->
      <div
        ref="curioProxy"
        tabindex="-1"
        role="group"
        aria-label="Table curios"
        class="sr-only"
        style="outline: none"
      />

      <canvas
        ref="canvasEl"
        class="absolute inset-0 block h-full w-full"
        aria-hidden="true"
      />

      <!-- hover nameplate -->
      <Transition name="tooltip">
        <ItemTooltip
          v-if="hoveredItem && appPhase === 'table'"
          :item="hoveredItem"
          :x="hoverX"
          :y="hoverY"
        />
      </Transition>

      <!-- corner chrome (hidden while reading — the table should be bare) -->
      <HudBar
        v-if="(appPhase === 'table' || appPhase === 'focused') && !bookOpen && !flatBookOpen"
        :ambience-on="settings.ambienceOn"
        :book-open="bookOpen"
        :cv-url="cvUrl"
        @toggle-ambience="settings.ambienceOn = !settings.ambienceOn"
        @open-settings="settingsOpen = true"
        @open-console="consoleOpen = true"
      />

      <!-- floating way back when zoomed on an item (book has its own strap).
           Centered by a full-width flex wrapper, NOT translate-x: the
           book-fade transition animates `transform` and would replace a
           translate-based centering, making the button jump mid-fade. -->
      <Transition name="book-fade">
        <div
          v-if="appPhase === 'focused' && !bookOpen"
          class="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
          style="top: calc(1rem + var(--safe-top))"
        >
          <button
            class="btn-leather pointer-events-auto whitespace-nowrap rounded-b-lg rounded-t-sm px-5 py-2 text-xs opacity-90"
            @click="unfocus"
          >
            ⟨ View the whole table
          </button>
        </div>
      </Transition>

      <!-- item payoff card once the zoom settles (strap is top-center) -->
      <Transition name="focus-card">
        <ItemFocusCard
          v-if="
            appPhase === 'focused' && focusCardShown && focusCardItem && !bookOpen
          "
          :item="focusCardItem"
        />
      </Transition>

      <!-- touch: no hover discovery — make opening the tome obvious.
           pointer:coarse only matches when the PRIMARY input is a finger,
           so mice/trackpad machines (even with touchscreens) never see it.
           Flex-wrapper centering for the same reason as the strap above. -->
      <Transition name="book-fade">
        <div
          v-if="appPhase === 'table' && isCoarseDevice && !flatBookOpen"
          class="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
          style="bottom: calc(1.5rem + var(--safe-bottom))"
        >
          <button
            class="btn-wax pointer-events-auto flex items-center gap-2.5 whitespace-nowrap rounded-full mb-10 px-6 py-3 text-[12px]"
            @click="openBookAt('cover')"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2z" />
              <path d="M12 6v14" />
            </svg>
            Open the Tome
          </button>
        </div>
      </Transition>

      <!-- the tome: ink pinned onto the 3D pages -->
      <Transition name="book-fade">
        <BookOverlay
          v-if="bookOpen"
          v-model:section="bookSection"
          :transforms="pageTransforms"
          :cv-url="cvUrl"
          @close="closeBook"
        />
      </Transition>

      <!-- the boring version (mobile / coarse pointers) -->
      <Transition name="book-fade">
        <div v-if="flatBookOpen" class="flat-tome fixed inset-0 z-50 overflow-y-auto bg-night">
          <button
            class="btn-leather flat-back fixed z-10 rounded px-4 py-2 text-xs"
            :class="{ 'flat-back-hidden': flatBackHidden }"
            style="
              top: calc(0.75rem + var(--safe-top));
              right: calc(0.75rem + var(--safe-right));
            "
            @click="flatBookOpen = false"
          >
            ⟨ Back to the table
          </button>
          <FallbackView
            v-model:section="bookSection"
            @scroll-direction="flatBackHidden = $event === 'down'"
          />
        </div>
      </Transition>

      <!-- the innkeeper's ledger -->
      <Transition name="panel">
        <SettingsPanel
          v-if="settingsOpen"
          @close="settingsOpen = false"
          @return-to-table="
            settingsOpen = false;
            unfocus();
          "
        />
      </Transition>

      <!-- loading screen -->
      <LoaderScreen
        v-if="appPhase === 'loading' || appPhase === 'entering'"
        :progress="progress"
        :ready="sceneReady"
        :leaving="appPhase === 'entering'"
        @enter="enterInn"
      />
    </template>

    <!-- announces the keyboard-highlighted curio to screen readers -->
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ highlightAnnouncement }}
    </p>

    <!-- toasts (dice, easter eggs) -->
    <Transition name="toast">
      <DiceToast
        v-if="toast"
        :toast="toast"
        :clear-bottom-button="
          !useFallback &&
          appPhase === 'table' &&
          isCoarseDevice &&
          !flatBookOpen
        "
        @action="onToastAction"
      />
    </Transition>

    <!-- the wizard's prepared-spell page -->
    <Transition name="console">
      <IncantationConsole
        v-if="consoleOpen"
        @close="consoleOpen = false"
        @fireball="castFireball"
        @lightning="scene?.castLightning()"
        @gust="scene?.castGustOfWind()"
        @animate="castAnimate"
        @divination="castDivination"
        @wish="hireEgg"
      />
    </Transition>
  </div>
</template>
