import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add Node.js polyfills
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    }
  },
  build: {
    rollupOptions: {
      // Enable rollup polyfills for node modules
      plugins: []
    }
  },
  define: {
    'process.env': {},
    global: 'window',
  }
}));
