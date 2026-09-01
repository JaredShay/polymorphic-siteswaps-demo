/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/polymorphic-siteswaps-demo/",
  test: {
    globals: false,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
