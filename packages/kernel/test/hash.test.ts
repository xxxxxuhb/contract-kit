import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashBytes } from '../src/hash'

test('hashBytes is stable and changes with input', async () => {
  const a = await hashBytes(new Uint8Array([1, 2, 3]))
  const b = await hashBytes(new Uint8Array([1, 2, 3]))
  const c = await hashBytes(new Uint8Array([1, 2, 4]))
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]+$/)
})
