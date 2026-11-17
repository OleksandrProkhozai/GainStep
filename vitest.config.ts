import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Аліас "@/…" з tsconfig.json для тестів.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
