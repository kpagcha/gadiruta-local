/** Configure the local dev server and static production build; this file runs in Node. */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Compile utility styles and JSX together during both development and production builds.
  plugins: [tailwindcss(), react()],
  // Keep the local URLs predictable for the contributor commands documented in this repository.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
