/**
 * All portfolio content, rethemed for the fantasy spellbook.
 * This is the single file to edit when facts change.
 */
import type { ItemId } from "../three/types";

export const identity = {
  name: "Baker Alazzawi",
  handle: "SmoKer",
  title: "Computer Wizard",
  /** The mundane-world job title, kept as flavor under the wizard title. */
  profession: "Full-Stack Software Developer",
  fantasyClass: "Computer Wizard",
  origin: "Baghdad, Iraq",
  status: "available" as "available" | "busy",
  statusFlavor: "Available for quests",
  bio:
    "A developer who ships fast and fixes faster — three years and counting of " +
    "production apps. Fluent in the arcane arts of TypeScript on both fronts of " +
    "the battlefield, client and server, and sustained almost entirely by caffeine.",
  alignment: "Chaotic Shipper",
};

/**
 * Character-sheet ability scores, proper D&D scale: 20 is the mortal
 * maximum, 10 is average, below 10 is a weakness. STAT_MAX drives the bars.
 */
export const STAT_MAX = 20;
export const stats = [
  { label: "Backend Strength", short: "STR", value: 15 },
  { label: "Deploy Dexterity", short: "DEX", value: 14 },
  { label: "Caffeine Constitution", short: "CON", value: 18 },
  { label: "TypeScript Intellect", short: "INT", value: 20 },
  { label: "Debugging Wisdom", short: "WIS", value: 16 },
  { label: "UI Charisma", short: "CHA", value: 13 },
];

/** Tech stack as "spells known", grouped by school. */
export const spellSchools = [
  {
    school: "Evocation — Frontend",
    spells: [
      "TypeScript",
      "Vue 3",
      "Nuxt.js",
      "React",
      "Next.js",
      "Svelte 5 / SvelteKit",
    ],
  },
  {
    school: "Enchantment — UI & Desktop",
    spells: ["Pinia", "PrimeVue", "Vuetify", "Tailwind CSS", "Electron"],
  },
  {
    school: "Conjuration — Backend",
    spells: ["Node.js", "Express.js", "NestJS", "Python", "Supabase", "Firebase"],
  },
  {
    school: "Transmutation — Data & Infra",
    spells: [
      "PostgreSQL",
      "SQLite",
      "Prisma",
      "Drizzle",
      "Docker",
      "Linux",
      "Nginx",
      "PM2",
      "Git",
    ],
  },
];

export interface Quest {
  company: string;
  role: string;
  period: string;
  current?: boolean;
  summary: string;
}

/** Career as a quest log, newest start date first. */
export const quests: Quest[] = [
  {
    company: "Enjaz (Qi Card)",
    role: "Software Developer",
    period: "Jul 2025 — Present",
    current: true,
    summary: "Forging oil-sector realms and a SuperQi mini app for 1M+ families.",
  },
  {
    company: "Self-employed",
    role: "Freelance Software Developer",
    period: "2024 — Present",
    current: true,
    summary: "A wandering sellsword: cafe menus, a clinic CRM, a portfolio.",
  },
  {
    company: "Alrabiaa TV",
    role: "Junior Software Developer",
    period: "Feb — Jun 2025",
    summary: "Charted the seats of the great hall: ticketing with living seat maps.",
  },
  {
    company: "PureTik",
    role: "Junior Software Developer",
    period: "Jun 2024 — Jun 2025",
    summary: "Brewed Dr.Lab for the alchemists' labs; raised Karada Store.",
  },
  {
    company: "Aon.iq",
    role: "Assistant Trainer",
    period: "Oct — Dec 2024",
    summary: "Trained fresh adventurers in the ways of code.",
  },
  {
    company: "Vitex",
    role: "Software Developer",
    period: "Jan — Jun 2024",
    summary: "First contracts as a sworn developer.",
  },
  {
    company: "Makers of Baghdad",
    role: "Front-End & UI Design Intern",
    period: "Jul — Aug 2023",
    summary: "The tutorial quest: redrew a site in Figma, then rebuilt it in React.",
  },
  {
    company: "ZainCash",
    role: "Archive Officer",
    period: "Jan — Feb 2023",
    summary: "Kept the vault ledgers of a mobile wallet in order.",
  },
];

