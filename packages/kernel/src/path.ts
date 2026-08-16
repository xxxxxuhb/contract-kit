/** Deep-enough clone for contract data (objects / arrays of row records). */
export function cloneData(data: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(data)
}

function ensureContainer(parent: Record<string, unknown> | unknown[], key: string, childIsIndex: boolean) {
  if (Array.isArray(parent)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0) throw new Error(`invalid path index: ${key}`)
    while (parent.length <= index) parent.push(childIsIndex ? [] : {})
    const cur = parent[index]
    if (childIsIndex) {
      if (!Array.isArray(cur)) parent[index] = []
    } else if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) {
      parent[index] = {}
    }
    return parent[index] as Record<string, unknown> | unknown[]
  }

  const cur = parent[key]
  if (childIsIndex) {
    if (!Array.isArray(cur)) parent[key] = []
  } else if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) {
    parent[key] = {}
  }
  return parent[key] as Record<string, unknown> | unknown[]
}

/**
 * Set `path` on data. Supports:
 * - `partyA`
 * - `items` (whole value)
 * - `items.0.qty` (table cell)
 */
export function setDataPath(
  data: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path.includes('.')) {
    return { ...cloneData(data), [path]: value }
  }

  const parts = path.split('.')
  const next = cloneData(data)
  let cursor: Record<string, unknown> | unknown[] = next

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const childIsIndex = /^\d+$/.test(parts[i + 1])
    cursor = ensureContainer(cursor, key, childIsIndex)
  }

  const last = parts[parts.length - 1]
  if (Array.isArray(cursor)) {
    const index = Number(last)
    if (!Number.isInteger(index) || index < 0) throw new Error(`invalid path index: ${last}`)
    while (cursor.length <= index) cursor.push(undefined)
    cursor[index] = value
    return next
  }
  cursor[last] = value
  return next
}
