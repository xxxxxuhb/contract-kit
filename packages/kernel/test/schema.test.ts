import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildFormSchema,
  buildView,
  emptyValidation,
  validateState,
} from '../src/schema'
import type { KernelState } from '../src/types'

function state(partial: Partial<KernelState> = {}): KernelState {
  return {
    definition: {
      version: 1,
      source: { kind: 'docx', hash: 'abc' },
      fields: [
        {
          id: '1',
          name: 'partyA',
          type: 'text',
          label: '甲方',
          required: true,
          anchor: { kind: 'marker', name: 'partyA' },
        },
        {
          id: '2',
          name: 'payMethod',
          type: 'select',
          options: [{ value: 'wire', label: '电汇' }],
          anchor: { kind: 'marker', name: 'payMethod' },
        },
      ],
    },
    data: {},
    source: { kind: 'docx', buffer: new Uint8Array() },
    validation: emptyValidation(),
    ...partial,
  }
}

test('buildFormSchema falls back to name and copies current values', () => {
  const schema = buildFormSchema(state({ data: { partyA: 'xx公司' } }))
  assert.equal(schema.fields[0].label, '甲方')
  assert.equal(schema.fields[0].value, 'xx公司')
  assert.equal(schema.fields[1].label, 'payMethod')
  assert.equal(schema.fields[0].required, true)
})

test('buildView uses null when a field has no value', () => {
  assert.deepEqual(buildView(state()), [
    { id: '1', label: '甲方', value: null },
    { id: '2', label: 'payMethod', value: null },
  ])
})

test('validateState checks required and select options', () => {
  assert.equal(validateState(state()).ok, false)
  assert.equal(validateState(state()).issues[0].path, 'partyA')

  const filled = validateState(state({ data: { partyA: 'xx', payMethod: 'cash' } }))
  assert.equal(filled.ok, false)
  assert.match(filled.issues[0].message, /不在选项中/)

  const ok = validateState(state({ data: { partyA: 'xx', payMethod: 'wire' } }))
  assert.equal(ok.ok, true)
})

test('validateState checks table rows and column required', () => {
  const withTable = state({
    definition: {
      version: 1,
      source: { kind: 'docx', hash: 'abc' },
      fields: [
        {
          id: 't1',
          name: 'items',
          type: 'table',
          label: '明细',
          required: true,
          columns: [
            { name: 'name', type: 'text', label: '货物', required: true },
            { name: 'qty', type: 'number', label: '数量' },
          ],
          anchor: { kind: 'marker', name: 'items' },
        },
      ],
    },
    data: {},
  })
  assert.equal(validateState(withTable).ok, false)
  assert.equal(validateState(withTable).issues[0].path, 'items')

  const missingCol = validateState({
    ...withTable,
    data: { items: [{ name: '', qty: 1 }] },
  })
  assert.equal(missingCol.ok, false)
  assert.equal(missingCol.issues[0].path, 'items.0.name')

  const ok = validateState({
    ...withTable,
    data: { items: [{ name: '苹果', qty: 1 }] },
  })
  assert.equal(ok.ok, true)
})

test('validateState applies number/date/pattern rules and custom validators', () => {
  const withRules = state({
    definition: {
      version: 1,
      source: { kind: 'docx', hash: 'abc' },
      fields: [
        {
          id: '1',
          name: 'qty',
          type: 'number',
          label: '数量',
          required: true,
          rules: { min: 1, max: 10 },
          anchor: { kind: 'marker', name: 'qty' },
        },
        {
          id: '2',
          name: 'signDate',
          type: 'date',
          label: '签订日',
          anchor: { kind: 'marker', name: 'signDate' },
        },
        {
          id: '3',
          name: 'contractNo',
          type: 'text',
          label: '编号',
          rules: { pattern: '^HT-\\d+$' },
          anchor: { kind: 'marker', name: 'contractNo' },
        },
      ],
    },
    data: { qty: 0, signDate: '2026/08/16', contractNo: 'bad' },
  })
  const result = validateState(withRules)
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((issue) => issue.path === 'qty'))
  assert.ok(result.issues.some((issue) => issue.path === 'signDate'))
  assert.ok(result.issues.some((issue) => issue.path === 'contractNo'))

  const ok = validateState({
    ...withRules,
    data: { qty: 3, signDate: '2026-08-16', contractNo: 'HT-1' },
  })
  assert.equal(ok.ok, true)

  const cross = validateState(
    { ...withRules, data: { qty: 3, signDate: '2026-08-16', contractNo: 'HT-1' } },
    [
      ({ data }) =>
        Number(data.qty) > 2 ? { path: 'qty', message: '跨字段：数量过大' } : null,
    ],
  )
  assert.equal(cross.ok, false)
  assert.equal(cross.issues[0].message, '跨字段：数量过大')
})

test('select without options accepts any value; empty definition is valid', () => {
  const noOptions = state()
  noOptions.definition!.fields[1].options = undefined
  assert.equal(validateState({ ...noOptions, data: { partyA: 'xx', payMethod: 'anything' } }).ok, true)

  assert.equal(
    validateState({
      definition: null,
      data: {},
      source: null,
      validation: emptyValidation(),
    }).ok,
    true,
  )
})
