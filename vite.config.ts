import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';
import { createBrandFavicon } from './app/shared/brand-assets.ts';

function favicon() {
  return createBrandFavicon(
    readFileSync(new URL('./app/styles/app.css', import.meta.url), 'utf8'),
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      tailwindcss(),
      reactRouter(),
      {
        name: 'swiftdrop-brand-assets',
        configureServer(server) {
          server.middlewares.use('/favicon.svg', (request, response, next) => {
            if (request.method !== 'GET' && request.method !== 'HEAD')
              return next();
            response.setHeader('Content-Type', 'image/svg+xml');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(request.method === 'HEAD' ? undefined : favicon());
          });
        },
        generateBundle() {
          if (this.environment.name === 'client')
            this.emitFile({
              type: 'asset',
              fileName: 'favicon.svg',
              source: favicon(),
            });
        },
      },
    ],
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
        '/graphql': {
          target: env.DEV_GATEWAY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
