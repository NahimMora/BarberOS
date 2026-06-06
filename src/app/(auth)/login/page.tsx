'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarCheck2, CircleDollarSign, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const capabilities = [
  { icon: CalendarCheck2, label: 'Agenda sin superposiciones' },
  { icon: CircleDollarSign, label: 'Caja y cobros trazables' },
  { icon: ShieldCheck, label: 'Acceso por rol y sucursal' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales incorrectas. Verificá tu email y contraseña.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_15%_20%,var(--sidebar-primary)_0,transparent_25rem),linear-gradient(135deg,transparent_48%,var(--sidebar-border)_49%,transparent_50%)]" />
        <BrandMark className="relative [&_[class*=text-muted]]:text-sidebar-foreground/50" />
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-sidebar-primary">
            Gestión diaria de barbería
          </p>
          <h1 className="font-heading text-6xl font-semibold leading-[0.95] tracking-tight text-balance xl:text-7xl">
            Menos fricción.
            <br />
            Más control.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-sidebar-foreground/65">
            Una herramienta operativa para que agenda, cobros, caja y comisiones
            compartan la misma fuente de verdad.
          </p>
        </div>
        <div className="relative grid gap-3 xl:grid-cols-3">
          {capabilities.map((capability) => (
            <div key={capability.label} className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
              <capability.icon className="size-4 shrink-0 text-sidebar-primary" aria-hidden="true" />
              <span className="text-xs font-semibold leading-4">{capability.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <Card className="paper-surface w-full max-w-md shadow-xl shadow-foreground/5">
          <CardHeader className="gap-3 p-6 sm:p-8">
            <BrandMark className="mb-4 lg:hidden" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Acceso seguro</p>
              <CardTitle className="mt-2 font-heading text-4xl">Volvé al taller.</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Ingresá con tu cuenta para continuar con la operación.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@barberia.com"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                  {loading ? null : <ArrowRight data-icon="inline-end" />}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
