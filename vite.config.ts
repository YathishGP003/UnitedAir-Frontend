import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Every backend route the app touches is proxied, so the browser only ever talks
// to one origin in development and no CORS preflight is involved.
const BACKEND = process.env.VITE_BACKEND_URL ?? "http://localhost:8080";

const PROXIED_PATHS = [
  "/auth",
  "/sessions",
  "/ai",
  "/audit",
  "/kb",
  "/tools",
  "/commerce",
  "/staff/refunds",
  "/actions",
  "/feedback",
  "/admin",
  "/actuator",
  "/v3/api-docs",
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: Object.fromEntries(
      PROXIED_PATHS.map((path) => [
        path,
        {
          target: BACKEND,
          changeOrigin: true,
        },
      ]),
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: resolve(process.cwd(), "src/test/setup.ts"),
  },
});
