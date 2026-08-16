import type { Field } from '@paperfill/kernel'

function markerText(field: Field) {
  return field.type === 'text' ? `{{${field.name}}}` : `{{${field.name}:${field.type}}}`
}

function markerRe(name: string) {
  return new RegExp(`\\{\\{\\s*${name}(?:\\s*:\\s*[A-Za-z_][A-Za-z0-9_]*)?\\s*\\}\\}`, 'g')
}

export function insertMarkerInDocumentXml(xml: string, field: Field): string {
  if (markerRe(field.name).test(xml)) return xml
  const paragraph = `<w:p><w:r><w:t xml:space="preserve">${markerText(field)}</w:t></w:r></w:p>`
  if (xml.includes('</w:body>')) return xml.replace('</w:body>', `${paragraph}</w:body>`)
  return `${xml}${paragraph}`
}

export function updateMarkerInDocumentXml(xml: string, previousName: string, field: Field): string {
  const next = markerText(field)
  const updated = xml.replace(markerRe(previousName), next)
  if (updated !== xml) return updated
  return insertMarkerInDocumentXml(xml, field)
}

export function removeMarkerFromDocumentXml(xml: string, name: string): string {
  return xml.replace(markerRe(name), '')
}
