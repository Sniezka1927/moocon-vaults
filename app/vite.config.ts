import { nodePolyfills } from 'vite-plugin-node-polyfills'
import react from '@vitejs/plugin-react'
import { defineConfig, Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const shimAliases = {
  'vite-plugin-node-polyfills/shims/buffer': require.resolve(
    'vite-plugin-node-polyfills/shims/buffer'
  ),
  'vite-plugin-node-polyfills/shims/global': require.resolve(
    'vite-plugin-node-polyfills/shims/global'
  ),
  'vite-plugin-node-polyfills/shims/process': require.resolve(
    'vite-plugin-node-polyfills/shims/process'
  )
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
