import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyMarkers,
  escapeXml,
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