/** How an artifact can be met: live on the web, a desktop install, or client/employer work. */
export type ArtifactBadge = "Live" | "Desktop" | "Work";

export interface Artifact {
  name: string;
  kind: string;
  description: string;
  /** Only set for public products; private and work projects have no link. */
  url?: string;
  badge?: ArtifactBadge;
  tech: string[];
}

/** Projects: live product links where public, no repo links; private/work ones carry no link. */
export const artifacts: Artifact[] = [
  {
    name: "Spellscene",
    kind: "Cartographer's Table",
    description:
      "A 3D tabletop and campaign-prep tool for DMs running TTRPGs: maps, miniatures, campaigns and notes. English-first, with Arabic support.",
    url: "https://spellscene.com",
    badge: "Live",
    tech: ["React", "TypeScript", "Three.js", "Vite"],
  },
  {
    name: "Hook Menu",
    kind: "Merchant's Grimoire",
    description:
      "HOOK.iq — a digital menu platform for the café Hook: browse, order.",
    url: "https://hookiraq.com",
    badge: "Live",
    tech: ["Vue", "Vite", "Node.js"],
  },
  {
    name: "Healthy Don",
    kind: "Alchemist's Codex",
    description:
      "Dr. Zaid's healthy recipe book online — wholesome cooking, served as a web app.",
    url: "https://healthydon.com",
    badge: "Live",
    tech: ["Nuxt", "Vue"],
  },
  {
    name: "This Very Tome",
    kind: "Legendary Artifact",
    description:
      "The 3D inn you are sitting in right now. Three.js, Vue and far too many candles.",
    tech: ["Three.js", "Vue", "TypeScript", "GSAP"],
  },
  {
    name: "Booking System",
    kind: "Innkeeper's Ledger",
    description:
      "An offline concert table-booking app for a club cashier. The Windows installer is built in CI.",
    badge: "Desktop",
    tech: ["Electron", "Vue", "SQLite"],
  },
  {
    name: "Asset Maintenance Hub",
    kind: "Armorer's Workshop",
    description:
      "A desktop app tracking devices, maintenance records and parts inventory on a local SQLite database, with a stats dashboard.",
    badge: "Desktop",
    tech: ["Electron", "React", "SQLite"],
  },
  {
    name: "Dr.Lab",
    kind: "Apothecary's Ledger",
    description:
      "An Electron desktop app for medical lab management, with serial-key licensing and barcode label printing. Built at PureTik.",
    badge: "Work",
    tech: ["Electron"],
  },
  {
    name: "Oil Coupon",
    kind: "Royal Decree Engine",
    description:
      "Built at Enjaz: the admin dashboard and the SuperQi citizen mini app for kerosene and LPG allocations, serving over a million families.",
    badge: "Work",
    tech: ["Vue 3", "Svelte 5", "TypeScript"],
  },
  {
    name: "Alrabiaa Ticketing",
    kind: "Arena Gatekeeper",
    description:
      "Event ticketing with interactive Seats.io seat maps: an admin dashboard, a booking site and a Node/Express API.",
    badge: "Work",
    tech: ["Seats.io", "Node.js", "Express"],
  },
];

export const contact = {
  email: "baker.alazzawi0@gmail.com",
  github: { label: "github.com/SmoKerIV", url: "https://github.com/SmoKerIV" },
  linkedin: {
    label: "linkedin.com/in/baker-alazzawi",
    url: "https://linkedin.com/in/baker-alazzawi",
  },
  phone: { label: "+964 773 098 2555", tel: "+9647730982555" },
  instagram: {
    label: "@SmoKer_IV",
    url: "https://instagram.com/SmoKer_IV",
  },
};

