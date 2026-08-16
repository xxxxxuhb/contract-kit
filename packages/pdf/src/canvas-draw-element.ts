import type { ExportPdfOptions } from './types'

type Canvas2DWithDrawElement = CanvasRenderingContext2D & {
  drawElementImage: (
    element: Element,
    dx?: number,
    dy?: number,
    dWidth?: number,
    dHeight?: number,
  ) => DOMMatrix | void
}

type CanvasWithPaint = HTMLCanvasElement & {
  requestPaint?: () => void
}

/** Chromium flag: chrome://flags/#canvas-draw-element */
export function supportsCanvasDrawElement(): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.setAttribute('layoutsubtree', '')
  const ctx = canvas.getContext('2d') as Canvas2DWithDrawElement | null
  return Boolean(ctx && typeof ctx.drawElementImage === 'function')
}

/**
 * Rasterize via WICG html-in-canvas (`drawElementImage`).
 * Spec: only an **immediate** child of `<canvas layoutsubtree>` may be drawn,
 * and drawing should happen inside the `paint` event.
 */
export async function rasterizeWithDrawElement(
  element: HTMLElement,
  scale: number,
  background: string,
): Promise<HTMLCanvasElement> {
  if (!supportsCanvasDrawElement()) {
    throw new Error(
      '当前环境不支持 canvas-draw-element。请使用 Chromium 并开启 chrome://flags/#canvas-draw-element，或改用 mode: "html2canvas" / "print"',
    )
  }

  const cssW = Math.max(element.scrollWidth, element.offsetWidth, 1)
  const cssH = Math.max(element.scrollHeight, element.offsetHeight, 1)

  const shell = document.createElement('div')
  shell.style.cssText =
    'position:fixed;left:0;top:0;z-index:-1;opacity:1;pointer-events:none;background:#fff;'
  document.body.appendChild(shell)

  const canvas = document.createElement('canvas') as CanvasWithPaint
  canvas.setAttribute('layoutsubtree', '')
  // Size bitmap before attaching layout children (avoids reset wiping first paint)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.max(1, Math.floor(cssW * scale))
  canvas.height = Math.max(1, Math.floor(cssH * scale))
  shell.appendChild(canvas)

  // Only this node is a direct child of <canvas> — required by drawElementImage
  const drawRoot = document.createElement('div')
  drawRoot.setAttribute('data-ck-draw-root', '')
  drawRoot.style.cssText = `width:${cssW}px;min-height:${cssH}px;background:${background};box-sizing:border-box;`
  canvas.appendChild(drawRoot)

  const parent = element.parentNode
  const next = element.nextSibling
  drawRoot.appendChild(element)

  try {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

    const ctx = canvas.getContext('2d') as Canvas2DWithDrawElement

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('canvas-draw-element paint 超时')),
        8000,
      )

      const onPaint = () => {
        try {
          window.clearTimeout(timer)
          ctx.reset?.()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.fillStyle = background
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          // Must pass the immediate child (drawRoot), not nested section/docx nodes
          ctx.drawElementImage(drawRoot, 0, 0, canvas.width, canvas.height)
          resolve()
        } catch (err) {
          window.clearTimeout(timer)
          reject(err)
        }
      }

      canvas.addEventListener('paint', onPaint, { once: true })
      canvas.requestPaint?.()
      requestAnimationFrame(() => canvas.requestPaint?.())
    })

    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const outCtx = out.getContext('2d')
    if (!outCtx) throw new Error('无法创建输出 canvas')
    outCtx.drawImage(canvas, 0, 0)
    return out
  } finally {
    if (parent) parent.insertBefore(element, next)
    else element.remove()
    shell.remove()
  }
}

export async function exportElementWithDrawElement(
  root: HTMLElement,
  options: ExportPdfOptions,
  toPdf: (canvases: HTMLCanvasElement[]) => Promise<Uint8Array>,
  resolveTargets: (root: HTMLElement, selector: string) => HTMLElement[],
): Promise<Uint8Array> {
  const scale = options.scale ?? 2
  const background = options.background ?? '#ffffff'
  const pageSelector = options.pageSelector ?? 'section.docx'
  const targets = resolveTargets(root, pageSelector)
  const canvases: HTMLCanvasElement[] = []
  for (const target of targets) {
    canvases.push(await rasterizeWithDrawElement(target, scale, background))
  }
  return toPdf(canvases)
}
