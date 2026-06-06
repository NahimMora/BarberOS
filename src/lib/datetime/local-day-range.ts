const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

type DateParts = {
  year: number
  month: number
  day: number
}

export function getLocalDayUtcRange(date: string, timeZone: string) {
  const startParts = parseDate(date)
  const endParts = addDays(startParts, 1)

  return {
    start: localMidnightToUtc(startParts, timeZone),
    end: localMidnightToUtc(endParts, timeZone),
  }
}

export function getLocalMonthUtcRange(month: string, timeZone: string) {
  const match = MONTH_PATTERN.exec(month)
  if (!match) {
    throw new RangeError('Invalid calendar month')
  }

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError('Invalid calendar month')
  }

  const startParts = { year, month: monthNumber, day: 1 }
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1))
  const endParts = {
    year: nextMonth.getUTCFullYear(),
    month: nextMonth.getUTCMonth() + 1,
    day: 1,
  }

  return {
    start: localMidnightToUtc(startParts, timeZone),
    end: localMidnightToUtc(endParts, timeZone),
  }
}

export function getLocalCalendarDate(date: Date, timeZone: string): string {
  return formatCalendarParts(date, timeZone, ['year', 'month', 'day']).join('-')
}

export function getLocalCalendarMonth(date: Date, timeZone: string): string {
  return formatCalendarParts(date, timeZone, ['year', 'month']).join('-')
}

function parseDate(value: string): DateParts {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    throw new RangeError('Invalid calendar date')
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  const parsed = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))

  if (
    parsed.getUTCFullYear() !== parts.year ||
    parsed.getUTCMonth() !== parts.month - 1 ||
    parsed.getUTCDate() !== parts.day
  ) {
    throw new RangeError('Invalid calendar date')
  }

  return parts
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function localMidnightToUtc(parts: DateParts, timeZone: string): Date {
  const localTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day)
  let utcTimestamp = localTimestamp

  // A second pass handles zones whose offset differs around the target instant.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    utcTimestamp = localTimestamp - getTimeZoneOffsetMs(new Date(utcTimestamp), timeZone)
  }

  return new Date(utcTimestamp)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  )

  return representedAsUtc - Math.trunc(date.getTime() / 1000) * 1000
}

function formatCalendarParts(
  date: Date,
  timeZone: string,
  partTypes: Array<'year' | 'month' | 'day'>,
): string[] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return partTypes.map((type) => {
    const part = parts.find((candidate) => candidate.type === type)
    if (!part) throw new RangeError(`Missing ${type} calendar part`)
    return part.value
  })
}
