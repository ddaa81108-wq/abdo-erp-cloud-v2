import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Firebase is intentionally kept as one cached vendor file. The app
      // itself and all optional sections remain well below this threshold.
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'index.html'),
          cardStudio: path.resolve(__dirname, 'card-generator.html'),
        },
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/node_modules/firebase/')
              || id.includes('/node_modules/@firebase/')
            ) return 'firebase';
            if (id.includes('/node_modules/framer-motion/')) return 'motion';
            if (
              id.includes('/node_modules/react/')
              || id.includes('/node_modules/react-dom/')
              || id.includes('/node_modules/scheduler/')
            ) return 'react';
            if (id.includes('/node_modules/lucide-react/')) return 'icons';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
