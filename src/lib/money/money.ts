export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercadopago_manual' | 'other'
export type CashMovementType = 'sale' | 'income' | 'expense' | 'withdrawal' | 'adjustment' | 'void'

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
    if (movement.type === 'void') {
      if (amount >= 0n) throw new MoneyError('El reverso de anulación debe ser negativo')
    } else if (movement.type !== 'adjustment' && amount < 0n) {
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

const isSignificantChar = (char: string) => (char >= '0' && char <= '9') || char === ','

/**
 * Formats a canonical decimal string (e.g. "1234.5") as an es-AR display
 * string with thousands separators and two decimals (e.g. "1.234,50").
 * Used to (re)initialize a money input's display from an external value.
 */
export function formatMoneyDisplay(canonical: string, allowNegative = false): string {
  if (!canonical) return ''
  const negative = allowNegative && canonical.startsWith('-')
  const body = negative ? canonical.slice(1) : canonical
  const [intPart = '0', decPart = '00'] = body.split('.')
  const cleanInt = intPart.replace(/^0+(?=\d)/, '') || '0'
  const grouped = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dec = decPart.padEnd(2, '0').slice(0, 2)
  return `${negative ? '-' : ''}${grouped},${dec}`
}

/**
 * Reformats a money input's raw (in-progress) value on every keystroke:
 * strips decoration, regroups thousands with '.', keeps ',' as the single
 * decimal separator, and relocates the caret by counting significant
 * (digit/comma) characters rather than raw string length — so grouping
 * separators appearing/disappearing don't jump the caret to the end.
 */
export function maskMoneyInput(
  rawValue: string,
  cursorIndex: number,
  allowNegative = false,
): { display: string; cursor: number; canonical: string } {
  if (rawValue.trim() === '') {
    return { display: '', cursor: 0, canonical: '0.00' }
  }

  const negative = allowNegative && rawValue.includes('-')

  let significantBeforeCursor = 0
  for (let i = 0; i < cursorIndex && i < rawValue.length; i += 1) {
    if (isSignificantChar(rawValue[i])) significantBeforeCursor += 1
  }

  let seenComma = false
  let intDigits = ''
  let decDigits = ''
  for (const char of rawValue) {
    if (char === ',' && !seenComma) {
      seenComma = true
      continue
    }
    if (char >= '0' && char <= '9') {
      if (seenComma) {
        if (decDigits.length < 2) decDigits += char
      } else {
        intDigits += char
      }
    }
  }
  intDigits = intDigits.replace(/^0+(?=\d)/, '')

  const groupedInt = intDigits === '' ? '0' : intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = negative ? '-' : ''
  const display = `${sign}${groupedInt}${seenComma ? `,${decDigits}` : ''}`

  let cursor = display.length
  if (significantBeforeCursor === 0) {
    cursor = sign.length
  } else {
    let count = 0
    for (let i = 0; i < display.length; i += 1) {
      if (isSignificantChar(display[i])) count += 1
      if (count >= significantBeforeCursor) {
        cursor = i + 1
        break
      }
    }
  }

  const canonicalInt = intDigits === '' ? '0' : intDigits
  const canonicalDec = decDigits.padEnd(2, '0').slice(0, 2)
  const canonical = `${sign}${canonicalInt}.${canonicalDec}`

  return { display, cursor, canonical }
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}
