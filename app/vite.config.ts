import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'
import { compression } from 'vite-plugin-compression2'
import inject from '@rollup/plugin-inject'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteTsconfigPaths({
      root: resolve(__dirname)
    }),
    topLevelAwait(),
    wasm(),
    compression(),
    inject({
      assert: ['assert', 'default']
    }),
    nodePolyfills()
  ],
  define: {
    'process.env.NODE_DEBUG': 'false',
    'process.browser': `"test"`,
    'process.version': `"test"`
  },
  resolve: {
    alias: {
      'node:buffer': 'buffer/',
      'node:stream': 'stream-browserify',
      'node:util': 'util/',
      'node:process': 'process/browser',
    }
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      external: ['fs/promises', 'path'],
      plugins: [inject({ Buffer: ['buffer', 'Buffer'] })]
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    }
  }
})
