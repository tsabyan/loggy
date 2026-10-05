import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Default env is node (schemas, executor, context). Component tests opt in
// with a `// @vitest-environment jsdom` comment at the top of the file.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "evals/**/*.test.ts"],
    env: { AI_PROVIDER: "mock" },
  },
});
