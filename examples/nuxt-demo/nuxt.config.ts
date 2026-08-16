import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

const packages = fileURLToPath(new URL('../../packages', import.meta.url))
const uiStyle = fileURLToPath(new URL('../../packages/ui/src/style.css', import.meta.url))
const xlsxStyle = fileURLToPath(new URL('../../packages/xlsx/src/style.css', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  css: ['~/assets/css/app.css', '~/assets/css/fields.css', uiStyle, xlsxStyle],
  modules: ['@element-plus/nuxt'],
  elementPlus: {
    importStyle: 'css',
  },
  alias: {
    '@contract-kit/kernel': `${packages}/kernel/src/index.ts`,
    '@contract-kit/docx': `${packages}/docx/src/index.ts`,
    '@contract-kit/xlsx': `${packages}/xlsx/src/index.ts`,
    '@contract-kit/ui': `${packages}/ui/src/index.ts`,
  },
  vite: {
    optimizeDeps: {
      include: ['exceljs', 'jszip', 'docx-preview'],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
