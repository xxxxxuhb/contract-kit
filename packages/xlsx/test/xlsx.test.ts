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

async function makeItemsXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('合同')
  sheet.getCell('A1').value = '序号'
  sheet.getCell('B1').value = '货物'
  sheet.getCell('A2').value = '{{items.$index}}'
  sheet.getCell('B2').value = '{{items.name}}'
  sheet.getCell('A3').value = '备注'
  sheet.getCell('B3').value = '{{note}}'
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

test('getPreview includes solid fill and font color', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('样式')
  const cell = sheet.getCell('A1')
  cell.value = '标题'
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  }
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  const buffer = new Uint8Array(await workbook.xlsx.writeBuffer())

  const kernel = createKernel({ adapter: new XlsxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'xlsx', buffer } })
  const preview = kernel.getPreview()
  assert.equal(preview?.kind, 'xlsx')
  if (preview?.kind !== 'xlsx') return
  const style = preview.sheets[0].cells[0][0].style
  assert.equal(style?.background, '#1e3a5f')
  assert.equal(style?.color, '#ffffff')
  assert.equal(style?.fontWeight, 'bold')
})

test('xlsx discovers table fields and expands rows on export', async () => {
  const buffer = await makeItemsXlsx()
  const kernel = createKernel({ adapter: new XlsxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'xlsx', buffer } })
  const fields = kernel.getFormSchema().fields
  assert.ok(fields.some((f) => f.name === 'items' && f.type === 'table'))
  assert.ok(fields.some((f) => f.name === 'note'))

  await kernel.dispatch({
    type: 'setData',
    data: {
      items: [{ name: '苹果' }, { name: '橙' }],
      note: 'ok',
    },
  })
  const result = await kernel.dispatch({ type: 'export' })
  assert.equal(result.type, 'exported')
  if (result.type !== 'exported') return

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer)
  const sheet = workbook.getWorksheet('合同')!
  assert.equal(String(sheet.getCell('A2').value), '1')
  assert.equal(String(sheet.getCell('B2').value), '苹果')
  assert.equal(String(sheet.getCell('A3').value), '2')
  assert.equal(String(sheet.getCell('B3').value), '橙')
  assert.equal(String(sheet.getCell('B4').value), 'ok')
})
