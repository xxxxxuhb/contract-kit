import {
  aggregateMarkerFields,
  parseMarkers,
  type DiscoveredField,
  type DocumentAdapter,
  type Field,
  type PreviewModel,
  type Source,
} from '@paperfill/kernel'
import JSZip from 'jszip'
import { buildDocxPreview } from './preview'
import {
  insertMarkerInDocumentXml,
  removeMarkerFromDocumentXml,
  updateMarkerInDocumentXml,
} from './anchors'
import { applyImagePackage, planImageEmbeds, replaceImageMarkersInXml } from './embed-image'
import { bindDocumentXml, extractText, isWordXmlPath } from './xml'

export {
  expandRepeatingRows,
  mountDocxPreview,
  resolveDocxSlot,
  rewriteTableMarkersInRow,
  shouldSkipUnexpandedTableParent,
  type DocxFieldHandle,
  type DocxFieldMountContext,
  type DocxFieldMounter,
  type DocxPreviewHandle,
  type MountDocxPreviewOptions,
} from './mount-preview'

export class DocxAdapter implements DocumentAdapter {
  readonly kind = 'docx' as const
  private original: Uint8Array | null = null
  private files = new Map<string, Uint8Array>()
  private bound: Map<string, Uint8Array> | null = null
  private fields = new Map<string, Field>()

  async load(source: Source): Promise<void> {
    if (source.kind !== 'docx') {
      throw new Error('DocxAdapter only accepts docx')
    }
    const zip = await JSZip.loadAsync(source.buffer)
    const files = new Map<string, Uint8Array>()
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      files.set(name, await entry.async('uint8array'))
    }
    if (!files.has('word/document.xml')) {
      throw new Error('invalid docx: missing word/document.xml')
    }
    this.original = source.buffer
    this.files = files
    this.bound = null
    this.fields.clear()
  }

  async discoverFields(): Promise<DiscoveredField[]> {
    const chunks: string[] = []
    for (const [path, bytes] of this.files) {
      if (!isWordXmlPath(path)) continue
      chunks.push(extractText(new TextDecoder().decode(bytes)))
    }
    return aggregateMarkerFields(parseMarkers(chunks.join('\n'))).map((field) => ({
      name: field.name,
      type: field.type,
      label: field.name,
      columns: field.columns,
      anchor: { kind: 'marker' as const, name: field.name },
    }))
  }

  getPreview(): PreviewModel {
    const bytes = this.files.get('word/document.xml')
    if (!bytes) return { kind: 'docx', blocks: [] }
    return {
      kind: 'docx',
      blocks: buildDocxPreview(new TextDecoder().decode(bytes)),
    }
  }

  private rewriteDocument(mutator: (xml: string) => string) {
    const bytes = this.files.get('word/document.xml')
    if (!bytes) return
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const next = mutator(decoder.decode(bytes))
    this.files.set('word/document.xml', encoder.encode(next))
    this.bound = null
  }

  async insertAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
    this.rewriteDocument((xml) => insertMarkerInDocumentXml(xml, field))
  }

  async updateAnchor(field: Field): Promise<void> {
    const previous = this.fields.get(field.id)
    this.fields.set(field.id, field)
    this.rewriteDocument((xml) => updateMarkerInDocumentXml(xml, previous?.name ?? field.name, field))
  }

  async removeAnchor(fieldId: string): Promise<void> {
    const field = this.fields.get(fieldId)
    this.fields.delete(fieldId)
    if (!field) return
    this.rewriteDocument((xml) => removeMarkerFromDocumentXml(xml, field.name))
  }

  async bind(data: Record<string, unknown>): Promise<void> {
    const embeds = planImageEmbeds(data, this.fields.values())
    const next = new Map(this.files)
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    for (const [path, bytes] of this.files) {
      if (!isWordXmlPath(path)) continue
      const original = decoder.decode(bytes)
      let xml = original
      if (path === 'word/document.xml') {
        xml = replaceImageMarkersInXml(xml, embeds)
      }
      xml = bindDocumentXml(xml, data)
      if (xml !== original) next.set(path, encoder.encode(xml))
    }
    this.bound = applyImagePackage(next, embeds)
  }

  async export(): Promise<Uint8Array> {
    if (!this.original) throw new Error('no docx loaded')
    const zip = new JSZip()
    const files = this.bound ?? this.files
    for (const [name, bytes] of files) zip.file(name, bytes)
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  }
}
