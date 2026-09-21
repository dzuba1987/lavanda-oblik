import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Той самий аліас, що й у tsconfig, — без нього тести не можуть імпортувати
  // нічого з app/lib, бо там всюди "@/…".
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
