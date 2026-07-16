import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F6F4",
        surface: "#FFFFFF",
        ink: "#0F1F1B",
        muted: "#5B6B66",
        rule: "#DCE3DF",
        // Pharmacy cross green — grounded in the QCRx mark.
        rx: {
          50: "#EAF3F0",
          100: "#CFE5DE",
          400: "#3A9179",
          600: "#0F6B54",
          700: "#0A5342",
          900: "#063026",
        },
        hot: "#B3341C",
        warn: "#9A6700",
      },
      fontFamily: {
        sans: ["'Instrument Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { xs: "3px" },
      boxShadow: {
        panel: "0 1px 2px rgba(15,31,27,0.05), 0 8px 24px -12px rgba(15,31,27,0.18)",
      },
    },
  },
  plugins: [],
};
export default config;
