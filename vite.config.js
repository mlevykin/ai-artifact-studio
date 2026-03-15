// ─── vite.config.js ───────────────────────────────────────────────────────────
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Все запросы /api/anthropic/* → api.anthropic.com/*
        // API-ключ подставляется здесь — в браузер не попадает
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/anthropic/, ""),
          headers: {
            "x-api-key":         env.ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
          },
        },
      },
    },
  };
});


// ─── .env.example ─────────────────────────────────────────────────────────────
// Скопируй в .env и вставь свой ключ:
//
// ANTHROPIC_API_KEY=sk-ant-api03-...


// ─── package.json ─────────────────────────────────────────────────────────────
// {
//   "name": "artifact-studio",
//   "version": "0.1.0",
//   "private": true,
//   "scripts": {
//     "dev":   "vite",
//     "build": "vite build",
//     "preview": "vite preview"
//   },
//   "dependencies": {
//     "react":     "^18.3.1",
//     "react-dom": "^18.3.1"
//   },
//   "devDependencies": {
//     "@vitejs/plugin-react": "^4.3.1",
//     "vite": "^5.4.1"
//   }
// }