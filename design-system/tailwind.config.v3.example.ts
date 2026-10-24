import type { Config } from "tailwindcss";

// Exemplo para Tailwind CSS v3. Faça merge com a configuração atual;
// não substitua content/plugins/extend já existentes sem revisar o projeto.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,vue,svelte}"],
  theme: {
    screens: {
      sm: "576px",
      md: "768px",
      lg: "992px",
      xl: "1200px",
      "2xl": "1400px",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0d6efd",
          hover: "#0b5ed7",
          active: "#0a58ca",
          subtle: "#cfe2ff",
          emphasis: "#052c65",
        },
        secondary: { DEFAULT: "#6c757d", hover: "#5c636a" },
        success: { DEFAULT: "#198754", hover: "#157347", subtle: "#d1e7dd" },
        info: { DEFAULT: "#0dcaf0", hover: "#31d2f2", subtle: "#cff4fc" },
        warning: { DEFAULT: "#ffc107", hover: "#ffca2c", subtle: "#fff3cd" },
        danger: { DEFAULT: "#dc3545", hover: "#bb2d3b", subtle: "#f8d7da" },
        light: "#f8f9fa",
        dark: "#212529",
        background: "#f8f9fa",
        surface: "#ffffff",
        foreground: "#212529",
        muted: "#6c757d",
        border: "#dee2e6",
        ring: "#86b7fe",
      },
      borderRadius: {
        control: "0.375rem",
        card: "0.75rem",
        dialog: "0.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
