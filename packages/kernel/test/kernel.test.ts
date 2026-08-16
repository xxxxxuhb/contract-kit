import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createKernel } from '../src/kernel'
import { hydrateFromBundle, snapshotKernel, toPersistBundle } from '../src/persist'
import type { DiscoveredField, DocumentAdapter, Field, Source } from '../src/types'

class MemoryAdapter implements DocumentAdapter {
  readonly kind = 'docx' as const
  discovered: DiscoveredField[] = []
  fields = new Map<string, Field>()
  data: Record<string, unknown> = {}
  source: Source | null = null
  exported = new Uint8Array([9, 8, 7])

  async load(source: Source) {
    this.source = source
    this.fields.clear()
    this.data = {}
  }

  async discoverFields() {
    return this.discovered
  }

  getPreview() {
    return { kind: 'docx' as const, blocks: [] }
  }

  async insertAnchor(field: Field) {
    this.fields.set(field.id, field)
  }

  async updateAnchor(field: Field) {
    this.fields.set(field.id, field)
  }

  async removeAnchor(fieldId: string) {
    this.fields.delete(fieldId)
  }

  async bind(data: Record<string, unknown>) {
    this.data = { ...data }
  }

  async export() {
    return this.exported
  }
}

function source(): Source {
  return { kind: 'docx', buffer: new Uint8Array([1, 2, 3]) }
}

test('load discovers markers into form schema and view', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    {
      name: 'partyA',
      type: 'text',
      label: '甲方',
      required: true,
      anchor: { kind: 'marker', name: 'partyA' },
    },
    {
      name: 'payMethod',
      type: 'select',
      label: '付款方式',
      options: [
        { value: 'wire', label: '电汇' },
        { value: 'acceptance', label: '承兑' },
      ],
      anchor: { kind: 'marker', name: 'payMethod' },
    },
  ]
  const kernel = createKernel({ adapter })
  const events: string[] = []
  kernel.subscribe((event) => events.push(event.type))

  await kernel.dispatch({ type: 'load', source: source() })

  const schema = kernel.getFormSchema()
  assert.equal(schema.fields.length, 2)
  assert.equal(schema.fields[0].name, 'partyA')
  assert.equal(schema.fields[1].type, 'select')
  assert.equal(adapter.fields.size, 2)
  assert.deepEqual(kernel.getView().map((row) => row.label), ['甲方', '付款方式'])
  assert.ok(events.includes('state-changed'))
})

test('setValue / validate / getView / export follow the page API', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    {
      name: 'partyA',
      type: 'text',
      label: '甲方',
      required: true,
      anchor: { kind: 'marker', name: 'partyA' },
    },
    {
      name: 'payMethod',
      type: 'select',
      label: '付款方式',
      options: [{ value: 'wire', label: '电汇' }],
      anchor: { kind: 'marker', name: 'payMethod' },
    },
  ]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })

  assert.equal(kernel.validate().ok, false)
  await kernel.dispatch({ type: 'setValue', path: 'partyA', value: 'xx公司' })
  await kernel.dispatch({ type: 'setValue', path: 'payMethod', value: 'cash' })
  assert.equal(kernel.validate().ok, false)
  assert.match(kernel.validate().issues[0].message, /不在选项中/)

  await kernel.dispatch({ type: 'setValue', path: 'payMethod', value: 'wire' })
  assert.equal(kernel.validate().ok, true)
  assert.deepEqual(kernel.getView(), [
    { id: kernel.getFormSchema().fields[0].id, label: '甲方', value: 'xx公司' },
    { id: kernel.getFormSchema().fields[1].id, label: '付款方式', value: 'wire' },
  ])

  const exported = await kernel.dispatch({ type: 'export' })
  assert.equal(exported.type, 'exported')
  if (exported.type === 'exported') {
    assert.deepEqual(exported.buffer, adapter.exported)
    assert.equal(exported.format, 'docx')
  }
  assert.deepEqual(adapter.data, { partyA: 'xx公司', payMethod: 'wire' })
  assert.deepEqual(kernel.getExportData(), { partyA: 'xx公司', payMethod: 'wire' })
})

