import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { createKernel, type FieldColumn, type TemplateDefinition } from '@contract-kit/kernel'
import { DocxAdapter } from '@contract-kit/docx'
import { XlsxAdapter } from '@contract-kit/xlsx'

type FieldMeta = {
  label: string
  required?: boolean
  options?: { value: string; label: string }[]
  columns?: FieldColumn[]
}

/** 业务侧字段配置：覆盖全部 FieldType（含 table 列内 select） */
const FIELD_META: Record<string, FieldMeta> = {
  contractNo: { label: '合同编号', required: true },
  signPlace: { label: '签订地点' },
  partyA: { label: '甲方', required: true },
  partyAAddress: { label: '甲方地址' },
  partyAContact: { label: '甲方联系人' },
  partyB: { label: '乙方', required: true },
  partyBAddress: { label: '乙方地址' },
  partyBContact: { label: '乙方联系人' },
  items: {
    label: '货物明细',
    required: true,
    columns: [
      { name: 'name', type: 'text', label: '货物名称', required: true },
      {
        name: 'category',
        type: 'select',
        label: '类别',
        options: [
          { value: 'hardware', label: '硬件' },
          { value: 'software', label: '软件' },
          { value: 'service', label: '服务' },
        ],
      },
      { name: 'qty', type: 'number', label: '数量' },
      { name: 'unitPrice', type: 'number', label: '单价' },
    ],
  },
  amount: { label: '合同金额' },
  payMethod: {
    label: '付款方式',
    options: [
      { value: 'wire', label: '电汇' },
      { value: 'acceptance', label: '承兑汇票' },
      { value: 'check', label: '支票' },
    ],
  },
  deliveryRegions: {
    label: '交货区域',
    options: [
      { value: 'east', label: '华东' },
      { value: 'north', label: '华北' },
      { value: 'south', label: '华南' },
      { value: 'west', label: '西部' },
    ],
  },
  payTerm: { label: '付款期限' },
  deliveryDate: { label: '交货日期' },
  deliveryPlace: { label: '交货地点' },
  warranty: { label: '质保期限' },
  signDate: { label: '签订日期' },
  note: { label: '备注' },
  filledAt: { label: '填写日' },
  stamp: { label: '附件图片' },
}

async function publishDefinition(
  kind: 'docx' | 'xlsx',
  buffer: Uint8Array,
  meta: Record<string, FieldMeta> = FIELD_META,
): Promise<TemplateDefinition> {
  const kernel = createKernel({
    adapter: kind === 'docx' ? new DocxAdapter() : new XlsxAdapter(),
  })
  await kernel.dispatch({ type: 'load', source: { kind, buffer } })
  const definition = structuredClone(kernel.getDefinition()!)
  for (const field of definition.fields) {
    const next = meta[field.name]
    if (!next) continue
    field.label = next.label
    field.required = next.required
    if (next.options) field.options = next.options
    else delete field.options
    if (next.columns) {
      field.columns = next.columns.map((col) => {
        const discovered = field.columns?.find((item) => item.name === col.name)
        return {
          name: col.name,
          type: col.type ?? discovered?.type ?? 'text',
          label: col.label ?? col.name,
          required: col.required,
          options: col.options,
        }
      })
    }
  }
  return definition
}

const root = dirname(fileURLToPath(import.meta.url))

const COLORS = {
  navy: '1B3A5C',
  navySoft: '2E5A88',
  gold: 'C4A35A',
  cream: 'F7F3EA',
  rowAlt: 'EEF4FA',
  labelBg: 'E8EEF5',
  white: 'FFFFFF',
  border: '1B3A5C',
  muted: '5A6B7D',
}

type Align = 'left' | 'center' | 'right' | 'both'

function run(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; font?: string } = {},
): string {
  const font = opts.font ?? '宋体'
  const size = opts.size ?? 21
  const color = opts.color ? `<w:color w:val="${opts.color}"/>` : ''
  const bold = opts.bold ? '<w:b/><w:bCs/>' : ''
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${color}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`
}

function paragraph(
  content: string,
  opts: {
    align?: Align
    before?: number
    after?: number
    shade?: string
    indent?: boolean
  } = {},
): string {
  const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : ''
  const spacing = `<w:spacing w:before="${opts.before ?? 60}" w:after="${opts.after ?? 60}" w:line="360" w:lineRule="auto"/>`
  const shade = opts.shade
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`
    : ''
  const indent = opts.indent ? `<w:ind w:firstLine="480"/>` : ''
  return `<w:p><w:pPr>${jc}${spacing}${shade}${indent}</w:pPr>${content}</w:p>`
}

