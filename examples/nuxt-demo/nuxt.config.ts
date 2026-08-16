import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

const packages = fileURLToPath(new URL('../../packages', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  css: ['~/assets/css/app.css', '~/assets/css/fields.css', 'contract-kit/ui/style.css', 'contract-kit/xlsx/style.css'],
  modules: ['@element-plus/nuxt'],
  elementPlus: {
    importStyle: 'css',
  },
  alias: {
    'contract-kit/ui/style.css': `${packages}/ui/src/style.css`,
    'contract-kit/xlsx/style.css': `${packages}/xlsx/src/style.css`,
    'contract-kit': `${packages}/contract-kit/src/index.ts`,
    '@contract-kit/kernel': `${packages}/kernel/src/index.ts`,
    '@contract-kit/docx': `${packages}/docx/src/index.ts`,
    '@contract-kit/xlsx': `${packages}/xlsx/src/index.ts`,
    '@contract-kit/ui': `${packages}/ui/src/index.ts`,
    '@contract-kit/pdf': `${packages}/pdf/src/index.ts`,
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
