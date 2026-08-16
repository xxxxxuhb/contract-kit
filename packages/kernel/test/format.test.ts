import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatData, formatFieldValue } from '../src/format'
import type { TemplateDefinition } from '../src/types'

test('formatFieldValue keeps canonical value without outputFormat', () => {
  assert.equal(formatFieldValue('2026-08-16', { type: 'date' }), '2026-08-16')
  assert.equal(formatFieldValue(15998, { type: 'number' }), 15998)
  assert.equal(formatFieldValue('wire', { type: 'select' }), 'wire')
  assert.equal(formatFieldValue('', { type: 'date', outputFormat: 'DD/MM/YYYY' }), '')
})

test('formatFieldValue formats date / number / select label', () => {
  assert.equal(
    formatFieldValue('2026-08-16', { type: 'date', outputFormat: 'DD日MM月YYYY年' }),
    '16日08月2026年',
  )
  assert.equal(
    formatFieldValue('2026-08-16', { type: 'date', outputFormat: 'YYYY年M月D日' }),
    '2026年8月16日',
  )
  assert.equal(formatFieldValue(15998, { type: 'number', outputFormat: '#,##0.00' }), '15,998.00')
  assert.equal(
    formatFieldValue('wire', {
      type: 'select',
      outputFormat: 'label',
      options: [{ value: 'wire', label: '电汇' }],
    }),
    '电汇',
  )
  assert.equal(
    formatFieldValue(['east', 'south'], {
      type: 'multiselect',
      outputFormat: 'label',
      options: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' },
      ],
    }),
    '华东, 华南',
  )
})

test('formatFieldValue uses named custom formatters', () => {
  const text = formatFieldValue(100, { type: 'number', outputFormat: 'amountCn' }, {
    formatters: {
      amountCn: ({ value }) => `人民币${value}元`,
    },
  })
  assert.equal(text, '人民币100元')
})

test('formatData applies field and table column formats', () => {
  const definition: TemplateDefinition = {
    version: 1,
    source: { kind: 'docx', hash: 'x' },
    fields: [
      {
        id: '1',
        name: 'signDate',
        type: 'date',
        outputFormat: 'DD/MM/YYYY',
        anchor: { kind: 'marker', name: 'signDate' },
      },
      {
        id: '2',
        name: 'items',
        type: 'table',
        columns: [{ name: 'category', type: 'select', outputFormat: 'label', options: [{ value: 'hw', label: '硬件' }] }],
        anchor: { kind: 'marker', name: 'items' },
      },
      {
        id: '3',
        name: 'stamp',
        type: 'image',
        outputFormat: 'label',
        anchor: { kind: 'marker', name: 'stamp' },
      },
    ],
  }
  const data = {
    signDate: '2026-08-16',
    items: [{ category: 'hw', name: '电脑' }],
    stamp: 'data:image/png;base64,AAAA',
  }
  assert.deepEqual(formatData(definition, data), {
    signDate: '16/08/2026',
    items: [{ category: '硬件', name: '电脑' }],
    stamp: 'data:image/png;base64,AAAA',
  })
})
