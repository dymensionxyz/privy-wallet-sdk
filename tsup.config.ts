import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'wagmi',
    'viem',
    '@privy-io/react-auth',
    '@privy-io/wagmi',
    '@tanstack/react-query',
  ],
  treeshake: true,
});
