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
    port: 5199,
    strictPort: true,
  },
  resolve: {
    alias: [
      {
        find: '@contract-kit/ui/style.css',
        replacement: fileURLToPath(new URL('../../packages/ui/src/style.css', import.meta.url)),
      },
      {
        find: '@contract-kit/ui',
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      },
      { find: '@shared', replacement: fileURLToPath(new URL('../shared', import.meta.url)) },
      {
        find: '@contract-kit/kernel',
        replacement: fileURLToPath(new URL('../../packages/kernel/src/index.ts', import.meta.url)),
      },
      {
        find: '@contract-kit/docx',
        replacement: fileURLToPath(new URL('../../packages/docx/src/index.ts', import.meta.url)),
      },
      {
        find: '@contract-kit/xlsx',
        replacement: fileURLToPath(new URL('../../packages/xlsx/src/index.ts', import.meta.url)),
      },
      {
        find: '@contract-kit/pdf',
        replacement: fileURLToPath(new URL('../../packages/pdf/src/index.ts', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    include: ['exceljs', 'jszip', 'html2canvas', 'jspdf'],
  },
  root,
})