test('export binds outputFormat without changing getData', async () => {
  const adapter = new MemoryAdapter()
  const kernel = createKernel({
    adapter,
    formatters: {
      amountCn: ({ value }) => `CNY ${value}`,
    },
  })
  await kernel.dispatch({
    type: 'hydrate',
    source: source(),
    definition: {
      version: 1,
      source: { kind: 'docx', hash: 'x' },
      fields: [
        {
          id: 'd1',
          name: 'signDate',
          type: 'date',
          outputFormat: 'DD/MM/YYYY',
          anchor: { kind: 'marker', name: 'signDate' },
        },
        {
          id: 'a1',
          name: 'amount',
          type: 'number',
          outputFormat: 'amountCn',
          anchor: { kind: 'marker', name: 'amount' },
        },
      ],
    },
    data: { signDate: '2026-08-16', amount: 99 },
  })

  assert.deepEqual(kernel.getData(), { signDate: '2026-08-16', amount: 99 })
  assert.deepEqual(kernel.getExportData(), { signDate: '16/08/2026', amount: 'CNY 99' })
  await kernel.dispatch({ type: 'export' })
  assert.deepEqual(adapter.data, { signDate: '16/08/2026', amount: 'CNY 99' })
})

test('insertField rejects duplicate names; hydrate restores definition and data', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    { name: 'partyA', type: 'text', anchor: { kind: 'marker', name: 'partyA' } },
  ]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })

  await assert.rejects(
    () =>
      kernel.dispatch({
        type: 'insertField',
        field: { name: 'partyA', type: 'text', anchor: { kind: 'marker', name: 'partyA' } },
      }),
    /already exists/,
  )

  await kernel.dispatch({
    type: 'insertField',
    field: { name: 'partyB', type: 'text', label: '乙方', anchor: { kind: 'marker', name: 'partyB' } },
  })
  await kernel.dispatch({ type: 'setValue', path: 'partyA', value: '甲' })

  const definition = kernel.getDefinition()
  const data = kernel.getData()
  assert.ok(definition)

  const next = new MemoryAdapter()
  const restored = createKernel({ adapter: next })
  await restored.dispatch({
    type: 'hydrate',
    source: source(),
    definition: definition!,
    data,
  })
  assert.equal(restored.getFormSchema().fields.length, 2)
  assert.equal(restored.getData().partyA, '甲')
  assert.equal(next.fields.size, 2)
})

test('can() blocks writes before load', () => {
  const kernel = createKernel({ adapter: new MemoryAdapter() })
  assert.equal(kernel.can({ type: 'setValue', path: 'x', value: 1 }), false)
  assert.equal(kernel.can({ type: 'insertRow', table: 'items' }), false)
  assert.equal(kernel.can({ type: 'load', source: source() }), true)
  assert.equal(kernel.can({ type: 'load', source: { kind: 'xlsx', buffer: new Uint8Array() } }), false)
})

test('dispatch throws before load; snapshots are copies', async () => {
  const kernel = createKernel({ adapter: new MemoryAdapter() })
  await assert.rejects(() => kernel.dispatch({ type: 'export' }), /cannot dispatch/)

  const adapter = new MemoryAdapter()
  adapter.discovered = [{ name: 'partyA', type: 'text', anchor: { kind: 'marker', name: 'partyA' } }]
  const loaded = createKernel({ adapter })
  await loaded.dispatch({ type: 'load', source: source() })
  await loaded.dispatch({ type: 'setValue', path: 'partyA', value: '甲' })

  const data = loaded.getData()
  data.partyA = 'mutated'
  assert.equal(loaded.getData().partyA, '甲')
})

