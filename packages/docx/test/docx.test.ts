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

test('DocxAdapter rejects a non-docx source', async () => {
  const adapter = new DocxAdapter()
  await assert.rejects(
    () => adapter.load({ kind: 'xlsx', buffer: new Uint8Array([1]) }),
    /only accepts docx/,
  )
})
