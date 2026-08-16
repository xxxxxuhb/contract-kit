import { useEffect, useState } from 'react'
import { snapshotKernel, type Kernel, type KernelSnapshot } from '@paperfill/kernel'

const empty: KernelSnapshot = {
  schema: { fields: [] },
  data: {},
  validation: { ok: true, issues: [] },
  preview: null,
  definition: null,
  source: null,
}

/**
 * Subscribe a React component to kernel query snapshots.
 * Call `mountDocxPreview` / `mountXlsxPreview` only after mount (no SSR).
 */
export function useContractKit(kernel: Kernel | null | undefined): KernelSnapshot {
  const [snap, setSnap] = useState<KernelSnapshot>(empty)

  useEffect(() => {
    if (!kernel) {
      setSnap(empty)
      return
    }
    setSnap(snapshotKernel(kernel))
    return kernel.subscribe(() => setSnap(snapshotKernel(kernel)))
  }, [kernel])

  return snap
}

export type { KernelSnapshot }
