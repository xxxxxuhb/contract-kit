import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: { Buffer: true, process: true },
    }),
  ],
  server: {
    port: 5200,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@contract-kit/kernel': fileURLToPath(new URL('../../packages/kernel/src/index.ts', import.meta.url)),
      '@contract-kit/docx': fileURLToPath(new URL('../../packages/docx/src/index.ts', import.meta.url)),
      '@contract-kit/xlsx': fileURLToPath(new URL('../../packages/xlsx/src/index.ts', import.meta.url)),
      '@contract-kit/pdf': fileURLToPath(new URL('../../packages/pdf/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['exceljs', 'jszip', 'html2canvas', 'jspdf'],
  },
  root,
})
