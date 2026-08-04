type WeekdayPoint = { weekday: number; average: number }

// Postgres dow: 0=domingo..6=sábado. Mostramos lunes primero (semana comercial).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const LABELS: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
}

const BAR_WIDTH = 24
const GAP = 10
const HEIGHT = 100
const PADDING_TOP = 10
const PADDING_BOTTOM = 18

export function WeekdayOccupancyChart({ data }: { data: WeekdayPoint[] }) {
  const byWeekday = new Map(data.map((point) => [point.weekday, point.average]))
  const values = DISPLAY_ORDER.map((weekday) => byWeekday.get(weekday) ?? 0)
  const maxValue = Math.max(...values, 1)
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const width = DISPLAY_ORDER.length * BAR_WIDTH + (DISPLAY_ORDER.length - 1) * GAP

  const peakIndex = values.indexOf(Math.max(...values))

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={`Turnos promedio por día de la semana, pico el ${LABELS[DISPLAY_ORDER[peakIndex]]}`}
    >
      {DISPLAY_ORDER.map((weekday, index) => {
        const value = values[index]
        const barHeight = maxValue > 0 ? (value / maxValue) * plotHeight : 0
        const x = index * (BAR_WIDTH + GAP)
        const y = PADDING_TOP + plotHeight - barHeight
        const isPeak = index === peakIndex && value > 0
        return (
          <g key={weekday}>
            <rect
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={Math.max(barHeight, 2)}
              rx={4}
              className={isPeak ? 'fill-primary' : 'fill-secondary'}
            >
              <title>{`${LABELS[weekday]}: ${value.toFixed(1)} turnos promedio`}</title>
            </rect>
            <text
              x={x + BAR_WIDTH / 2}
              y={HEIGHT - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {LABELS[weekday]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
