export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercadopago_manual' | 'other'
export type CashMovementType = 'sale' | 'income' | 'expense' | 'withdrawal' | 'adjustment'

const MONEY_PATTERN = /^-?\d{1,10}(?:\.\d{1,2})?$/

export function parseMoney(value: string): bigint {
  const normalized = value.trim()
  if (!MONEY_PATTERN.test(normalized)) {
    throw new MoneyError('Importe inválido')
  }

  const negative = normalized.startsWith('-')
  const absolute = negative ? normalized.slice(1) : normalized
  const [integer, decimal = ''] = absolute.split('.')
  const cents = BigInt(integer) * 100n + BigInt(decimal.padEnd(2, '0'))
  return negative ? -cents : cents
}

export function formatCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const integer = absolute / 100n
  const decimal = String(absolute % 100n).padStart(2, '0')
  return `${negative ? '-' : ''}${integer}.${decimal}`
}

export function calculateSaleTotals(
  items: { quantity: number; unitPrice: string }[],
  discountValue: string,
) {
  if (items.length === 0) throw new MoneyError('La venta requiere al menos un ítem')

  const subtotal = items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new MoneyError('La cantidad debe ser un entero positivo')
    }
    const unitPrice = parseMoney(item.unitPrice)
    if (unitPrice < 0n) throw new MoneyError('El precio no puede ser negativo')
    return sum + unitPrice * BigInt(item.quantity)
  }, 0n)

  const discount = parseMoney(discountValue)
  if (discount < 0n) throw new MoneyError('El descuento no puede ser negativo')
  if (discount > subtotal) {
    throw new MoneyError('El descuento no puede superar el subtotal')
  }

  return {
    subtotal: formatCents(subtotal),
    discount: formatCents(discount),
    total: formatCents(subtotal - discount),
  }
}

export function calculateCommission(totalValue: string, rateValue: string): string {
  const total = parseMoney(totalValue)
  const rateHundredths = parseMoney(rateValue)
  if (total < 0n) throw new MoneyError('La base de comisión no puede ser negativa')
  if (rateHundredths < 0n || rateHundredths > 10000n) {
    throw new MoneyError('La comisión debe estar entre 0 y 100')
  }

  const product = total * rateHundredths
  return formatCents((product + 5000n) / 10000n)
}

export function calculateCashSnapshot(
  openingAmountValue: string,
  movements: { type: CashMovementType; method: PaymentMethod; amount: string }[],
) {
  const openingAmount = parseMoney(openingAmountValue)
  if (openingAmount < 0n) throw new MoneyError('La apertura no puede ser negativa')

  const totals: Record<PaymentMethod, bigint> = {
    cash: openingAmount,
    transfer: 0n,
    card: 0n,
    mercadopago_manual: 0n,
    other: 0n,
  }

  for (const movement of movements) {
    const amount = parseMoney(movement.amount)
    if (movement.type !== 'adjustment' && amount < 0n) {
      throw new MoneyError('El movimiento no puede ser negativo')
    }
    const signedAmount = movement.type === 'expense' || movement.type === 'withdrawal'
      ? -amount
      : amount
    totals[movement.method] += signedAmount
  }

  const expectedTotal = Object.values(totals).reduce((sum, amount) => sum + amount, 0n)
  return {
    expectedCash: formatCents(totals.cash),
    expectedTransfer: formatCents(totals.transfer),
    expectedCard: formatCents(totals.card),
    expectedMercadopagoManual: formatCents(totals.mercadopago_manual),
    expectedOther: formatCents(totals.other),
    expectedTotal: formatCents(expectedTotal),
  }
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}
