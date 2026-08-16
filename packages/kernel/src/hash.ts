export async function hashBytes(buffer: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const copy = new Uint8Array(buffer.byteLength)
    copy.set(buffer)
    const digest = await subtle.digest('SHA-256', copy)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 2166136261
  for (const b of buffer) {
    h ^= b
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
