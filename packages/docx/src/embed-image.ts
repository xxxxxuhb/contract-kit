import { parseDataUrl, parseMarkers, type Field } from '@paperfill/kernel'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture'

export type ImageEmbed = {
  name: string
  relId: string
  mediaPath: string
  mime: string
  bytes: Uint8Array
}

function emu(px: number) {
  return Math.round(px * 9525)
}

function drawingXml(relId: string, name: string, cx: number, cy: number, docPrId: number) {
  return `<w:r xmlns:w="${W_NS}" xmlns:r="${R_NS}">
  <w:drawing>
    <wp:inline xmlns:wp="${WP_NS}" distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:docPr id="${docPrId}" name="${name}"/>
      <a:graphic xmlns:a="${A_NS}">
        <a:graphicData uri="${PIC_NS}">
          <pic:pic xmlns:pic="${PIC_NS}">
            <pic:nvPicPr>
              <pic:cNvPr id="${docPrId}" name="${name}"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${relId}"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="${cx}" cy="${cy}"/>
              </a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>
</w:r>`
}

function collectImageFields(fields: Iterable<Field>, data: Record<string, unknown>): string[] {
  const names = new Set<string>()
  for (const field of fields) {
    if (field.type === 'image') names.add(field.name)
  }
  for (const [key, value] of Object.entries(data)) {
    if (parseDataUrl(value)) names.add(key)
  }
  return [...names]
}

export function planImageEmbeds(
  data: Record<string, unknown>,
  fields: Iterable<Field>,
): ImageEmbed[] {
  const embeds: ImageEmbed[] = []
  let i = 1
  for (const name of collectImageFields(fields, data)) {
    const parsed = parseDataUrl(data[name])
    if (!parsed) continue
    embeds.push({
      name,
      relId: `rIdCkImg${i}`,
      mediaPath: `word/media/ck-${name}.${parsed.ext}`,
      mime: parsed.mime,
      bytes: parsed.bytes,
    })
    i += 1
  }
  return embeds
}

export function replaceImageMarkersInXml(xml: string, embeds: ImageEmbed[]): string {
  if (!embeds.length) return xml
  let next = xml
  let docPrId = 1000
  for (const embed of embeds) {
    const drawing = drawingXml(embed.relId, embed.name, emu(120), emu(120), docPrId++)
    const re = new RegExp(`\\{\\{\\s*${embed.name}(?:\\s*:\\s*[A-Za-z_][A-Za-z0-9_]*)?\\s*\\}\\}`, 'g')
    next = next.replace(re, drawing)
  }
  return next
}

function upsertContentType(xml: string, extension: string, mime: string): string {
  const ext = extension.replace(/^\./, '')
  if (new RegExp(`Extension="${ext}"`, 'i').test(xml)) return xml
  return xml.replace(
    '</Types>',
    `  <Default Extension="${ext}" ContentType="${mime}"/>\n</Types>`,
  )
}

function upsertRelationship(xml: string, relId: string, target: string): string {
  if (xml.includes(`Id="${relId}"`)) return xml
  const rel = `  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>\n`
  if (xml.includes('</Relationships>')) return xml.replace('</Relationships>', `${rel}</Relationships>`)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rel}</Relationships>`
}

export function applyImagePackage(
  files: Map<string, Uint8Array>,
  embeds: ImageEmbed[],
): Map<string, Uint8Array> {
  if (!embeds.length) return files
  const next = new Map(files)
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let types = decoder.decode(next.get('[Content_Types].xml') ?? encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'))
  for (const embed of embeds) {
    const ext = embed.mediaPath.split('.').pop() ?? 'png'
    types = upsertContentType(types, ext, embed.mime)
    next.set(embed.mediaPath, embed.bytes)
  }
  next.set('[Content_Types].xml', encoder.encode(types))

  const relsPath = 'word/_rels/document.xml.rels'
  let rels = decoder.decode(next.get(relsPath) ?? encoder.encode(''))
  for (const embed of embeds) {
    rels = upsertRelationship(rels, embed.relId, embed.mediaPath.replace(/^word\//, ''))
  }
  next.set(relsPath, encoder.encode(rels))
  return next
}
