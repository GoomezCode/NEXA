import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaProxy: Record<string, ProxyOptions> = {
    '/ollama': {
      target: env.VITE_OLLAMA_PROXY || 'http://127.0.0.1:11434',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ollama/, ''),
      configure: (proxy) => {
        // O navegador fala com a origem da Web; o Ollama recebe a chamada pelo
        // proxy local e não deve validar o Origin da página da rede.
        proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
      },
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(env.ANALYZE === 'true'
        ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false })]
        : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/health': {
          target: env.VITE_API_PROXY || 'http://localhost:8000',
          changeOrigin: true,
        },
        ...ollamaProxy,
      },
    },
    preview: {
      proxy: {
        ...ollamaProxy,
      },
    },
    build: {
      sourcemap: false,
    },
  };
});
