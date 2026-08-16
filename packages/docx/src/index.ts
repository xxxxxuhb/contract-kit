import {
  parseMarkers,
  type DiscoveredField,
  type DocumentAdapter,
  type Field,
  type PreviewModel,
  type Source,
} from '@contract-kit/kernel'
import JSZip from 'jszip'
import { buildDocxPreview } from './preview'
import { applyMarkers, extractText, isWordXmlPath } from './xml'

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
    return parseMarkers(chunks.join('\n')).map((marker) => ({
      name: marker.name,
      type: marker.type,
      label: marker.name,
      anchor: { kind: 'marker', name: marker.name },
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

  async insertAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
  }

  async updateAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
  }

  async removeAnchor(fieldId: string): Promise<void> {
    this.fields.delete(fieldId)
  }

  async bind(data: Record<string, unknown>): Promise<void> {
    const next = new Map(this.files)
    for (const [path, bytes] of this.files) {
      if (!isWordXmlPath(path)) continue
      const xml = new TextDecoder().decode(bytes)
      const applied = applyMarkers(xml, data)
      if (applied !== xml) next.set(path, new TextEncoder().encode(applied))
    }
    this.bound = next
  }

  async export(): Promise<Uint8Array> {
    if (!this.original) throw new Error('no docx loaded')
    const zip = new JSZip()
    const files = this.bound ?? this.files
    for (const [name, bytes] of files) zip.file(name, bytes)
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  }
}
