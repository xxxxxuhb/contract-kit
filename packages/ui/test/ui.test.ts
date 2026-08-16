import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { createField, mountField } from '../src/index'

function withDom<T>(fn: () => T): T {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const g = globalThis as typeof globalThis & {
    window: Window
    document: Document
    HTMLElement: typeof HTMLElement
    HTMLInputElement: typeof HTMLInputElement
    HTMLSelectElement: typeof HTMLSelectElement
    HTMLTextAreaElement: typeof HTMLTextAreaElement
  }
  const prev = {
    window: g.window,
    document: g.document,
    HTMLElement: g.HTMLElement,
    HTMLInputElement: g.HTMLInputElement,
    HTMLSelectElement: g.HTMLSelectElement,
    HTMLTextAreaElement: g.HTMLTextAreaElement,
  }
  g.window = dom.window as unknown as Window
  g.document = dom.window.document
  g.HTMLElement = dom.window.HTMLElement
  g.HTMLInputElement = dom.window.HTMLInputElement
  g.HTMLSelectElement = dom.window.HTMLSelectElement
  g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  try {
    return fn()
  } finally {
    g.window = prev.window
    g.document = prev.document
    g.HTMLElement = prev.HTMLElement
    g.HTMLInputElement = prev.HTMLInputElement
    g.HTMLSelectElement = prev.HTMLSelectElement
    g.HTMLTextAreaElement = prev.HTMLTextAreaElement
  }
}

describe('createField', () => {
  it('creates native text input and emits onChange', () => {
    withDom(() => {
      const values: unknown[] = []
      const handle = createField({
        name: 'partyA',
        field: { name: 'partyA', type: 'text', label: '甲方', value: '' },
        onChange: (v) => values.push(v),
      })
      const input = handle.el.querySelector('input')
      assert.ok(input)
      assert.equal(input.type, 'text')
      input.value = 'ACME'
      input.dispatchEvent(new handle.el.ownerDocument.defaultView!.Event('input', { bubbles: true }))
      assert.deepEqual(values, ['ACME'])
      handle.destroy()
    })
  })

  it('creates select with options', () => {
    withDom(() => {
      const handle = createField({
        name: 'payMethod',
        field: {
          name: 'payMethod',
          type: 'select',
          label: '付款方式',
          value: 'wire',
          options: [
            { value: 'wire', label: '电汇' },
            { value: 'check', label: '支票' },
          ],
        },
        onChange: () => undefined,
      })
      const select = handle.el.querySelector('select')
      assert.ok(select)
      assert.equal(select.value, 'wire')
      assert.equal(select.options.length, 3)
      handle.destroy()
    })
  })

  it('mountField replaces container children', () => {
    withDom(() => {
      const host = document.createElement('div')
      host.innerHTML = '<span>old</span>'
      const handle = mountField(host, {
        name: 'qty',
        field: { name: 'qty', type: 'number', label: '数量', value: 2 },
        onChange: () => undefined,
      })
      assert.equal(host.children.length, 1)
      assert.equal(host.firstElementChild, handle.el)
      const input = handle.el.querySelector('input')
      assert.ok(input)
      assert.equal(input.type, 'number')
      assert.equal(input.value, '2')
    })
  })
})
