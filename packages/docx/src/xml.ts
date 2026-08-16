import { replaceMarkers } from '@contract-kit/kernel'

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

function applyMarkersInParagraph(paragraph: string, data: Record<string, unknown>): string {
  const joined = joinTextNodes(paragraph)
  if (!joined.includes('{{')) return paragraph
  const replaced = replaceMarkers(joined, data)
  if (replaced === joined) return paragraph

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

export function isWordXmlPath(path: string): boolean {
  return path.startsWith('word/') && path.endsWith('.xml') && !path.includes('_rels')
}
