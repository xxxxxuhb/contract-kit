export function downloadBuffer(filename: string, buffer: Uint8Array, mime: string) {
  const blob = new Blob([buffer.slice()], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
