// Aritmética pura de las proyecciones de Inicio — sin DB, para poder
// testearla directo. Son proyecciones estadísticas simples (promedio /
// run-rate), no predicciones con IA (fuera de alcance en v1, ver
// docs/ROADMAP.md).

/**
 * Proyecta la facturación del mes completo asumiendo que el ritmo diario
 * observado hasta ahora se mantiene el resto del mes (run-rate simple).
 */
export function computeMonthRunRate(
  revenueSoFar: string,
  daysElapsed: number,
  daysInMonth: number,
): string {
  if (daysElapsed <= 0 || daysInMonth <= 0) return '0.00'
  const amount = Number(revenueSoFar)
  if (!Number.isFinite(amount)) return '0.00'
  const projected = (amount / daysElapsed) * daysInMonth
  return projected.toFixed(2)
}

/**
 * % de variación entre dos períodos (ej. facturación acumulada del mes vs
 * el mismo punto del mes anterior). `null` cuando el período anterior es
 * cero — la variación no está definida.
 */
export function computeVariancePercent(current: string, previous: string): number | null {
  const prev = Number(previous)
  if (!Number.isFinite(prev) || prev === 0) return null
  const curr = Number(current)
  if (!Number.isFinite(curr)) return null
  return ((curr - prev) / prev) * 100
}
