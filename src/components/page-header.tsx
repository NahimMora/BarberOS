import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-3xl flex-col gap-1.5">
        <span className="stripe-accent h-1.5 w-12 rounded-full" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide text-primary/75">{eyebrow}</p>
        <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight text-balance sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
