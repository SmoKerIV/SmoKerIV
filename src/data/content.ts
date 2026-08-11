/**
 * All portfolio content, rethemed for the fantasy spellbook.
 * This is the single file to edit when facts change.
 */

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
    "A developer who ships fast and fixes faster. Fluent in the arcane arts of " +
    "TypeScript on both fronts of the battlefield — client and server — and " +
    "sustained almost entirely by caffeine.",
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
    spells: ["TypeScript", "React", "Vue", "Next.js", "Nuxt.js"],
  },
  {
    school: "Conjuration — Backend",
    spells: ["Node.js", "Express.js", "NestJS", "Supabase", "Firebase"],
  },
  {
    school: "Transmutation — Data & Infra",
    spells: ["PostgreSQL", "Prisma", "Drizzle", "Docker", "Linux"],
  },
];

export interface Quest {
  company: string;
  role: string;
  period: string;
  current?: boolean;
  summary: string;
}

/** Career as a quest log, newest first. */
export const quests: Quest[] = [
  {
    company: "Qi Card",
    role: "Software Developer",
    period: "Jul 2025 — Present",
    current: true,
    summary: "The ongoing campaign: fintech at national scale.",
  },
  {
    company: "Alrabiaa TV",
    role: "Software Developer",
    period: "Feb — Jun 2025",
    summary: "Kept the broadcast beacons burning.",
  },
  {
    company: "Puretik",
    role: "Software Developer",
    period: "Jun 2024 — Jun 2025",
    summary: "A year-long expedition through full-stack lands.",
  },
  {
    company: "Aon",
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
    role: "Frontend Intern",
    period: "Jul — Aug 2023",
    summary: "The tutorial quest. Everyone starts somewhere.",
  },
];

export interface Artifact {
  name: string;
  kind: string;
  description: string;
  url?: string;
  tech: string[];
}

/** Published projects — live product links only, no repo links. */
export const artifacts: Artifact[] = [
  {
    name: "Hook Menu",
    kind: "Merchant's Grimoire",
    description:
      "HOOK.iq — a digital menu platform for Iraqi restaurants and cafés: browse, order.",
    url: "https://hookiraq.com",
    tech: ["Vue", "Vite", "Node.js"],
    },
  {
    name: "Healthy Don",
    kind: "Alchemist's Codex",
    description:
      "Dr. Zaid's healthy recipe book online — wholesome cooking, served as a web app.",
    url: "https://healthydon.com",
    tech: ["Nuxt", "Vue"],
  },
  {
    name: "This Very Tome",
    kind: "Legendary Artifact",
    description:
      "The 3D inn you are sitting in right now. Three.js, Vue and far too many candles.",
    tech: ["Three.js", "Vue", "TypeScript", "GSAP"],
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
