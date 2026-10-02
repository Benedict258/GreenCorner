import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/_deferred/**", "node_modules/**"], fileParallelism: false },
});
