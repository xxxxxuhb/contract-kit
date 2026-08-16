import { splitByMarkers, type PreviewBlock, type PreviewInline, type PreviewParagraph, type PreviewTable } from '@paperfill/kernel'
import { joinTextNodes } from './xml'

function isTagStart(xml: string, at: number, tag: string): boolean {
  if (!xml.startsWith(`<${tag}`, at)) return false
  const ch = xml[at + 1 + tag.length]
  return ch === '>' || ch === '/' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
}

function indexOfTag(xml: string, tag: string, from: number): number {
  let i = from
  while (i < xml.length) {
    const at = xml.indexOf(`<${tag}`, i)
    if (at === -1) return -1
    if (isTagStart(xml, at, tag)) return at
    i = at + tag.length + 1
  }
  return -1
}

function findClosing(xml: string, start: number, tag: string): number {
  const gt = xml.indexOf('>', start)
  if (gt === -1) return xml.length
  if (xml[gt - 1] === '/') return gt + 1
  const close = `</${tag}>`
  let depth = 1
  let i = gt + 1
  while (i < xml.length && depth > 0) {
    const openAt = indexOfTag(xml, tag, i)
    const closeAt = xml.indexOf(close, i)
    if (closeAt === -1) return xml.length
    if (openAt !== -1 && openAt < closeAt) {
      const openGt = xml.indexOf('>', openAt)
      if (openGt !== -1 && xml[openGt - 1] === '/') {
        i = openGt + 1
        continue
      }
      depth += 1
      i = openAt + tag.length + 1
    } else {
      depth -= 1
      i = closeAt + close.length
    }
  }
  return i
}

function paragraphAlign(xml: string): PreviewParagraph['align'] {
  const match = xml.match(/<w:jc\b[^>]*w:val="(left|center|right|both)"/)
  if (!match) return undefined
  return match[1] as PreviewParagraph['align']
}

function inlinesFromText(text: string): PreviewInline[] {
  return splitByMarkers(text).map((segment) =>
    segment.kind === 'text'
      ? { type: 'text' as const, text: segment.text }
      : { type: 'field' as const, name: segment.name },
  )
}

function parseParagraph(xml: string): PreviewParagraph {
  return {
    type: 'paragraph',
    align: paragraphAlign(xml),
    inlines: inlinesFromText(joinTextNodes(xml)),
  }
}

function parseTable(xml: string): PreviewTable {
  const rows: PreviewTable['rows'] = []
  let i = 0
  while (i < xml.length) {
    const tr = indexOfTag(xml, 'w:tr', i)
    if (tr === -1) break
    const trEnd = findClosing(xml, tr, 'w:tr')
    const rowXml = xml.slice(tr, trEnd)
    const cells: PreviewTable['rows'][number] = []
    let j = 0
    while (j < rowXml.length) {
      const tc = indexOfTag(rowXml, 'w:tc', j)
      if (tc === -1) break
      const tcEnd = findClosing(rowXml, tc, 'w:tc')
      cells.push({ blocks: parseSequence(rowXml.slice(tc, tcEnd)) })
      j = tcEnd
    }
    rows.push(cells)
    i = trEnd
  }
  return { type: 'table', rows }
}

export function parseSequence(xml: string): PreviewBlock[] {
  const blocks: PreviewBlock[] = []
  let i = 0
  while (i < xml.length) {
    const tbl = indexOfTag(xml, 'w:tbl', i)
    const p = indexOfTag(xml, 'w:p', i)
    if (tbl === -1 && p === -1) break
    if (tbl !== -1 && (p === -1 || tbl < p)) {
      const end = findClosing(xml, tbl, 'w:tbl')
      blocks.push(parseTable(xml.slice(tbl, end)))
      i = end
    } else {
      const end = findClosing(xml, p, 'w:p')
      blocks.push(parseParagraph(xml.slice(p, end)))
      i = end
    }
  }
  return blocks
}

export function buildDocxPreview(documentXml: string): PreviewBlock[] {
  const body = documentXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)
  return parseSequence(body ? body[1] : documentXml)
}
