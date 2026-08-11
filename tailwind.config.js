/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Cinzel"', "Georgia", "serif"],
        decorative: ['"Uncial Antiqua"', '"Cinzel"', "serif"],
        body: ['"EB Garamond"', "Garamond", '"Times New Roman"', "serif"],
        mono: ['"Fira Code"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        parchment: {
          DEFAULT: "#e8dcc0",
          dark: "#d9c7a0",
          deep: "#c8b184",
        },
        ink: {
          DEFAULT: "#2a1f14",
          soft: "#4a3826",
          faint: "#6b5638",
        },
        leather: {
          DEFAULT: "#5a2e1d",
          dark: "#3a1d11",
          light: "#7a4630",
        },
        gold: {
          DEFAULT: "#b08d3c",
          bright: "#d4af5e",
        },
        arcane: {
          DEFAULT: "#35d0ba",
          dim: "#1e8577",
          faint: "#0f4d45",
        },
        night: "#0d0a08",
        wax: {
          DEFAULT: "#8b2320",
          dark: "#5e130f",
        },
      },
      boxShadow: {
        candle:
          "0 0 24px 4px rgba(255, 170, 60, 0.18), 0 0 64px 12px rgba(255, 140, 40, 0.08)",
        tome: "0 24px 80px rgba(0, 0, 0, 0.75), 0 8px 24px rgba(0, 0, 0, 0.6)",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
      },
    },
  },
  plugins: [],
};
