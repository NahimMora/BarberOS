import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-label="Cargando tablero">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-border/70">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-h-40 border-border/70 p-6 sm:border-r">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-10 h-9 w-36" />
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
