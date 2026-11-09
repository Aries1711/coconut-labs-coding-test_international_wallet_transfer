import type { Config } from "tailwindcss";

export default {
  // Only the layers that can contain class names. Scanning domain/application/
  // infrastructure/test files buys nothing and makes Tailwind track files that
  // have no bearing on the stylesheet.
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
