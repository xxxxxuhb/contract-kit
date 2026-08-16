import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyMarkers,
  bindDocumentXml,
  escapeXml,
  expandTableRows,
  extractText,
  isWordXmlPath,
  unescapeXml,
} from '../src/xml'

test('escapeXml / unescapeXml round-trip and decode amp last', () => {
  assert.equal(escapeXml('a <b> & c'), 'a &lt;b&gt; &amp; c')
  assert.equal(unescapeXml('a &lt;b&gt; &amp; c'), 'a <b> & c')
  assert.equal(unescapeXml('&amp;lt;'), '&lt;')
})

test('extractText joins split w:t runs inside a paragraph', () => {
  const xml = `<w:document><w:body>
    <w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>partyA</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>乙方：{{partyB}}</w:t></w:r></w:p>
  </w:body></w:document>`
  assert.equal(extractText(xml), '{{partyA}}\n乙方：{{partyB}}')
})

test('applyMarkers replaces split markers and escapes XML in values', () => {
  const xml = `<w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>partyA</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>`
  const out = applyMarkers(xml, { partyA: 'xx <公司>' })
  assert.match(out, /xx &lt;公司&gt;/)
  assert.doesNotMatch(out, /\{\{/)
  assert.match(out, /<w:t xml:space="preserve">/)
})

test('applyMarkers leaves paragraphs without markers unchanged', () => {
  const xml = `<w:p><w:r><w:t>固定条款</w:t></w:r></w:p>`
  assert.equal(applyMarkers(xml, { partyA: 'x' }), xml)
})

test('isWordXmlPath skips rels and non-word parts', () => {
  assert.equal(isWordXmlPath('word/document.xml'), true)
  assert.equal(isWordXmlPath('word/header1.xml'), true)
  assert.equal(isWordXmlPath('word/_rels/document.xml.rels'), false)
  assert.equal(isWordXmlPath('[Content_Types].xml'), false)
})

test('expandTableRows clones template w:tr for each data row', () => {
  const xml = `<w:tbl>
    <w:tr><w:tc><w:p><w:r><w:t>表头</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>{{items.$index}}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{items.name}}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>合计{{amount}}</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>`
  const expanded = expandTableRows(xml, {
    items: [{ name: '苹果' }, { name: '橙' }],
    amount: 9,
  })
  assert.equal((expanded.match(/<w:tr>/g) ?? []).length, 4)
  assert.match(expanded, /苹果/)
  assert.match(expanded, /橙/)
  assert.match(expanded, /合计\{\{amount\}\}/)

  const bound = bindDocumentXml(xml, {
    items: [{ name: '苹果' }, { name: '橙' }],
    amount: 9,
  })
  assert.match(bound, /合计9/)
  assert.doesNotMatch(bound, /\{\{/)
})

test('expandTableRows keeps a blank placeholder row when array is empty', () => {
  const xml = `<w:tbl>
    <w:tr><w:tc><w:p><w:r><w:t>H</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>{{items.name}}</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>`
  const out = expandTableRows(xml, { items: [] })
  assert.equal((out.match(/<w:tr>/g) ?? []).length, 2)
  assert.doesNotMatch(out, /\{\{/)
})
