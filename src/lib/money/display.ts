export function formatArs(value: string | null | undefined) {
  const normalized = value ?? '0.00'
  const negative = normalized.startsWith('-')
  const absolute = negative ? normalized.slice(1) : normalized
  const [integer = '0', decimal = '00'] = absolute.split('.')
  const grouped = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
    .format(BigInt(integer || '0'))
  return `${negative ? '-' : ''}$ ${grouped},${decimal.padEnd(2, '0')}`
}
