/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The root .env (all keys, not just VITE_*): only used here, never shipped to the browser
  const env = loadEnv(mode, '..', '');
  // Like Vercel in production: forward /api to Spring Boot, with the proxy secret when one is set
  const api: ProxyOptions = {
    target: 'http://localhost:8080',
    changeOrigin: false,
    headers: env.NOVA_PROXY_SECRET ? { 'X-Nova-Proxy-Secret': env.NOVA_PROXY_SECRET } : undefined,
  };
  return {
    plugins: [react(), tailwindcss()],
    // One .env at the repository root serves backend, docker-compose and frontend (VITE_* only are exposed).
    envDir: '..',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // In development the browser talks only to Vite (one origin). Vite forwards /api to
      // Spring Boot, so session and CSRF cookies are first-party — the same shape as production,
      // where the hosting platform rewrites /api to the backend.
      proxy: { '/api': api },
    },
    // `npm run preview` serves the production build the same way (used to test the Docker backend)
    preview: {
      port: 4173,
      proxy: { '/api': api },
    },
    build: {
      sourcemap: true,
      // dist/.vite/manifest.json: scripts/bundle-size.mjs reads it to measure each first visit
      manifest: true,
      rolldownOptions: {
        output: {
          // Libraries in their own long-lived chunks: they change far less often than app code, so a
          // deploy doesn't make returning visitors download React again
          advancedChunks: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'router', test: /node_modules[\\/]react-router/ },
              { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
              { name: 'forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      // Playwright's end-to-end specs live in e2e/ and run with `npm run e2e`
      include: ['src/**/*.test.{ts,tsx}'],
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      // Room for a lazy page's first load plus several waits (see src/test/setup.ts)
      testTimeout: 15_000,
    },
  };
});
