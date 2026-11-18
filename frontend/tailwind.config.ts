import type { Config } from "tailwindcss";

// Colour tokens are RGB triplets defined in index.css so the same utility
// classes work in both themes (rgb(var(--c-x) / <alpha-value>)).
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: token("ink"),
        paper: token("paper"),
        card: token("card"),
        line: token("line"),
        muted: token("muted"),
        forest: {
          50: token("forest-50"),
          100: token("forest-100"),
          200: token("forest-200"),
          300: token("forest-300"),
          400: token("forest-400"),
          500: token("forest-500"),
          600: token("forest-600"),
          700: token("forest-700"),
          800: token("forest-800"),
          900: token("forest-900"),
          950: token("forest-950"),
        },
        sage: {
          50: token("sage-50"),
          100: token("sage-100"),
          200: token("sage-200"),
          300: token("sage-300"),
          400: token("sage-400"),
        },
        clay: {
          50: token("clay-50"),
          100: token("clay-100"),
          200: token("clay-200"),
          400: token("clay-400"),
          500: token("clay-500"),
          600: token("clay-600"),
        },
        survey: {
          50: token("survey-50"),
          100: token("survey-100"),
          200: token("survey-200"),
          500: token("survey-500"),
          600: token("survey-600"),
          700: token("survey-700"),
        },
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        arabic: [
          "Noto Naskh Arabic",
          "Segoe UI",
          "Tahoma",
          "Traditional Arabic",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px -18px rgba(0, 0, 0, 0.45)",
        lift: "0 2px 4px rgba(0, 0, 0, 0.08), 0 18px 40px -24px rgba(0, 0, 0, 0.55)",
      },
      borderRadius: {
        card: "0.625rem",
      },
      backgroundImage: {
        topo: "radial-gradient(circle at 1px 1px, rgb(var(--c-ink) / 0.09) 1px, transparent 0)",
      },
      backgroundSize: {
        topo: "22px 22px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "pulse-soft": "pulseSoft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
