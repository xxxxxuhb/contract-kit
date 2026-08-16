export type ParsedDataUrl = {
  mime: string
  ext: string
  bytes: Uint8Array
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

export function parseDataUrl(value: unknown): ParsedDataUrl | null {
  if (typeof value !== 'string') return null
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(value.trim())
  if (!match) return null
  const mime = match[1].toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) return null
  try {
    const b64 = match[2].replace(/\s/g, '')
    const bytes =
      typeof Buffer !== 'undefined'
        ? new Uint8Array(Buffer.from(b64, 'base64'))
        : Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    return { mime, ext, bytes }
  } catch {
    return null
  }
}

export function isImageDataUrl(value: unknown): boolean {
  return parseDataUrl(value) !== null
}
