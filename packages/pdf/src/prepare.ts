/** Still available for advanced DOM capture; prefer viewport-safe hosts. */
export function freezeControls(root: HTMLElement): void {
  const controls = root.querySelectorAll('input, select, textarea')
  for (const node of controls) {
    const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    const span = root.ownerDocument.createElement('span')
    span.className = 'ck-pdf-value'
    if (el instanceof HTMLSelectElement) {
      const selected = el.selectedOptions[0]
      span.textContent = selected?.textContent?.trim() || el.value || ''
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      span.textContent = el.checked ? '☑' : '☐'
    } else {
      span.textContent = el.value || ''
    }
    span.style.cssText =
      'display:inline;white-space:pre-wrap;border-bottom:1px solid #333;padding:0 2px;min-width:4em;font:inherit;color:inherit;line-height:inherit;'
    el.replaceWith(span)
  }
}

/** @deprecated Prefer in-place capture; off-screen clones often produce blank PDFs. */
export function createCaptureHost(source: HTMLElement): { host: HTMLElement; clone: HTMLElement } {
  const doc = source.ownerDocument
  const host = doc.createElement('div')
  host.setAttribute('data-ck-pdf-host', '')
  host.style.cssText =
    'position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;opacity:0;background:#fff;'
  const clone = source.cloneNode(true) as HTMLElement
  freezeControls(clone)
  host.appendChild(clone)
  doc.body.appendChild(host)
  return { host, clone }
}
