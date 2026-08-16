import {
  replaceMarkers,
  replaceRowMarkers,
  rowsForExpand,
  tableNamesInText,
  textHasTableMarkers,
} from '@contract-kit/kernel'

const PARAGRAPH_RE = /<w:p\b[\s\S]*?<\/w:p>/g
const TEXT_RE = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g

export function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function extractText(xml: string): string {
  const paragraphs: string[] = []
  const paragraphRe = new RegExp(PARAGRAPH_RE.source, 'g')
  let paragraph: RegExpExecArray | null
  while ((paragraph = paragraphRe.exec(xml))) {
    paragraphs.push(joinTextNodes(paragraph[0]))
  }
  return paragraphs.join('\n')
}

export function applyMarkers(xml: string, data: Record<string, unknown>): string {
  const paragraphRe = new RegExp(PARAGRAPH_RE.source, 'g')
  return xml.replace(paragraphRe, (paragraph) => applyMarkersInParagraph(paragraph, data))
}

export function joinTextNodes(xml: string): string {
  const textRe = new RegExp(TEXT_RE.source, 'g')
  const parts: string[] = []
  let match: RegExpExecArray | null
  while ((match = textRe.exec(xml))) {
    parts.push(unescapeXml(match[2]))
  }
  return parts.join('')
}

function writeParagraphText(paragraph: string, replaced: string): string {
  let index = 0
  const textRe = new RegExp(TEXT_RE.source, 'g')
  return paragraph.replace(textRe, (_full, attrs: string) => {
    const current = index++
    if (current === 0) {
      const withSpace = /xml:space\s*=/.test(attrs) ? attrs : `${attrs} xml:space="preserve"`
      return `<w:t${withSpace}>${escapeXml(replaced)}</w:t>`
    }
    return `<w:t${attrs}></w:t>`
  })
}

function applyMarkersInParagraph(paragraph: string, data: Record<string, unknown>): string {
  if (paragraph.includes('<w:drawing')) return paragraph
  const joined = joinTextNodes(paragraph)
  if (!joined.includes('{{')) return paragraph
  const replaced = replaceMarkers(joined, data, { missing: 'blank' })
  if (replaced === joined) return paragraph
  return writeParagraphText(paragraph, replaced)
}

function applyRowMarkersInParagraph(
  paragraph: string,
  tableName: string,
  row: Record<string, unknown>,
  index: number,
): string {
  const joined = joinTextNodes(paragraph)
  if (!joined.includes('{{')) return paragraph
  const replaced = replaceRowMarkers(joined, tableName, row, index)
  if (replaced === joined) return paragraph
  return writeParagraphText(paragraph, replaced)
}

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

function fillTemplateRow(
  trXml: string,
  tableName: string,
  row: Record<string, unknown>,
  index: number,
): string {
  const paragraphRe = new RegExp(PARAGRAPH_RE.source, 'g')
  return trXml.replace(paragraphRe, (paragraph) =>
    applyRowMarkersInParagraph(paragraph, tableName, row, index),
  )
}

/** Expand `w:tr` template rows that contain `{{tableName.col}}` using data arrays. */
export function expandTableRows(xml: string, data: Record<string, unknown>): string {
  const names = tableNamesInText(xml)
  let result = xml
  for (const tableName of names) {
    result = expandOneTable(result, tableName, data[tableName])
  }
  return result
}

function expandOneTable(xml: string, tableName: string, value: unknown): string {
  const rows = rowsForExpand(value)
  const parts: string[] = []
  let last = 0
  let i = 0
  while (i < xml.length) {
    const trStart = indexOfTag(xml, 'w:tr', i)
    if (trStart === -1) break
    const trEnd = findClosing(xml, trStart, 'w:tr')
    const trXml = xml.slice(trStart, trEnd)
    const trText = extractText(trXml)
    if (textHasTableMarkers(trText, tableName)) {
      parts.push(xml.slice(last, trStart))
      for (let r = 0; r < rows.length; r++) {
        parts.push(fillTemplateRow(trXml, tableName, rows[r], r))
      }
      last = trEnd
      i = trEnd
    } else {
      i = trEnd
    }
  }
  parts.push(xml.slice(last))
  return parts.join('')
}

/** Expand table rows then replace remaining flat markers. */
export function bindDocumentXml(xml: string, data: Record<string, unknown>): string {
  return applyMarkers(expandTableRows(xml, data), data)
}

export function isWordXmlPath(path: string): boolean {
  return path.startsWith('word/') && path.endsWith('.xml') && !path.includes('_rels')
}
