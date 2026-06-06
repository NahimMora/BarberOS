import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="brand-mark-grid flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Scissors className="size-5" aria-hidden="true" />
      </div>
      {compact ? null : (
        <div className="flex flex-col leading-none">
          <span className="font-heading text-xl font-semibold tracking-tight">BarberOS</span>
          <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Taller operativo
          </span>
        </div>
      )}
    </div>
  )
}
