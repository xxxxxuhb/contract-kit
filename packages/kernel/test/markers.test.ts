import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregateMarkerFields,
  parseMarkers,
  parseTableColumnRef,
  replaceMarkers,
  replaceRowMarkers,
  splitByMarkers,
  stringifyFieldValue,
} from '../src/markers'
import { setDataPath } from '../src/path'

test('parseMarkers reads name, type, and skips duplicates', () => {
  const markers = parseMarkers('甲方{{partyA}} 付款{{payMethod:select}} 再写{{partyA}} {{未知:nope}}')
  assert.deepEqual(
    markers.map((m) => ({ name: m.name, type: m.type })),
    [
      { name: 'partyA', type: 'text' },
      { name: 'payMethod', type: 'select' },
      { name: '未知', type: 'text' },
    ],
  )
})

test('replaceMarkers fills values and blanks missing ones', () => {
  assert.equal(
    replaceMarkers('甲方：{{partyA}}，付款：{{payMethod:select}}', {
      partyA: 'xx公司',
    }),
    '甲方：xx公司，付款：',
  )
})

test('stringifyFieldValue covers primitives and arrays', () => {
  assert.equal(stringifyFieldValue(null), '')
  assert.equal(stringifyFieldValue(undefined), '')
  assert.equal(stringifyFieldValue(12), '12')
  assert.equal(stringifyFieldValue(true), 'true')
  assert.equal(stringifyFieldValue(['a', 1]), 'a, 1')
  assert.equal(stringifyFieldValue({ x: 1 }), '')
  assert.equal(stringifyFieldValue(new Date('2026-08-15T00:00:00.000Z')), '2026-08-15')
})

test('splitByMarkers keeps surrounding text and field slots in order', () => {
  assert.deepEqual(splitByMarkers('甲方：{{partyA}}　　乙方：{{partyB}}'), [
    { kind: 'text', text: '甲方：' },
    { kind: 'field', name: 'partyA' },
    { kind: 'text', text: '　　乙方：' },
    { kind: 'field', name: 'partyB' },
  ])
})

test('parseMarkers allows spaces inside braces and known types', () => {
  const markers = parseMarkers(
    '{{ partyA }} {{amount:number}} {{signDate:date}} {{rows:table}} {{hint:display}}',
  )
  assert.deepEqual(
    markers.map((m) => ({ name: m.name, type: m.type })),
    [
      { name: 'partyA', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'signDate', type: 'date' },
      { name: 'rows', type: 'table' },
      { name: 'hint', type: 'display' },
    ],
  )
})

test('parseTableColumnRef and aggregateMarkerFields collapse dotted columns', () => {
  assert.deepEqual(parseTableColumnRef('items.name'), { table: 'items', column: 'name' })
  assert.equal(parseTableColumnRef('partyA'), null)

  const markers = parseMarkers(
    '{{items.$index}} {{items.name}} {{items.qty:number}} {{items.name}} {{partyA}}',
  )
  const fields = aggregateMarkerFields(markers)
  const items = fields.find((f) => f.name === 'items')
  assert.equal(items?.type, 'table')
  assert.deepEqual(
    items?.columns?.map((c) => ({ name: c.name, type: c.type })),
    [
      { name: 'name', type: 'text' },
      { name: 'qty', type: 'number' },
    ],
  )
  assert.ok(fields.some((f) => f.name === 'partyA' && f.type === 'text'))
})

test('replaceRowMarkers fills one row and leaves other markers', () => {
  assert.equal(
    replaceRowMarkers(
      '{{items.$index}}. {{items.name}} / {{partyA}}',
      'items',
      { name: '苹果' },
      0,
    ),
    '1. 苹果 / {{partyA}}',
  )
})

test('setDataPath writes nested table cells', () => {
  const data = setDataPath({}, 'items.0.qty', 3)
  assert.deepEqual(data, { items: [{ qty: 3 }] })
  const next = setDataPath(data, 'items.1.name', '橙')
  assert.deepEqual(next, { items: [{ qty: 3 }, { name: '橙' }] })
  const whole = setDataPath(next, 'items', [{ name: 'a' }])
  assert.deepEqual(whole, { items: [{ name: 'a' }] })
})