test('updateField / removeField / resetData / setData mutate kernel state', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    { name: 'partyA', type: 'text', label: '甲方', anchor: { kind: 'marker', name: 'partyA' } },
    { name: 'partyB', type: 'text', label: '乙方', anchor: { kind: 'marker', name: 'partyB' } },
  ]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })
  const partyA = kernel.getFormSchema().fields[0]
  const partyB = kernel.getFormSchema().fields[1]

  await kernel.dispatch({ type: 'updateField', id: partyA.id, patch: { label: '甲方名称', required: true } })
  assert.equal(kernel.getFormSchema().fields[0].label, '甲方名称')
  assert.equal(kernel.getFormSchema().fields[0].required, true)

  await kernel.dispatch({ type: 'setData', data: { partyA: '甲', partyB: '乙' } })
  assert.deepEqual(kernel.getData(), { partyA: '甲', partyB: '乙' })

  await kernel.dispatch({ type: 'removeField', id: partyB.id })
  assert.equal(kernel.getFormSchema().fields.length, 1)
  assert.equal('partyB' in kernel.getData(), false)
  assert.equal(adapter.fields.has(partyB.id), false)

  await kernel.dispatch({ type: 'resetData' })
  assert.deepEqual(kernel.getData(), {})
  assert.equal(kernel.validate().ok, false)
})

test('persist bundle and snapshot follow hydrate convention', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [{ name: 'partyA', type: 'text', anchor: { kind: 'marker', name: 'partyA' } }]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })
  await kernel.dispatch({ type: 'setValue', path: 'partyA', value: '甲' })

  const bundle = toPersistBundle(kernel)
  assert.ok(bundle)
  assert.equal(bundle!.data.partyA, '甲')
  assert.equal(bundle!.definition.fields[0].name, 'partyA')

  const snap = snapshotKernel(kernel)
  assert.equal(snap.data.partyA, '甲')
  assert.equal(snap.schema.fields[0].name, 'partyA')

  const restored = createKernel({ adapter: new MemoryAdapter() })
  await restored.dispatch(hydrateFromBundle(bundle!))
  assert.equal(restored.getData().partyA, '甲')
})

test('subscribe can unsubscribe', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [{ name: 'partyA', type: 'text', anchor: { kind: 'marker', name: 'partyA' } }]
  const kernel = createKernel({ adapter })
  const events: string[] = []
  const stop = kernel.subscribe((event) => events.push(event.type))
  await kernel.dispatch({ type: 'load', source: source() })
  stop()
  const count = events.length
  await kernel.dispatch({ type: 'setValue', path: 'partyA', value: 'x' })
  assert.equal(events.length, count)
})

test('setValue supports nested table cell paths', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    {
      name: 'items',
      type: 'table',
      columns: [{ name: 'name', type: 'text', required: true }],
      anchor: { kind: 'marker', name: 'items' },
    },
  ]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })
  await kernel.dispatch({ type: 'setValue', path: 'items.0.name', value: '苹果' })
  assert.deepEqual(kernel.getData(), { items: [{ name: '苹果' }] })
  assert.equal(kernel.validate().ok, true)
})

test('insertRow / removeRow mutate table arrays', async () => {
  const adapter = new MemoryAdapter()
  adapter.discovered = [
    {
      name: 'items',
      type: 'table',
      columns: [{ name: 'name', type: 'text' }],
      anchor: { kind: 'marker', name: 'items' },
    },
  ]
  const kernel = createKernel({ adapter })
  await kernel.dispatch({ type: 'load', source: source() })
  await kernel.dispatch({ type: 'insertRow', table: 'items', row: { name: '苹果' } })
  await kernel.dispatch({ type: 'insertRow', table: 'items', index: 0, row: { name: '橙' } })
  assert.deepEqual(kernel.getData().items, [{ name: '橙' }, { name: '苹果' }])
  await kernel.dispatch({ type: 'removeRow', table: 'items', index: 0 })
  assert.deepEqual(kernel.getData().items, [{ name: '苹果' }])
})