/** Flavor lines cycled on the loading screen. */
export const loadingLines = [
  "Lighting the candles…",
  "Sharpening the blade…",
  "Dusting off the tome…",
  "Bribing the innkeeper…",
  "Rolling for initiative…",
  "Uncorking the caffeine elixir…",
  "Inscribing the runes…",
];

/** Colophon / back matter. */
export const colophon =
  "Bound in Baghdad. Written in TypeScript. Powered by caffeine. " +
  "No goblins were harmed in the making of this website.";

/**
 * Credits & licenses — rendered under the colophon on the contact page.
 * When you add real music to public/audio/, credit it here (e.g. CC-BY
 * requires attribution: "Track by Artist, licensed CC-BY 4.0").
 */
export const credits: string[] = [
  "Ambience: fire & wind synthesized in-browser via WebAudio — no samples, no license needed.",
  "Typefaces: Cinzel, Cinzel Decorative & IM Fell English via Google Fonts (OFL).",
  "3D scene: procedural models, no external assets.",
];

/* ------------------------------------------------------------------ */
/* Focus cards — parchment scrap shown when zoomed on a table item     */
/* (titles/flavor come from ITEM_LABELS in three/types.ts)             */
/* ------------------------------------------------------------------ */

/** Items that show a focus card: the tome opens instead, the die just rolls. */
export type FocusCardItem = Exclude<ItemId, "spellbook" | "dice">;

export interface CardEntry {
  primary: string;
  secondary?: string;
  /** Marks the ongoing quest on the shield card. */
  active?: boolean;
}

export interface CardLink {
  label: string;
  href: string;
  /** Opens in a new tab (https links; mailto/tel stay in-page). */
  external?: boolean;
  /** Saves the file under this name instead of navigating (same-origin only). */
  download?: string;
}

export interface ItemCardContent {
  /** Optional lead-in line above the list. */
  lead?: string;
  entries?: CardEntry[];
  links?: CardLink[];
}

/** Elixir label stat lines (potion focus card). */
export const potionStats: CardEntry[] = [
  { primary: "Caffeine saturation", secondary: "98% — do not dilute" },
  { primary: "Uptime granted", secondary: "99.9% (the 0.1% was a nap)" },
  { primary: "Side-project mana", secondary: "regenerates after midnight" },
  { primary: "Deadline resistance", secondary: "+5 to saving throws" },
];

export const itemCards: Record<FocusCardItem, ItemCardContent> = {
  sword: {
    lead: "Enchantments etched along the blade:",
    entries: spellSchools.map((school) => ({
      primary: school.school,
      secondary: school.spells.join(" · "),
    })),
  },
  shield: {
    lead: "Marks of every guild served:",
    entries: quests.map((quest) => ({
      primary: quest.company,
      secondary: quest.period,
      active: quest.current,
    })),
  },
  potion: {
    lead: "The label, in a careful alchemist's hand:",
    entries: potionStats,
  },
  scroll: {
    lead: "The raven knows these roads:",
    links: [
      { label: contact.email, href: `mailto:${contact.email}` },
      { label: contact.github.label, href: contact.github.url, external: true },
      {
        label: contact.linkedin.label,
        href: contact.linkedin.url,
        external: true,
      },
      { label: contact.phone.label, href: `tel:${contact.phone.tel}` },
      {
        label: contact.instagram.label,
        href: contact.instagram.url,
        external: true,
      },
      {
        label: "Download the CV (PDF)",
        href: "/baker-cv.pdf",
        download: "Baker Alazzawi CV.pdf",
      },
    ],
  },
  tankard: {
    entries: [
      {
        primary: "Refills itself between deploys.",
        secondary: "No one has ever found the bottom.",
      },
    ],
  },
  candle: {
    entries: [
      { primary: "Keeps the night watch over long refactors." },
      {
        primary: "They say five quick taps invite the dark.",
        secondary: "Surely just an innkeeper's tale.",
      },
    ],
  },
};
