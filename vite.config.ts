import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), reactRouter()],
    // Prebundle shared dependencies to avoid reloads as route modules are added.
    optimizeDeps: {
      include: [
        '@tanstack/react-query',
        '@hookform/resolvers/zod',
        'react-hook-form',
        'zod',
      ],
    },
    resolve: {
      alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) },
    },
    server: {
      proxy: {
        '/api': {
          target: env.DEV_GATEWAY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
