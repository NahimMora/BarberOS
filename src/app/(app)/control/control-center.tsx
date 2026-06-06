'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Braces,
  FileClock,
  LoaderCircle,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type EventKind = 'audit' | 'domain' | 'system'
type EventLevel = 'info' | 'warn' | 'error'

type ControlEvent = {
  kind: EventKind
  id: string
  title: string
  subtitle: string
  actor: string | null
  level: EventLevel | null
  data: unknown
  occurredAt: string
}

type EventsResponse = {
  items: ControlEvent[]
  page: number
  hasMore: boolean
}

const tabs = [
  { value: 'audit' as const, label: 'Auditoría', icon: ShieldCheck },
  { value: 'domain' as const, label: 'Negocio', icon: Activity },
  { value: 'system' as const, label: 'Sistema', icon: Braces },
]

export function ControlCenter() {
  const [kind, setKind] = useState<EventKind>('audit')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<EventLevel | ''>('')
  const [events, setEvents] = useState<ControlEvent[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadEvents = useCallback(async (requestedPage: number, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams({
        kind,
        q: query,
        page: String(requestedPage),
      })
      if (kind === 'system' && level) params.set('level', level)

      const response = await fetch(`/api/control-events?${params}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudieron cargar los eventos')
      }

      const result = body as EventsResponse
      setEvents((current) => append ? [...current, ...result.items] : result.items)
      setPage(result.page)
      setHasMore(result.hasMore)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los eventos')
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [kind, level, query])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(1), 0)
    return () => window.clearTimeout(timer)
  }, [loadEvents])

  function changeKind(nextKind: EventKind) {
    setKind(nextKind)
    setEvents([])
    setPage(1)
    setLevel('')
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setQuery(draftQuery.trim())
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Control"
        title="Trazabilidad"
        description="Cambios sensibles, hechos de negocio y señales técnicas en un registro consultable."
      />

      <Card className="paper-surface">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Registro operativo</CardTitle>
          <CardDescription>
            La auditoría identifica quién cambió qué; los eventos explican qué ocurrió.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
            role="tablist"
            aria-label="Tipo de registro"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={kind === tab.value}
                onClick={() => changeKind(tab.value)}
                className={cn(
                  'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  kind === tab.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Buscar acción, entidad, mensaje o dato..."
                className="h-10 bg-card pl-9"
                maxLength={100}
              />
            </div>
            {kind === 'system' ? (
              <select
                aria-label="Nivel técnico"
                value={level}
                onChange={(event) => setLevel(event.target.value as EventLevel | '')}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Todos los niveles</option>
                <option value="info">Información</option>
                <option value="warn">Advertencia</option>
                <option value="error">Error</option>
              </select>
            ) : null}
            <Button type="submit" size="lg">
              <Search data-icon="inline-start" />
              Buscar
            </Button>
          </form>

          {loading ? (
            <div className="flex flex-col gap-3" aria-label="Cargando eventos">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <Empty className="min-h-64 border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileClock /></EmptyMedia>
                <EmptyTitle>No hay registros para mostrar</EmptyTitle>
                <EmptyDescription>
                  Probá otro tipo de evento o limpiá el término de búsqueda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => <EventRecord key={event.id} event={event} />)}
              {hasMore ? (
                <Button
                  variant="outline"
                  size="lg"
                  disabled={loadingMore}
                  onClick={() => void loadEvents(page + 1, true)}
                  className="self-center"
                >
                  {loadingMore ? <LoaderCircle className="animate-spin" /> : null}
                  {loadingMore ? 'Cargando...' : 'Cargar más'}
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EventRecord({ event }: { event: ControlEvent }) {
  const icon = event.kind === 'audit'
    ? ShieldCheck
    : event.kind === 'domain'
      ? Activity
      : event.level === 'error'
        ? AlertTriangle
        : Braces
  const Icon = icon

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{event.title}</h3>
              <p className="mt-1 break-all text-xs text-muted-foreground">{event.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {event.level ? <LevelBadge level={event.level} /> : null}
              <time className="font-mono text-xs text-muted-foreground tabular-nums">
                {formatEventDate(event.occurredAt)}
              </time>
            </div>
          </div>
          {event.actor ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Actor: <span className="font-semibold text-foreground">{event.actor}</span>
            </p>
          ) : null}
          {event.data ? (
            <details className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold">Ver datos</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.7rem] leading-5 text-muted-foreground">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function LevelBadge({ level }: { level: EventLevel }) {
  const label = level === 'info' ? 'Info' : level === 'warn' ? 'Advertencia' : 'Error'
  return (
    <Badge variant={level === 'error' ? 'destructive' : level === 'warn' ? 'secondary' : 'outline'}>
      {label}
    </Badge>
  )
}

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
