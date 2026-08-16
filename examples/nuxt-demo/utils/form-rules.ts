import type { FormRules } from 'element-plus'
import type { Field, TemplateDefinition } from 'contract-kit'

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ''
}

/** 由 definition 生成 el-form rules；校验完全在页面侧，不走 kernel.validate */
export function buildElFormRules(
  definition: TemplateDefinition,
  data: Record<string, unknown>,
): FormRules {
  const rules: FormRules = {}

  for (const field of definition.fields) {
    if (field.type === 'display' || field.type === 'image') continue

    if (field.type === 'table') {
      const rows = Array.isArray(data[field.name]) ? (data[field.name] as unknown[]) : []
      const columns = field.columns ?? []
      rows.forEach((_, rowIndex) => {
        for (const col of columns) {
          if (!col.required) continue
          const prop = `${field.name}.${rowIndex}.${col.name}`
          rules[prop] = [
            {
              validator: (_rule, _value, callback) => {
                const table = Array.isArray(data[field.name])
                  ? (data[field.name] as Record<string, unknown>[])
                  : []
                const cell = table[rowIndex]?.[col.name]
                if (isEmpty(cell)) {
                  callback(new Error(`${col.label ?? col.name} 必填`))
                } else {
                  callback()
                }
              },
              trigger: 'change',
            },
          ]
        }
      })
      if (field.required) {
        rules[field.name] = [
          {
            validator: (_rule, _value, callback) => {
              const rows = Array.isArray(data[field.name]) ? data[field.name] : []
              if (!rows.length) callback(new Error(`${field.label ?? field.name} 必填`))
              else callback()
            },
            trigger: 'change',
          },
        ]
      }
      continue
    }

    const list: NonNullable<FormRules[string]> = []
    if (field.required) {
      if (field.type === 'multiselect') {
        list.push({
          type: 'array',
          required: true,
          min: 1,
          message: `${field.label ?? field.name} 必填`,
          trigger: 'change',
        })
      } else {
        list.push({
          required: true,
          message: `${field.label ?? field.name} 必填`,
          trigger: field.type === 'select' || field.type === 'date' ? 'change' : 'blur',
        })
      }
    }

    if (field.type === 'select' && field.options?.length) {
      list.push({
        validator: (_rule, value, callback) => {
          if (isEmpty(value)) {
            callback()
            return
          }
          if (!field.options!.some((opt) => opt.value === value)) {
            callback(new Error('选项不在允许范围内'))
          } else {
            callback()
          }
        },
        trigger: 'change',
      })
    }

    if (list.length) rules[field.name] = list
  }

  return rules
}

export function flatFormFields(definition: TemplateDefinition): Field[] {
  return definition.fields.filter((f) => f.type !== 'display' && f.type !== 'table' && f.type !== 'image')
}
