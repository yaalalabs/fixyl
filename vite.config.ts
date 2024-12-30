import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc';
import commonjs from 'vite-plugin-commonjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), commonjs(),],
  server: {
    port: 3000,
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api', 'import']
      }
    }
  },
  resolve: {
    alias: {
      src: "/src",
    },
  },
  define: {
    global: {},
  },
  base: "./",
  build: {
    outDir: 'build',
    emptyOutDir: true, // also necessary
    assetsDir: '.', // Place all assets (CSS/JS) directly in the root
    rollupOptions: {
      output: {
        // Ensure files are placed directly in the root
        chunkFileNames: '[name]-[hash].js',
        entryFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  }
})
