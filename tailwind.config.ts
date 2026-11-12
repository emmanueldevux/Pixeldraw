import type { Config } from "tailwindcss";

const config: Config = {
  content: [
     "./src/**/*.{js,ts,jsx,tsx,mdx}",

  ],
  theme: {
    extend: {
      /* ============================================================
         UXLLY DESIGN TOKENS — dark theme
         Same token names as before (brand/surface/ink/status), so every
         existing component using them re-themes automatically. Only the
         actual color values changed — semantic meaning is preserved:
         surface-0 is still "the most prominent panel background",
         ink-900 is still "highest-emphasis text", etc. — just realized
         as light-on-dark instead of dark-on-light.
         ============================================================ */
      colors: {
        brand: {
          50: "#EAF1FF",
          100: "#D6E4FF",
          200: "#AECBFF",
          300: "#87A9FF", /* ms-icon-accent */
          400: "#5E92FF",
          500: "#4285F4", /* Primary accent */
          600: "#346BF0", /* hover / pressed */
          700: "#2A54C4",
          800: "#1F3E93",
          900: "#152A66",
        },
        surface: {
          0: "#1F1F1F",   /* raised panels — cards, inputs, modals */
          50: "#191919",  /* page background */
          100: "#252525", /* secondary panels — chips, secondary buttons */
          200: "#262626", /* borders / outlines */
          300: "#2A2A2A", /* hover state */
        },
        ink: {
          950: "#FCFCFC", /* headings — highest emphasis */
          900: "#FFFFFF",
          800: "#E2E2E5",
          700: "#D4D4D4", /* default body text */
          600: "#B5B5B5",
          500: "#8C8C8C", /* secondary/variant text */
          400: "#707070",
          300: "#575757", /* dim/disabled/placeholder */
        },
        status: {
          success: "#2FBF6E",
          warning: "#FCBD00",
          error: "#DB372D",
          info: "#4285F4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "12px",
        button: "8px",
        input: "8px",
        chip: "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover":
          "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)",
        modal:
          "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "pulse-dot": "pulseDot 2s infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};

export default config;