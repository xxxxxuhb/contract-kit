import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { createKernel } from '../../kernel/src/index'
import { XlsxAdapter } from '../src/index'

function sha(buffer: Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

async function makeXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('合同')
  sheet.getCell('A1').value = '甲方'
  sheet.getCell('B1').value = '{{partyA}}'
  sheet.getCell('A2').value = '付款'
  sheet.getCell('B2').value = '{{payMethod:select}}'
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

async function readCell(buffer: Uint8Array, address: string): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  return String(workbook.getWorksheet('合同')?.getCell(address).value ?? '')
}

test('load scans cell markers into form schema', async () => {
  const buffer = await makeXlsx()
  const kernel = createKernel({ adapter: new XlsxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'xlsx', buffer } })
  assert.deepEqual(
    kernel.getFormSchema().fields.map((f) => ({ name: f.name, type: f.type })),
    [
      { name: 'partyA', type: 'text' },
      { name: 'payMethod', type: 'select' },
    ],
  )
  const partyA = kernel.getDefinition()!.fields[0]
  assert.equal(partyA.anchor.kind, 'cell')
  if (partyA.anchor.kind === 'cell') {
    assert.equal(partyA.anchor.address, 'B1')
    assert.equal(partyA.anchor.sheet, '合同')
  }

  const preview = kernel.getPreview()
  assert.equal(preview?.kind, 'xlsx')
  if (preview?.kind === 'xlsx') {
    const cell = preview.sheets[0].cells[0][1]
    assert.deepEqual(cell.inlines, [{ type: 'field', name: 'partyA' }])
  }
})

test('export binds cell values and does not mutate the original buffer', async () => {
  const buffer = await makeXlsx()
  const originalHash = sha(buffer)
  const kernel = createKernel({ adapter: new XlsxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'xlsx', buffer } })
  await kernel.dispatch({ type: 'setData', data: { partyA: 'xx公司', payMethod: '电汇' } })

  const result = await kernel.dispatch({ type: 'export' })
  assert.equal(sha(buffer), originalHash)
  assert.equal(result.type, 'exported')
  if (result.type !== 'exported') return
  assert.equal(await readCell(result.buffer, 'B1'), 'xx公司')
  assert.equal(await readCell(result.buffer, 'B2'), '电汇')
})

test('XlsxAdapter rejects a non-xlsx source', async () => {
  const adapter = new XlsxAdapter()
  await assert.rejects(
    () => adapter.load({ kind: 'docx', buffer: new Uint8Array([1]) }),
    /only accepts xlsx/,
  )
})
