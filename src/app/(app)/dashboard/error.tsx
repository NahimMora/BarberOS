'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Empty className="min-h-[60vh] border border-border/70 bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><RotateCcw /></EmptyMedia>
        <EmptyTitle>No pudimos cargar el tablero</EmptyTitle>
        <EmptyDescription>
          La operación no fue modificada. Reintentá para consultar los datos actuales.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Reintentar
        </Button>
      </EmptyContent>
    </Empty>
  )
}
