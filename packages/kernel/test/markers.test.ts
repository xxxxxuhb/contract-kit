import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseMarkers,
  replaceMarkers,
  splitByMarkers,
  stringifyFieldValue,
} from '../src/markers'

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
  const markers = parseMarkers('{{ partyA }} {{amount:number}} {{signDate:date}} {{rows:table}}')
  assert.deepEqual(
    markers.map((m) => ({ name: m.name, type: m.type })),
    [
      { name: 'partyA', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'signDate', type: 'date' },
      { name: 'rows', type: 'table' },
    ],
  )
})
