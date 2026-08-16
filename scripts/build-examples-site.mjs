#!/usr/bin/env node
/**
 * Build a minimal static landing for GitHub Pages.
 * The interactive demo is Nuxt (`npm run example`) and needs a Node server.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, 'dist-examples')

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(outRoot, { recursive: true })
cpSync(join(root, 'examples/site/index.html'), join(outRoot, 'index.html'))
writeFileSync(join(outRoot, '.nojekyll'), '', 'utf8')
console.log(`Built examples landing → ${outRoot}`)
