import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createKernel } from '../../kernel/src/index'
import { DocxAdapter } from '../src/index'
import { makeDocx, readDocxDocumentXml } from './make-docx'

function sha(buffer: Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

test('load scans {{markers}} including typed fields and split runs', async () => {
  const buffer = await makeDocx([
    '甲方：{{partyA}}',
    ['付款：{{', 'payMethod:select', '}}'],
    '备注：{{note:textarea}}',
  ])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })

  const fields = kernel.getFormSchema().fields
  assert.deepEqual(
    fields.map((f) => ({ name: f.name, type: f.type })),
    [
      { name: 'partyA', type: 'text' },
      { name: 'payMethod', type: 'select' },
      { name: 'note', type: 'textarea' },
    ],
  )
  assert.equal(kernel.getDefinition()!.fields[0].anchor.kind, 'marker')
})

test('export binds values and leaves the original buffer untouched', async () => {
  const buffer = await makeDocx(['甲方：{{partyA}} & {{partyB}}', '付款：{{payMethod:select}}'])
  const originalHash = sha(buffer)
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
  await kernel.dispatch({ type: 'setValue', path: 'partyA', value: 'xx公司' })
  await kernel.dispatch({ type: 'setValue', path: 'partyB', value: 'yy <乙方>' })
  await kernel.dispatch({ type: 'setValue', path: 'payMethod', value: '电汇' })

  const result = await kernel.dispatch({ type: 'export' })
  assert.equal(result.type, 'exported')
  assert.equal(sha(buffer), originalHash)

  if (result.type !== 'exported') return
  const xml = await readDocxDocumentXml(result.buffer)
  assert.match(xml, /xx公司/)
  assert.match(xml, /yy &lt;乙方&gt;/)
  assert.match(xml, /电汇/)
  assert.doesNotMatch(xml, /\{\{partyA\}\}/)
  assert.doesNotMatch(xml, /\{\{payMethod:select\}\}/)
})

test('export applies definition outputFormat on untyped markers', async () => {
  const buffer = await makeDocx(['日期：{{signDate}} 金额：{{amount}} 付款：{{payMethod}}'])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({
    type: 'hydrate',
    source: { kind: 'docx', buffer },
    definition: {
      version: 1,
      source: { kind: 'docx', hash: sha(buffer) },
      fields: [
        {
          id: '1',
          name: 'signDate',
          type: 'date',
          outputFormat: 'DD/MM/YYYY',
          anchor: { kind: 'marker', name: 'signDate' },
        },
        {
          id: '2',
          name: 'amount',
          type: 'number',
          outputFormat: '#,##0.00',
          anchor: { kind: 'marker', name: 'amount' },
        },
        {
          id: '3',
          name: 'payMethod',
          type: 'select',
          outputFormat: 'label',
          options: [{ value: 'wire', label: '电汇' }],
          anchor: { kind: 'marker', name: 'payMethod' },
        },
      ],
    },
    data: { signDate: '2026-08-16', amount: 15998, payMethod: 'wire' },
  })

  const result = await kernel.dispatch({ type: 'export' })
  assert.equal(result.type, 'exported')
  if (result.type !== 'exported') return
  const xml = await readDocxDocumentXml(result.buffer)
  assert.match(xml, /16\/08\/2026/)
  assert.match(xml, /15,998.00/)
  assert.match(xml, /电汇/)
  assert.doesNotMatch(xml, /2026-08-16/)
  assert.doesNotMatch(xml, /wire/)
})

test('hydrate replays definition + data onto a fresh kernel', async () => {
  const buffer = await makeDocx(['合同编号{{contractNo}}'])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
  await kernel.dispatch({ type: 'setValue', path: 'contractNo', value: 'HT-001' })

  const restored = createKernel({ adapter: new DocxAdapter() })
  await restored.dispatch({
    type: 'hydrate',
    source: { kind: 'docx', buffer },
    definition: kernel.getDefinition()!,
    data: kernel.getData(),
  })
  assert.equal(restored.getView()[0].value, 'HT-001')

  const result = await restored.dispatch({ type: 'export' })
  assert.equal(result.type, 'exported')
  if (result.type === 'exported') {
    assert.match(await readDocxDocumentXml(result.buffer), /HT-001/)
  }
})

test('export embeds image data URL as a drawing', async () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const buffer = await makeDocx(['附件{{stamp:image}}'])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
  await kernel.dispatch({ type: 'setValue', path: 'stamp', value: png })
  const result = await kernel.dispatch({ type: 'export' })
  assert.equal(result.type, 'exported')
  if (result.type !== 'exported') return
  const zip = await (await import('jszip')).default.loadAsync(result.buffer)
  assert.ok(zip.file('word/media/ck-stamp.png'))
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /<w:drawing>/)
  assert.doesNotMatch(xml, /\{\{stamp/)
})

test('insertField / removeField write markers into the document', async () => {
  const buffer = await makeDocx(['甲方：{{partyA}}'])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
  await kernel.dispatch({
    type: 'insertField',
    field: { name: 'partyB', type: 'text', label: '乙方', anchor: { kind: 'marker', name: 'partyB' } },
  })
  await kernel.dispatch({ type: 'setValue', path: 'partyB', value: '乙公司' })
  const afterInsert = await kernel.dispatch({ type: 'export' })
  assert.equal(afterInsert.type, 'exported')
  if (afterInsert.type !== 'exported') return
  const xml = await readDocxDocumentXml(afterInsert.buffer)
  assert.match(xml, /乙公司/)
  assert.doesNotMatch(xml, /\{\{partyB\}\}/)
  assert.doesNotMatch(xml, /\{\{partyA\}\}/)

  const partyB = kernel.getDefinition()!.fields.find((f) => f.name === 'partyB')!
  await kernel.dispatch({ type: 'removeField', id: partyB.id })
  const afterRemove = await kernel.dispatch({ type: 'export' })
  assert.equal(afterRemove.type, 'exported')
  if (afterRemove.type !== 'exported') return
  const removed = await readDocxDocumentXml(afterRemove.buffer)
  assert.doesNotMatch(removed, /乙公司/)
  assert.doesNotMatch(removed, /\{\{partyB\}\}/)
})

test('DocxAdapter rejects a non-docx source', async () => {
  const adapter = new DocxAdapter()
  await assert.rejects(
    () => adapter.load({ kind: 'xlsx', buffer: new Uint8Array([1]) }),
    /only accepts docx/,
  )
})
