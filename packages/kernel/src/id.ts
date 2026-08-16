export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
