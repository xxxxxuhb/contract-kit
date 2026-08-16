import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDataUrl } from '../src/image'

test('parseDataUrl reads png base64', () => {
  const parsed = parseDataUrl(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  )
  assert.ok(parsed)
  assert.equal(parsed?.ext, 'png')
  assert.ok((parsed?.bytes.length ?? 0) > 0)
})

test('parseDataUrl rejects non-image strings', () => {
  assert.equal(parseDataUrl('hello'), null)
  assert.equal(parseDataUrl('data:text/plain;base64,YQ=='), null)
})