function banner(text: string): string {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9040" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="nil"/><w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="9040"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="9040" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.navy}"/>
          <w:tcMar><w:top w:w="160"/><w:left w:w="200"/><w:bottom w:w="160"/><w:right w:w="200"/></w:tcMar>
        </w:tcPr>
        ${paragraph(run(text, { bold: true, size: 40, color: COLORS.white, font: '黑体' }), {
          align: 'center',
          before: 80,
          after: 80,
        })}
        ${paragraph(run('PURCHASE CONTRACT', { size: 16, color: COLORS.gold, font: 'Arial' }), {
          align: 'center',
          before: 0,
          after: 40,
        })}
      </w:tc>
    </w:tr>
  </w:tbl>`
}

function sectionTitle(text: string): string {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9040" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="nil"/><w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="120"/><w:gridCol w:w="8920"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="120" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.gold}"/>
        </w:tcPr>
        ${paragraph(run(' '), { before: 40, after: 40 })}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="8920" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.cream}"/>
          <w:tcMar><w:left w:w="120"/></w:tcMar>
        </w:tcPr>
        ${paragraph(run(text, { bold: true, size: 22, color: COLORS.navy, font: '黑体' }), {
          before: 80,
          after: 80,
        })}
      </w:tc>
    </w:tr>
  </w:tbl>`
}

function cellXml(
  text: string,
  width: number,
  opts: { shade?: string; bold?: string; color?: string; align?: Align } = {},
): string {
  const shade = opts.shade
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`
    : ''
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${shade}
      <w:tcMar><w:top w:w="60"/><w:left w:w="100"/><w:bottom w:w="60"/><w:right w:w="100"/></w:tcMar>
    </w:tcPr>
    ${paragraph(run(text, { bold: Boolean(opts.bold), size: 20, color: opts.color }), {
      align: opts.align ?? 'left',
      before: 40,
      after: 40,
    })}
  </w:tc>`
}

function infoTable(rows: Array<{ label: string; value: string; accent?: boolean }>): string {
  const w1 = 2600
  const w2 = 6440
  const body = rows
    .map((row, index) => {
      const shade = row.accent ? COLORS.rowAlt : COLORS.white
      return `<w:tr>
        ${cellXml(row.label, w1, { shade: COLORS.labelBg, bold: '1', color: COLORS.navy })}
        ${cellXml(row.value, w2, { shade })}
      </w:tr>`
    })
    .join('')
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9040" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:left w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:right w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="A8B8C8"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="A8B8C8"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="${w1}"/><w:gridCol w:w="${w2}"/></w:tblGrid>
    ${body}
  </w:tbl>`
}

function goodsTable(): string {
  const widths = [700, 2400, 1800, 1400, 2740]
  const header = ['序号', '货物名称', '类别', '数量', '单价（元）']
  const values = [
    '{{items.$index}}',
    '{{items.name}}',
    '{{items.category:select}}',
    '{{items.qty:number}}',
    '{{items.unitPrice:number}}',
  ]
  const headerRow = `<w:tr>${header
    .map((h, i) =>
      cellXml(h, widths[i], {
        shade: COLORS.navy,
        bold: '1',
        color: COLORS.white,
        align: 'center',
      }),
    )
    .join('')}</w:tr>`
  const valueRow = `<w:tr>${values
    .map((v, i) => cellXml(v, widths[i], { shade: COLORS.cream, align: i === 0 ? 'center' : 'left' }))
    .join('')}</w:tr>`
  const totalRow = `<w:tr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${widths[0] + widths[1] + widths[2] + widths[3]}" w:type="dxa"/>
        <w:gridSpan w:val="4"/>
        <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.gold}"/>
      </w:tcPr>
      ${paragraph(run('合同金额合计（元）', { bold: true, size: 20, color: COLORS.navy }), {
        align: 'right',
        before: 60,
        after: 60,
      })}
    </w:tc>
    ${cellXml('{{amount:number}}', widths[4], { shade: COLORS.gold, bold: '1', color: COLORS.navy })}
  </w:tr>`
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9040" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:left w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:right w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="A8B8C8"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="A8B8C8"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
    ${headerRow}${valueRow}${totalRow}
  </w:tbl>`
}

