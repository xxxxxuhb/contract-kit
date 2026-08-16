import { mountField } from '@contract-kit/ui'
import type { FieldMounter } from '@shared/field-types'

/** 使用 @contract-kit/ui 原生控件 */
export const nativeFieldMounter: FieldMounter = (container, ctx) =>
  mountField(container, {
    name: ctx.name,
    field: ctx.field,
    error: ctx.error,
    onChange: ctx.onChange,
  })
