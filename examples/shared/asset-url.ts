/** Resolve a public asset under Vite `base` (GitHub Pages subpath-safe). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalized = path.replace(/^\//, '')
  return `${base}${normalized}`
}

export function templateUrl(filename: string): string {
  return assetUrl(`templates/${encodeURIComponent(filename)}`)
}