function signBox(): string {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9040" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:left w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:right w:val="single" w:sz="8" w:space="0" w:color="${COLORS.border}"/>
        <w:insideH w:val="nil"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="A8B8C8"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="4520"/><w:gridCol w:w="4520"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4520" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.cream}"/>
          <w:tcMar><w:top w:w="120"/><w:left w:w="140"/><w:bottom w:w="120"/><w:right w:w="140"/></w:tcMar>
        </w:tcPr>
        ${paragraph(run('甲方（盖章）', { bold: true, size: 20, color: COLORS.navy }), { before: 40, after: 80 })}
        ${paragraph(run('名称：{{partyA}}', { size: 20 }), { before: 40, after: 120 })}
        ${paragraph(run('日期：{{signDate:date}}', { size: 20 }), { before: 40, after: 40 })}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4520" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${COLORS.rowAlt}"/>
          <w:tcMar><w:top w:w="120"/><w:left w:w="140"/><w:bottom w:w="120"/><w:right w:w="140"/></w:tcMar>
        </w:tcPr>
        ${paragraph(run('乙方（盖章）', { bold: true, size: 20, color: COLORS.navy }), { before: 40, after: 80 })}
        ${paragraph(run('名称：{{partyB}}', { size: 20 }), { before: 40, after: 120 })}
        ${paragraph(run('日期：{{signDate:date}}', { size: 20 }), { before: 40, after: 40 })}
      </w:tc>
    </w:tr>
  </w:tbl>`
}

async function makeDocx(): Promise<Uint8Array> {
  const body = [
    banner('采购合同'),
    paragraph('', { before: 120, after: 40 }),
    paragraph(
      run('合同编号：', { bold: true, color: COLORS.muted }) + run('{{contractNo}}', { color: COLORS.navy }),
      { align: 'right' },
    ),
    paragraph(
      run('签订地点：', { bold: true, color: COLORS.muted }) + run('{{signPlace}}', { color: COLORS.navy }),
      { align: 'right', after: 120 },
    ),
    sectionTitle('一、合同双方'),
    paragraph('', { before: 80 }),
    infoTable([
      { label: '甲方（采购方）', value: '{{partyA}}' },
      { label: '甲方地址', value: '{{partyAAddress}}', accent: true },
      { label: '甲方联系人', value: '{{partyAContact}}' },
      { label: '乙方（供货方）', value: '{{partyB}}', accent: true },
      { label: '乙方地址', value: '{{partyBAddress}}' },
      { label: '乙方联系人', value: '{{partyBContact}}', accent: true },
    ]),
    paragraph('', { before: 160 }),
    paragraph(
      run(
        '甲乙双方根据《中华人民共和国民法典》及相关法律法规，本着平等、自愿、诚实信用的原则，经协商一致，订立本合同。',
        { size: 20, color: COLORS.muted },
      ),
      { align: 'both', indent: true, after: 120 },
    ),
    sectionTitle('二、标的与价款'),
    paragraph('', { before: 80 }),
    goodsTable(),
    paragraph('', { before: 160 }),
    sectionTitle('三、付款与交付'),
    paragraph('', { before: 80 }),
    infoTable([
      { label: '付款方式', value: '{{payMethod:select}}' },
      { label: '交货区域', value: '{{deliveryRegions:multiselect}}', accent: true },
      { label: '付款期限', value: '{{payTerm}}' },
      { label: '交货日期', value: '{{deliveryDate:date}}', accent: true },
      { label: '交货地点', value: '{{deliveryPlace}}' },
      { label: '质保期限', value: '{{warranty}}', accent: true },
    ]),
    paragraph('', { before: 160 }),
    sectionTitle('四、其他约定'),
    paragraph('', { before: 80 }),
    infoTable([
      { label: '签订日期', value: '{{signDate:date}}' },
      { label: '备注说明', value: '{{note:textarea}}', accent: true },
      { label: '填写日', value: '{{filledAt:display}}' },
      { label: '附件图片', value: '{{stamp:image}}', accent: true },
    ]),
    paragraph('', { before: 200 }),
    sectionTitle('五、签章确认'),
    paragraph('', { before: 80 }),
    signBox(),
    paragraph('', { before: 160 }),
    paragraph(
      run('本页面为模板示意：深蓝标题栏、金色章节条、表格底色与签章区背景色均可被预览保留。', {
        size: 16,
        color: COLORS.muted,
      }),
      { align: 'center', after: 40 },
    ),
  ].join('')

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  )
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体"/><w:sz w:val="21"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`,
  )
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:background w:color="${COLORS.cream}"/>
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1008" w:right="1134" w:bottom="1008" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`,
  )
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

