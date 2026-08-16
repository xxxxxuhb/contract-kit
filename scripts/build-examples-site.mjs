#!/usr/bin/env node
/**
 * Build native-ui + custom-ui into dist-examples/ for GitHub Pages.
 * Usage:
 *   EXAMPLES_BASE=/contract-kit/ node scripts/build-examples-site.mjs
 * Local default base is / (site served from dist-examples root).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, 'dist-examples')
const baseRoot = (process.env.EXAMPLES_BASE ?? '/').replace(/\/?$/, '/')

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(outRoot, { recursive: true })

run('npm', ['run', 'templates'])

run('npm', ['run', 'build', '-w', '@contract-kit/example-native-ui'], {
  EXAMPLE_BASE: `${baseRoot}native/`,
  EXAMPLE_OUT_DIR: join(outRoot, 'native'),
})

run('npm', ['run', 'build', '-w', '@contract-kit/example-custom-ui'], {
  EXAMPLE_BASE: `${baseRoot}custom/`,
  EXAMPLE_OUT_DIR: join(outRoot, 'custom'),
})

cpSync(join(root, 'examples/site/index.html'), join(outRoot, 'index.html'))

// Helpful for project Pages: ensure trailing-slash paths resolve.
writeFileSync(
  join(outRoot, '.nojekyll'),
  '',
  'utf8',
)

console.log(`Built examples site → ${outRoot} (base ${baseRoot})`)
