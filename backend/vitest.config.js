import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run test files sequentially – they share a single Postgres database
    fileParallelism: false,
    globalSetup: "./tests/globalSetup.js",
    include: [
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js",
    ],
    exclude: ["tests/helpers/**"],
    env: {
      ADMIN_TOKEN: "dev-admin-token-change-in-production",
    },
  },
});
