import { nodePolyfills } from 'vite-plugin-node-polyfills'
import react from '@vitejs/plugin-react'
import { defineConfig, Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'node:path'

const shimAliases = {
  'vite-plugin-node-polyfills/shims/buffer': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js'),
  'vite-plugin-node-polyfills/shims/global': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/global/dist/index.js'),
  'vite-plugin-node-polyfills/shims/process': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/process/dist/index.js'),
}

const resolveNodePolyfillShims = (): Plugin => ({
  name: 'resolve-node-polyfill-shims',
  enforce: 'pre',
  resolveId(source) {
    if (source in shimAliases) {
      return shimAliases[source as keyof typeof shimAliases]
    }
    return null
  }
})

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: shimAliases
  },
  plugins: [
    resolveNodePolyfillShims(),
    nodePolyfills({}),
    react(),
    tailwindcss(),
    viteTsconfigPaths({
      //
      root: resolve(__dirname)
    })
  ]
})