async function makeXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('采购合同', {
    properties: { tabColor: { argb: `FF${COLORS.navy}` } },
  })

  sheet.mergeCells('A1:D1')
  const title = sheet.getCell('A1')
  title.value = '采购合同'
  title.font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' }, name: '微软雅黑' }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }
  sheet.getRow(1).height = 36

  sheet.mergeCells('A2:D2')
  sheet.getCell('A2').value = 'PURCHASE CONTRACT'
  sheet.getCell('A2').font = { size: 10, color: { argb: `FF${COLORS.gold}` }, name: 'Arial' }
  sheet.getCell('A2').alignment = { horizontal: 'center' }
  sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }

  const thin = {
    top: { style: 'thin' as const, color: { argb: `FF${COLORS.border}` } },
    left: { style: 'thin' as const, color: { argb: `FF${COLORS.border}` } },
    bottom: { style: 'thin' as const, color: { argb: `FF${COLORS.border}` } },
    right: { style: 'thin' as const, color: { argb: `FF${COLORS.border}` } },
  }

  function paintRow(row: number, label: string, marker: string, alt = false) {
    const a = sheet.getCell(`A${row}`)
    const b = sheet.getCell(`B${row}`)
    sheet.mergeCells(`B${row}:D${row}`)
    a.value = label
    b.value = marker
    a.font = { bold: true, color: { argb: `FF${COLORS.navy}` } }
    a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.labelBg}` } }
    b.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: alt ? `FF${COLORS.rowAlt}` : `FF${COLORS.white}` },
    }
    a.border = thin
    b.border = thin
    sheet.getCell(`C${row}`).border = thin
    sheet.getCell(`D${row}`).border = thin
  }

  const rows: Array<[string, string]> = [
    ['合同编号', '{{contractNo}}'],
    ['签订地点', '{{signPlace}}'],
    ['甲方（采购方）', '{{partyA}}'],
    ['甲方地址', '{{partyAAddress}}'],
    ['甲方联系人', '{{partyAContact}}'],
    ['乙方（供货方）', '{{partyB}}'],
    ['乙方地址', '{{partyBAddress}}'],
    ['乙方联系人', '{{partyBContact}}'],
    ['合同金额（元）', '{{amount:number}}'],
    ['付款方式', '{{payMethod:select}}'],
    ['交货区域', '{{deliveryRegions:multiselect}}'],
    ['付款期限', '{{payTerm}}'],
    ['交货日期', '{{deliveryDate:date}}'],
    ['交货地点', '{{deliveryPlace}}'],
    ['质保期限', '{{warranty}}'],
    ['签订日期', '{{signDate:date}}'],
    ['备注说明', '{{note:textarea}}'],
    ['填写日', '{{filledAt:display}}'],
    ['附件图片', '{{stamp:image}}'],
  ]
  rows.forEach(([label, marker], i) => paintRow(i + 4, label, marker, i % 2 === 1))

  // 循环明细表：表头 + 一行模板
  const itemsHeader = 4 + rows.length + 1
  const itemsRow = itemsHeader + 1
  sheet.getCell(`A${itemsHeader}`).value = '序号'
  sheet.getCell(`B${itemsHeader}`).value = '货物名称'
  sheet.getCell(`C${itemsHeader}`).value = '类别'
  sheet.getCell(`D${itemsHeader}`).value = '数量'
  sheet.getCell(`E${itemsHeader}`).value = '单价'
  for (const col of ['A', 'B', 'C', 'D', 'E']) {
    const cell = sheet.getCell(`${col}${itemsHeader}`)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }
    cell.border = thin
  }
  sheet.getCell(`A${itemsRow}`).value = '{{items.$index}}'
  sheet.getCell(`B${itemsRow}`).value = '{{items.name}}'
  sheet.getCell(`C${itemsRow}`).value = '{{items.category:select}}'
  sheet.getCell(`D${itemsRow}`).value = '{{items.qty:number}}'
  sheet.getCell(`E${itemsRow}`).value = '{{items.unitPrice:number}}'
  for (const col of ['A', 'B', 'C', 'D', 'E']) {
    sheet.getCell(`${col}${itemsRow}`).border = thin
  }

  sheet.getColumn(1).width = 18
  sheet.getColumn(2).width = 18
  sheet.getColumn(3).width = 18
  sheet.getColumn(4).width = 12
  sheet.getColumn(5).width = 12

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

async function main() {
  const targets = [root]
  for (const dir of targets) await mkdir(dir, { recursive: true })

  const docx = await makeDocx()
  const xlsx = await makeXlsx()
  const docxDefinition = await publishDefinition('docx', docx)
  const xlsxDefinition = await publishDefinition('xlsx', xlsx)

  const artifacts: [string, Uint8Array | string][] = [
    ['采购合同.docx', docx],
    ['采购合同.xlsx', xlsx],
    ['采购合同.docx.definition.json', JSON.stringify(docxDefinition, null, 2)],
    ['采购合同.xlsx.definition.json', JSON.stringify(xlsxDefinition, null, 2)],
  ]

  for (const dir of targets) {
    for (const [name, content] of artifacts) {
      await writeFile(join(dir, name), content)
    }
  }
  console.log('wrote templates + definitions to', targets.join(', '))
}

void main()
