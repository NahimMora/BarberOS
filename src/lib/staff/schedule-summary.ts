const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const DAY_SHORT: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

export type ScheduleRange = {
  weekday: number
  /** "HH:MM", no seconds. */
  startTime: string
  /** "HH:MM", no seconds. */
  endTime: string
}

function rangeLabel(ranges: ScheduleRange[]) {
  return ranges
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((range) => `${range.startTime}–${range.endTime}`)
    .join(', ')
}

/**
 * Colapsa los rangos horarios de una semana en etiquetas legibles,
 * agrupando días consecutivos (Lun→Dom) que comparten exactamente los
 * mismos rangos, p. ej. ["Lun–Vie 09:00–13:00, 14:00–19:00", "Sáb 10:00–14:00"].
 */
export function summarizeSchedule(ranges: ScheduleRange[]): string[] {
  const byWeekday = new Map<number, ScheduleRange[]>()
  for (const range of ranges) {
    const list = byWeekday.get(range.weekday) ?? []
    list.push(range)
    byWeekday.set(range.weekday, list)
  }

  const labelByWeekday = new Map<number, string>()
  for (const [weekday, dayRanges] of byWeekday) {
    if (dayRanges.length > 0) labelByWeekday.set(weekday, rangeLabel(dayRanges))
  }

  const summary: string[] = []
  let index = 0
  while (index < WEEK_ORDER.length) {
    const weekday = WEEK_ORDER[index]
    const label = labelByWeekday.get(weekday)
    if (!label) {
      index += 1
      continue
    }

    let end = index
    while (end + 1 < WEEK_ORDER.length && labelByWeekday.get(WEEK_ORDER[end + 1]) === label) {
      end += 1
    }

    const startDay = DAY_SHORT[weekday]
    const endDay = DAY_SHORT[WEEK_ORDER[end]]
    const dayPart = end === index ? startDay : `${startDay}–${endDay}`
    summary.push(`${dayPart} ${label}`)
    index = end + 1
  }

  return summary
}

/** Dos rangos del mismo día se solapan si uno empieza antes de que el otro termine. */
export function rangesOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime
}
