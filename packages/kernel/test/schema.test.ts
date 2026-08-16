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
