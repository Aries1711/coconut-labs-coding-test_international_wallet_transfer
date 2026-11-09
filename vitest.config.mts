import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the tsconfig "@/*" path alias so tests import the same way the
    // app does, and stay valid if a spec file moves.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/test/**/*.test.{ts,tsx}"],
    // Node for the domain/application/infrastructure specs; jsdom only for
    // component specs, which need a DOM to click on.
    environmentMatchGlobs: [["src/test/components/**", "jsdom"]],
    setupFiles: ["src/test/setup.ts"],
  },
});
