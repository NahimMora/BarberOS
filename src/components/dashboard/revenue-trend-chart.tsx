import { formatArs } from '@/lib/money/display'

type TrendPoint = { date: string; revenue: string }

const WIDTH = 320
const HEIGHT = 120
const PADDING_X = 4
const PADDING_TOP = 14
const PADDING_BOTTOM = 8

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
        Todavía no hay suficientes ventas para mostrar una tendencia.
      </p>
    )
  }

  const values = data.map((point) => Number(point.revenue))
  const maxValue = Math.max(...values, 1)
  const plotWidth = WIDTH - PADDING_X * 2
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM

  const points = data.map((point, index) => {
    const x = PADDING_X + (index / (data.length - 1)) * plotWidth
    const y = PADDING_TOP + plotHeight - (Number(point.revenue) / maxValue) * plotHeight
    return { x, y, point }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${PADDING_TOP + plotHeight} `
    + `L${points[0].x.toFixed(1)},${PADDING_TOP + plotHeight} Z`

  const gridLines = [0.25, 0.5, 0.75].map((fraction) => PADDING_TOP + plotHeight * fraction)
  const last = points[points.length - 1]
  const first = data[0].date
  const lastDate = data[data.length - 1].date

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Facturación diaria de los últimos 30 días, terminando en ${formatArs(data[data.length - 1].revenue)} el ${lastDate}`}
      >
        {gridLines.map((y) => (
          <line key={y} x1={PADDING_X} x2={WIDTH - PADDING_X} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
        ))}
        <path d={areaPath} className="fill-primary/10" stroke="none" />
        <path d={linePath} className="stroke-primary" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r={4} className="fill-primary stroke-card" strokeWidth={2} />
        {points.map(({ x, y, point }) => (
          <circle key={point.date} cx={x} cy={y} r={7} fill="transparent">
            <title>{`${point.date}: ${formatArs(point.revenue)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{first}</span>
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {formatArs(data[data.length - 1].revenue)}
        </span>
      </div>
    </div>
  )
}
