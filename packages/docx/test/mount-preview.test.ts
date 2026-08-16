import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import type { FormSchemaField } from '@contract-kit/kernel'
import {
  expandRepeatingRows,
  resolveDocxSlot,
  rewriteTableMarkersInRow,
  shouldSkipUnexpandedTableParent,
} from '../src/mount-preview'

function withDom<T>(run: (document: Document) => T): T {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  ;(globalThis as { window: unknown }).window = dom.window
  ;(globalThis as { document: unknown }).document = dom.window.document
  ;(globalThis as { NodeFilter: unknown }).NodeFilter = dom.window.NodeFilter
  try {
    return run(dom.window.document)
  } finally {
    ;(globalThis as { window: unknown }).window = prevWindow
    ;(globalThis as { document: unknown }).document = prevDocument
    dom.window.close()
  }
}

test('resolveDocxSlot reads nested table cells and errors', () => {
  const fields: FormSchemaField[] = [
    {
      id: '1',
      name: 'items',
      type: 'table',
      label: '明细',
      columns: [{ name: 'name', type: 'text', label: '货物', required: true }],
      value: [{ name: '苹果' }],
    },
  ]
  const resolved = resolveDocxSlot('items.0.name', fields, {
    ok: false,
    issues: [{ path: 'items.0.name', message: '货物 必填' }],
  })
  assert.equal(resolved.value, '苹果')
  assert.equal(resolved.field.type, 'text')
  assert.equal(resolved.error, '货物 必填')
})

test('rewriteTableMarkersInRow expands items.* and $index', () => {
  withDom((document) => {
    const tr = document.createElement('tr')
    tr.innerHTML = '<td>{{items.$index}}</td><td>{{items.name}}</td>'
    rewriteTableMarkersInRow(tr, 'items', 1)
    assert.equal(tr.textContent, '2{{items.1.name}}')
  })
})

test('expandRepeatingRows keeps one placeholder row when the table is empty', () => {
  withDom((document) => {
    const table = document.createElement('table')
    table.innerHTML = '<tr><td>{{items.name}}</td></tr>'
    document.body.appendChild(table)
    expandRepeatingRows(document.body, [
      { id: '1', name: 'items', type: 'table', columns: [{ name: 'name', type: 'text' }], value: [] },
    ])
    const rows = [...table.querySelectorAll('tr')]
    assert.equal(rows.length, 1)
    assert.equal(rows[0].textContent, '{{items.0.name}}')
  })
})

test('expandRepeatingRows clones template rows from data length', () => {
  withDom((document) => {
    const table = document.createElement('table')
    table.innerHTML = '<tr><td>{{items.name}}</td></tr>'
    document.body.appendChild(table)
    expandRepeatingRows(document.body, [
      {
        id: '1',
        name: 'items',
        type: 'table',
        label: '明细',
        columns: [{ name: 'name', type: 'text' }],
        value: [{ name: '苹果' }, { name: '橙' }],
      },
    ])
    const rows = [...table.querySelectorAll('tr')]
    assert.equal(rows.length, 2)
    assert.equal(rows[0].textContent, '{{items.0.name}}')
    assert.equal(rows[1].textContent, '{{items.1.name}}')
  })
})

test('shouldSkipUnexpandedTableParent ignores template row markers', () => {
  assert.equal(shouldSkipUnexpandedTableParent('{{items.name}}'), true)
  assert.equal(shouldSkipUnexpandedTableParent('{{items.0.name}}'), false)
  assert.equal(shouldSkipUnexpandedTableParent('甲方 {{partyA}}'), false)
})
