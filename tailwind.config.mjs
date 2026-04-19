/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Forest / Drina palette
        forest: {
          950: "#0a1410",
          900: "#0e1d17",
          800: "#14291f",
          700: "#1c3a2c",
          600: "#25503c",
          500: "#3d6b52",
          400: "#668874",
        },
        // Bib / falcon amber
        amber: {
          DEFAULT: "#c8732a",
          light: "#e8a55c",
          dark: "#8c4a14",
        },
        // Paper / cream
        paper: {
          DEFAULT: "#f4ece0",
          dim: "#d8cfc0",
          dark: "#a89d8a",
        },
        bone: "#e8dfcf",
        ink: "#0e1d17",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        wider2: "0.18em",
        wider3: "0.28em",
      },
    },
  },
  plugins: [],
};
