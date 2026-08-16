import { createVNode, defineComponent, h, provide, render, type AppContext } from 'vue'
import { formContextKey, type FormContext } from 'element-plus'
import type { FormSchemaField } from 'contract-kit'
import type { FieldHandle, FieldMounter } from '~/utils/field-types'
import ElementField from './ElementField.vue'

/**
 * 自定义字段 UI：挂到文档标记槽位。
 * 需传入 el-form 的 formContext，createVNode 才能让内层 el-form-item 注册到同一表单。
 */
export function createElementFieldMounter(
  appContext: AppContext | null | undefined,
  formContext: FormContext | undefined,
): FieldMounter {
  return (container, ctx) => {
    let fields: FormSchemaField[] = ctx.field ? [ctx.field as FormSchemaField] : []
    let value: unknown = ctx.value
    let validation = {
      ok: !ctx.error,
      issues: ctx.error ? [{ path: ctx.name, message: ctx.error }] : [],
    }

    function paint() {
      const Wrapper = defineComponent({
        name: 'CkFormFieldMount',
        setup() {
          if (formContext) {
            provide(formContextKey, formContext)
          }
          return () =>
            h(ElementField, {
              name: ctx.name,
              fields,
              validation,
              value,
              onSetValue: (_name: string, next: unknown) => ctx.onChange(next),
            })
        },
      })
      const vnode = createVNode(Wrapper)
      if (appContext) vnode.appContext = appContext
      render(vnode, container)
    }

    paint()

    const handle: FieldHandle = {
      update(patch) {
        if (patch.field) {
          fields = [patch.field as FormSchemaField]
          if (patch.value === undefined && 'value' in patch.field) {
            value = patch.field.value
          }
        }
        if (patch.value !== undefined) {
          value = patch.value
          if (fields[0]) {
            fields = [{ ...fields[0], value: patch.value }]
          }
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
