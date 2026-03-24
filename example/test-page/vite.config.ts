import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@privy-io/react-auth',
      '@privy-io/wagmi',
      '@tanstack/react-query',
      'wagmi',
      'viem',
    ],
  },
  server: { port: 5174 },
  define: {
    global: 'globalThis',
  },
});
