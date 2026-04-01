import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary:    { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:  { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted:      { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:     { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive:{ DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card:       { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        /* Nexus Precision surface tokens */
        surface: {
          DEFAULT:  "#f7f9fb",
          low:      "#f2f4f6",
          card:     "#ffffff",
          high:     "#e6e8ea",
          highest:  "#e0e3e5",
          dim:      "#d8dadc",
        },
        nexus: {
          primary:  "#4F46E5",
          deep:     "#3525cd",
          fixed:    "#e2dfff",
          sidebar:  "#181445",
          green:    "#059669",
          amber:    "#B45309",
          red:      "#DC2626",
          blue:     "#2563EB",
          text:     "#191c1e",
          muted:    "#464555",
          outline:  "#777587",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl":"1.25rem",
      },
      boxShadow: {
        card:     "0 2px 12px rgba(25,28,30,0.05), 0 1px 3px rgba(25,28,30,0.04)",
        float:    "0 12px 32px rgba(25,28,30,0.06)",
        elevated: "0 8px 24px rgba(79,70,229,0.08)",
      },
      keyframes: {
        shimmer: {
          "0%":    { backgroundPosition: "-400px 0" },
          "100%":  { backgroundPosition: "400px 0" },
        },
        fadeIn: {
          "0%":    { opacity: "0", transform: "translateY(4px)" },
          "100%":  { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
        fadeIn:  "fadeIn 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
