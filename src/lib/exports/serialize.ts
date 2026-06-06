export type ExportCell = string | number | null | undefined

export type SpreadsheetColumn = {
  label: string
  type: 'string' | 'number' | 'date'
}

const FORMULA_PREFIX = /^[=+\-@]/
const NUMERIC_VALUE = /^[+-]?\d+(?:\.\d+)?$/

export function serializeCsv(headers: string[], rows: ExportCell[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]

  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function serializeSpreadsheetXml(
  sheetName: string,
  columns: SpreadsheetColumn[],
  rows: ExportCell[][],
): string {
  const headerRow = columns
    .map((column) => xmlCell(column.label, 'String'))
    .join('')
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column, index) => {
          const value = row[index]
          if (value === null || value === undefined || value === '') {
            return '<Cell><Data ss:Type="String"></Data></Cell>'
          }

          if (column.type === 'number') {
            return xmlCell(String(value), 'Number')
          }

          if (column.type === 'date') {
            return xmlCell(String(value), 'DateTime')
          }

          return xmlCell(neutralizeFormula(String(value)), 'String')
        })
        .join('')

      return `<Row>${cells}</Row>`
    })
    .join('')

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    `<Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}"><Table>`,
    `<Row>${headerRow}</Row>`,
    bodyRows,
    '</Table></Worksheet></Workbook>',
  ].join('')
}

function escapeCsvCell(value: ExportCell): string {
  const text = neutralizeFormula(value === null || value === undefined ? '' : String(value))
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) && !NUMERIC_VALUE.test(value) ? `'${value}` : value
}

function xmlCell(value: string, type: 'String' | 'Number' | 'DateTime'): string {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
