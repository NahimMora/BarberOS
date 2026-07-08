'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/restablecer-contrasena`,
    })

    setLoading(false)
    if (resetError) {
      setError('No pudimos procesar la solicitud. Probá de nuevo en unos minutos.')
      return
    }
    setSent(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
      <Card className="w-full max-w-md shadow-xl shadow-foreground/5">
        <CardHeader className="gap-3 p-6 sm:p-8">
          <BrandMark className="mb-4" />
          {sent ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary/70">Revisá tu correo</p>
              <CardTitle className="mt-2 font-heading text-3xl">Te enviamos las instrucciones.</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Si el email ingresado está registrado, vas a recibir un correo con un enlace para elegir una contraseña nueva.
              </CardDescription>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary/70">Acceso seguro</p>
              <CardTitle className="mt-2 font-heading text-3xl">¿Olvidaste tu contraseña?</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Ingresá tu email y te mandamos un enlace para elegir una contraseña nueva.
              </CardDescription>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <MailCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p>El enlace vence en poco tiempo. Si no te llega, revisá spam o volvé a intentarlo.</p>
              </div>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Volver a ingresar
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
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
                {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </Button>
                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Volver a ingresar
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
