import { createVNode, render, type AppContext } from 'vue'
import type { FormSchemaField } from '@contract-kit/kernel'
import type { FieldHandle, FieldMounter } from '@shared/field-types'
import ElementField from './ElementField.vue'

/**
 * 自定义字段 UI：用 Element Plus 挂到文档标记槽位。
 * 不依赖 @contract-kit/ui —— 接入方自己实现 mount。
 */
export function createElementFieldMounter(appContext: AppContext | null | undefined): FieldMounter {
  return (container, ctx) => {
    let fields: FormSchemaField[] = ctx.field ? [ctx.field] : []
    let validation = {
      ok: !ctx.error,
      issues: ctx.error ? [{ path: ctx.name, message: ctx.error }] : [],
    }

    function paint() {
      const vnode = createVNode(ElementField, {
        name: ctx.name,
        fields,
        validation,
        onSetValue: (_name: string, value: unknown) => ctx.onChange(value),
      })
      if (appContext) vnode.appContext = appContext
      render(vnode, container)
    }

    paint()

    const handle: FieldHandle = {
      update(patch) {
        if (patch.field) {
          fields = [patch.field]
        } else if (patch.value !== undefined && fields[0]) {
          fields = [{ ...fields[0], value: patch.value }]
        }
        if ('error' in patch) {
          validation = {
            ok: !patch.error,
            issues: patch.error ? [{ path: ctx.name, message: patch.error }] : [],
          }
        }
        paint()
      },
      destroy() {
        render(null, container)
      },
    }
    return handle
  }
}
