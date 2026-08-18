import type { Field, MarkerDelimiters } from '@paperfill/kernel'
import { createMarkerSyntax } from '@paperfill/kernel'

export function insertMarkerInDocumentXml(
  xml: string,
  field: Field,
  markers?: MarkerDelimiters | null,
): string {
  const syntax = createMarkerSyntax(markers)
  if (syntax.namedRegex(field.name).test(xml)) return xml
  const paragraph = `<w:p><w:r><w:t xml:space="preserve">${syntax.wrap(field.name, field.type)}</w:t></w:r></w:p>`
  if (xml.includes('</w:body>')) return xml.replace('</w:body>', `${paragraph}</w:body>`)
  return `${xml}${paragraph}`
}

export function updateMarkerInDocumentXml(
  xml: string,
  previousName: string,
  field: Field,
  markers?: MarkerDelimiters | null,
): string {
  const syntax = createMarkerSyntax(markers)
  const next = syntax.wrap(field.name, field.type)
  const updated = xml.replace(syntax.namedRegex(previousName), next)
  if (updated !== xml) return updated
  return insertMarkerInDocumentXml(xml, field, markers)
}

export function removeMarkerFromDocumentXml(
  xml: string,
  name: string,
  markers?: MarkerDelimiters | null,
): string {
  return xml.replace(createMarkerSyntax(markers).namedRegex(name), '')
}
