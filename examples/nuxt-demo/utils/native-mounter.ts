import { mountField } from '@contract-kit/ui'
import type { FieldMounter } from '~/utils/field-types'

/** 原生字段：@contract-kit/ui mountField */
export const nativeFieldMounter: FieldMounter = (container, ctx) =>
  mountField(container, {
    name: ctx.name,
    field: ctx.field,
    value: ctx.value,
    error: ctx.error,
    onChange: ctx.onChange,
  })
