import { defineConfig } from "vitest/config";

// Hub360 tests only. Not part of the default test run.
export default defineConfig({ test: { include: ["tests/_deferred/**/*.test.ts"] } });
