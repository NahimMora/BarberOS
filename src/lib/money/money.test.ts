import { describe, expect, it } from 'vitest'
import {
  calculateCashSnapshot,
  calculateCommission,
  calculateSaleTotals,
  formatCents,
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
})
