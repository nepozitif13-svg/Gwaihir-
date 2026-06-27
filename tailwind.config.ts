import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Forensic-instrument palette
        manila: "#EAE6DC",
        "manila-deep": "#E1DCCE",
        ink: "#243133",
        "ink-soft": "#48565A",
        hairline: "#D6D1C4",
        ochre: "#B9842A",
        "ochre-soft": "#F1E4C9",
        sage: "#6E7F66",
        "sage-soft": "#DDE3D4",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
