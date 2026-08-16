import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createKernel } from '../../kernel/src/index'
import { DocxAdapter } from '../src/index'
import { buildDocxPreview } from '../src/preview'
import { makeDocx } from './make-docx'

test('buildDocxPreview keeps paragraph text, alignment, and in-place fields', () => {
  const xml = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>采购合同</w:t></w:r></w:p>
    <w:p><w:r><w:t>甲方：{{</w:t></w:r><w:r><w:t>partyA</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>货物</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{goods}}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
  const blocks = buildDocxPreview(xml)
  assert.equal(blocks[0].type, 'paragraph')
  if (blocks[0].type === 'paragraph') {
    assert.equal(blocks[0].align, 'center')
    assert.deepEqual(blocks[0].inlines, [{ type: 'text', text: '采购合同' }])
  }
  assert.equal(blocks[1].type, 'paragraph')
  if (blocks[1].type === 'paragraph') {
    assert.deepEqual(blocks[1].inlines, [
      { type: 'text', text: '甲方：' },
      { type: 'field', name: 'partyA' },
    ])
  }
  assert.equal(blocks[2].type, 'table')
  if (blocks[2].type === 'table') {
    const cell = blocks[2].rows[0][1].blocks[0]
    assert.equal(cell.type, 'paragraph')
    if (cell.type === 'paragraph') {
      assert.deepEqual(cell.inlines, [{ type: 'field', name: 'goods' }])
    }
  }
})

test('kernel getPreview follows the loaded document layout', async () => {
  const buffer = await makeDocx(['标题', '甲方：{{partyA}}'])
  const kernel = createKernel({ adapter: new DocxAdapter() })
  await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
  const preview = kernel.getPreview()
  assert.equal(preview?.kind, 'docx')
  if (preview?.kind !== 'docx') return
  assert.equal(preview.blocks.length, 2)
  const second = preview.blocks[1]
  assert.equal(second.type, 'paragraph')
  if (second.type === 'paragraph') {
    assert.ok(second.inlines.some((inline) => inline.type === 'field' && inline.name === 'partyA'))
  }
})
