import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

const packages = fileURLToPath(new URL('../../packages', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  css: ['~/assets/css/app.css', '~/assets/css/fields.css', 'paperfill/ui/style.css', 'paperfill/xlsx/style.css'],
  modules: ['@element-plus/nuxt'],
  elementPlus: {
    importStyle: 'css',
  },
  alias: {
    'paperfill/ui/style.css': `${packages}/ui/src/style.css`,
    'paperfill/xlsx/style.css': `${packages}/xlsx/src/style.css`,
    'paperfill': `${packages}/paperfill/src/index.ts`,
    '@paperfill/kernel': `${packages}/kernel/src/index.ts`,
    '@paperfill/docx': `${packages}/docx/src/index.ts`,
    '@paperfill/xlsx': `${packages}/xlsx/src/index.ts`,
    '@paperfill/ui': `${packages}/ui/src/index.ts`,
    '@paperfill/pdf': `${packages}/pdf/src/index.ts`,
  },
  vite: {
    optimizeDeps: {
      include: ['exceljs', 'jszip', 'docx-preview', 'html2canvas', 'jspdf'],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
