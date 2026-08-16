import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import type { FormSchemaField, XlsxPreviewSheet } from '@contract-kit/kernel'
import { expandXlsxSheets, mountXlsxPreview } from '../src/mount-preview'

function withDom<T>(run: () => T): T {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  ;(globalThis as { window: unknown }).window = dom.window
  ;(globalThis as { document: unknown }).document = dom.window.document
  try {
    return run()
  } finally {
    ;(globalThis as { window: unknown }).window = prevWindow
    ;(globalThis as { document: unknown }).document = prevDocument
    dom.window.close()
  }
}

test('expandXlsxSheets clones template row and rewrites field paths', () => {
  const sheets: XlsxPreviewSheet[] = [
    {
      name: '合同',
      colWidths: [10, 12],
      cells: [
        [
          { inlines: [{ type: 'field', name: 'items.$index' }] },
          { inlines: [{ type: 'field', name: 'items.name' }], style: { background: '#4472c4' } },
        ],
      ],
    },
  ]
  const fields: FormSchemaField[] = [
    {
      id: '1',
      name: 'items',
      type: 'table',
      label: '明细',
      columns: [{ name: 'name', type: 'text' }],
      value: [{ name: '苹果' }, { name: '橙' }],
    },
  ]
  const expanded = expandXlsxSheets(sheets, fields)
  assert.equal(expanded[0].cells.length, 2)
  assert.deepEqual(expanded[0].cells[0][0].inlines, [{ type: 'text', text: '1' }])
  assert.deepEqual(expanded[0].cells[0][1].inlines, [{ type: 'field', name: 'items.0.name' }])
  assert.equal(expanded[0].cells[0][1].style?.background, '#4472c4')
  assert.deepEqual(expanded[0].cells[1][0].inlines, [{ type: 'text', text: '2' }])
  assert.deepEqual(expanded[0].cells[1][1].inlines, [{ type: 'field', name: 'items.1.name' }])
})

test('mountXlsxPreview mounts field slots and applies cell background', () => {
  withDom(() => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const mounted: string[] = []
    const handle = mountXlsxPreview(host, {
      sheets: [
        {
          name: '合同',
          colWidths: [10],
          cells: [
            [
              {
                inlines: [{ type: 'field', name: 'partyA' }],
                style: { background: '#1e3a5f', color: '#ffffff' },
              },
            ],
          ],
        },
      ],
      fields: [
        {
          id: '1',
          name: 'partyA',
          type: 'text',
          label: '甲方',
          value: '星河',
        },
      ],
      mountField: (container, ctx) => {
        mounted.push(ctx.name)
        container.textContent = String(ctx.value ?? '')
        return {
          update() {},
          destroy() {
            container.replaceChildren()
          },
        }
      },
      onChange() {},
    })

    assert.deepEqual(mounted, ['partyA'])
    const td = host.querySelector('td') as HTMLTableCellElement
    assert.equal(td.style.backgroundColor, 'rgb(30, 58, 95)')
    assert.equal(td.textContent, '星河')
    handle.destroy()
    assert.equal(host.childNodes.length, 0)
  })
})
