import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const target = process.env.BOOKING_TEST_TARGET ?? 'http://127.0.0.1:5088';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(target).hostname)) {
  throw new Error('The booking fixture target must be loopback.');
}

// Independent test entry. React Router's production build never imports it.
export default defineConfig({
  root: fileURLToPath(new URL('./test-harness', import.meta.url)),
  plugins: [tailwindcss()],
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
    proxy: { '/api': { target }, '/__test': { target } },
  },
  build: { outDir: '../build/booking-test', emptyOutDir: true },
});
