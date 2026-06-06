import { describe, expect, it } from 'vitest'
import { serializeCsv, serializeSpreadsheetXml } from './serialize'

describe('serializeCsv', () => {
  it('escapes separators and quotes and includes a UTF-8 BOM', () => {
    const csv = serializeCsv(
      ['Cliente', 'Nota'],
      [['Ana, Maria', 'Dijo "hola"']],
    )

    expect(csv).toBe('\uFEFFCliente,Nota\r\n"Ana, Maria","Dijo ""hola"""\r\n')
  })

  it('neutralizes spreadsheet formulas', () => {
    const csv = serializeCsv(['Valor'], [['=1+1'], ['@SUM(A1:A2)']])

    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'@SUM(A1:A2)")
  })
})

describe('serializeSpreadsheetXml', () => {
  it('escapes XML and writes numeric cells as numbers', () => {
    const xml = serializeSpreadsheetXml(
      'Ventas',
      [
        { label: 'Cliente', type: 'string' },
        { label: 'Total', type: 'number' },
      ],
      [['A & B', '1250.50']],
    )

    expect(xml).toContain('A &amp; B')
    expect(xml).toContain('ss:Type="Number">1250.50')
    expect(xml).toContain('ss:Name="Ventas"')
  })

  it('neutralizes formula-like strings', () => {
    const xml = serializeSpreadsheetXml(
      'Clientes',
      [{ label: 'Nombre', type: 'string' }],
      [['+CMD']],
    )

    expect(xml).toContain('&apos;+CMD')
  })
})
