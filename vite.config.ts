import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Replaces process.env.API_KEY with the actual value during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevents "process is not defined" errors from 3rd party libs
      'process.env': JSON.stringify({}),
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      // pdfjs-dist and other modern libs require esnext or es2022
      target: 'esnext', 
    }
  };
});