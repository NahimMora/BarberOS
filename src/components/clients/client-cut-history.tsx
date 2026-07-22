'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

type CutPhoto = {
  id: string
  caption: string | null
  createdAt: string
  branchName: string
  imageUrl: string
}

export function ClientCutHistory({ clientId, refreshKey }: { clientId: string; refreshKey?: number }) {
  const [photos, setPhotos] = useState<CutPhoto[] | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotos(null)
    fetch(`/api/clients/${clientId}/photos`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el historial de cortes')
        return res.json() as Promise<CutPhoto[]>
      })
      .then((data) => { if (!cancelled) setPhotos(data) })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error'))
    return () => { cancelled = true }
  }, [clientId, refreshKey])

  if (photos === null) {
    return (
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square rounded-lg" />
        <Skeleton className="aspect-square rounded-lg" />
        <Skeleton className="aspect-square rounded-lg" />
      </div>
    )
  }

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay fotos de cortes.</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border/70">
          <Image
            src={photo.imageUrl}
            alt={photo.caption ?? 'Foto de corte'}
            fill
            sizes="120px"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate">{photo.branchName}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
