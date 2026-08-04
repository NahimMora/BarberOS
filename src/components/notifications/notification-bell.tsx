'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'

type PermissionState = 'unsupported' | 'default' | 'denied' | 'granted-off' | 'granted-on'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function NotificationBell() {
  const [state, setState] = useState<PermissionState>('default')
  const [loading, setLoading] = useState(false)

  async function refreshState() {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    if (Notification.permission !== 'granted') {
      setState('default')
      return
    }
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    setState(subscription ? 'granted-on' : 'granted-off')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState()
  }, [])

  async function enable() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      toast.error('Notificaciones no configuradas en este entorno')
      return
    }
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })

      const json = subscription.toJSON()
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('subscribe failed')

      setState('granted-on')
      toast.success('Notificaciones activadas')
    } catch {
      toast.error('No se pudo activar las notificaciones')
    } finally {
      setLoading(false)
    }
  }

  async function disable() {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState('granted-off')
      toast.success('Notificaciones desactivadas')
    } catch {
      toast.error('No se pudo desactivar las notificaciones')
    } finally {
      setLoading(false)
    }
  }

  if (state === 'unsupported') return null

  const Icon = state === 'granted-on' ? BellRing : state === 'denied' ? BellOff : Bell

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notificaciones"
            className={state === 'granted-on' ? 'text-primary' : 'text-muted-foreground'}
          />
        }
      >
        <Icon />
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="text-xs font-bold uppercase tracking-wide text-primary/75">Notificaciones</p>
        <p className="mt-1 font-heading text-base font-bold">
          {state === 'granted-on' ? 'Activadas en este dispositivo' : 'Avisos de turnos'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {state === 'denied'
            ? 'Bloqueaste los permisos de notificación en el navegador. Habilitalos desde la configuración del sitio para recibir avisos.'
            : 'Nuevo turno, cancelaciones y recordatorio 30 minutos antes, directo en este navegador.'}
        </p>
        {state !== 'denied' ? (
          <Button
            className="mt-3 w-full"
            size="sm"
            variant={state === 'granted-on' ? 'outline' : 'default'}
            disabled={loading}
            onClick={state === 'granted-on' ? disable : enable}
          >
            {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {state === 'granted-on' ? 'Desactivar' : 'Activar notificaciones'}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
