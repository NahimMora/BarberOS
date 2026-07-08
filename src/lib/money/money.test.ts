import { describe, expect, it } from 'vitest'
import {
  calculateCashSnapshot,
  calculateCommission,
  calculateSaleTotals,
  formatCents,
  formatMoneyDisplay,
  maskMoneyInput,
  parseMoney,
} from './money'

describe('money', () => {
  it('parses and formats decimal money without floating point', () => {
    expect(parseMoney('1234567890.12')).toBe(123456789012n)
    expect(parseMoney('10')).toBe(1000n)
    expect(formatCents(123456789012n)).toBe('1234567890.12')
  })

  it('calculates a discounted sale from item quantities', () => {
    expect(calculateSaleTotals([
      { quantity: 2, unitPrice: '3500.00' },
      { quantity: 1, unitPrice: '2000.00' },
    ], '1500.00')).toEqual({
      subtotal: '9000.00',
      discount: '1500.00',
      total: '7500.00',
    })
  })

  it('rejects a discount greater than the subtotal', () => {
    expect(() => calculateSaleTotals([
      { quantity: 1, unitPrice: '3000.00' },
    ], '3000.01')).toThrow('El descuento no puede superar el subtotal')
  })

  it('calculates commission over net paid total and rounds to cents', () => {
    expect(calculateCommission('8000.00', '25.00')).toBe('2000.00')
    expect(calculateCommission('999.99', '12.50')).toBe('125.00')
  })

  it('keeps physical cash separate from digital methods at close', () => {
    expect(calculateCashSnapshot('10000.00', [
      { type: 'sale', method: 'cash', amount: '8000.00' },
      { type: 'sale', method: 'transfer', amount: '12000.00' },
      { type: 'sale', method: 'card', amount: '9000.00' },
      { type: 'expense', method: 'cash', amount: '1500.00' },
      { type: 'withdrawal', method: 'cash', amount: '2000.00' },
      { type: 'adjustment', method: 'cash', amount: '-500.00' },
      { type: 'income', method: 'mercadopago_manual', amount: '3000.00' },
    ])).toEqual({
      expectedCash: '14000.00',
      expectedTransfer: '12000.00',
      expectedCard: '9000.00',
      expectedMercadopagoManual: '3000.00',
      expectedOther: '0.00',
      expectedTotal: '38000.00',
    })
  })

  it('reverses a voided sale from the affected payment method only', () => {
    expect(calculateCashSnapshot('0.00', [
      { type: 'sale', method: 'cash', amount: '5000.00' },
      { type: 'sale', method: 'card', amount: '3000.00' },
      { type: 'void', method: 'cash', amount: '-5000.00' },
    ])).toEqual({
      expectedCash: '0.00',
      expectedTransfer: '0.00',
      expectedCard: '3000.00',
      expectedMercadopagoManual: '0.00',
      expectedOther: '0.00',
      expectedTotal: '3000.00',
    })
  })

  it('rejects a void movement with a non-negative amount', () => {
    expect(() => calculateCashSnapshot('0.00', [
      { type: 'void', method: 'cash', amount: '100.00' },
    ])).toThrow('El reverso de anulación debe ser negativo')
  })

  it('formats a canonical value for display with thousands and two decimals', () => {
    expect(formatMoneyDisplay('1234.5')).toBe('1.234,50')
    expect(formatMoneyDisplay('0.00')).toBe('0,00')
    expect(formatMoneyDisplay('')).toBe('')
    expect(formatMoneyDisplay('-500.00', true)).toBe('-500,00')
  })

  it('groups thousands live while typing a whole amount', () => {
    expect(maskMoneyInput('1000', 4)).toEqual({
      display: '1.000',
      cursor: 5,
      canonical: '1000.00',
    })
  })

  it('keeps a decimal comma and pads cents on submit', () => {
    expect(maskMoneyInput('1500,5', 6)).toEqual({
      display: '1.500,5',
      cursor: 7,
      canonical: '1500.50',
    })
  })

  it('treats an empty field as zero without forcing a visible 0', () => {
    expect(maskMoneyInput('', 0)).toEqual({
      display: '',
      cursor: 0,
      canonical: '0.00',
    })
  })

  it('collapses a leading zero once another digit is typed', () => {
    expect(maskMoneyInput('0500', 4)).toEqual({
      display: '500',
      cursor: 3,
      canonical: '500.00',
    })
  })

  it('supports a negative sign only when explicitly allowed', () => {
    expect(maskMoneyInput('-1500', 5, true)).toEqual({
      display: '-1.500',
      cursor: 6,
      canonical: '-1500.00',
    })
    expect(maskMoneyInput('-1500', 5, false)).toEqual({
      display: '1.500',
      cursor: 5,
      canonical: '1500.00',
    })
  })
})
