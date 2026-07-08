'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8

export default function RestablecerContrasenaPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      setHasSession(Boolean(data.session))
      setCheckingSession(false)
    }
    void checkSession()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No pudimos actualizar tu contraseña. Probá de nuevo.')
      return
    }
    setSuccess(true)
    window.setTimeout(() => window.location.assign('/dashboard'), 1200)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
      <Card className="w-full max-w-md shadow-xl shadow-foreground/5">
        <CardHeader className="gap-3 p-6 sm:p-8">
          <BrandMark className="mb-4" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Acceso seguro</p>
            <CardTitle className="mt-2 font-heading text-3xl">Elegí una contraseña nueva.</CardTitle>
            <CardDescription className="mt-2 leading-6">
              Usá al menos {MIN_PASSWORD_LENGTH} caracteres. Vas a poder ingresar apenas la confirmes.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          {checkingSession ? (
            <p className="text-sm text-muted-foreground">Verificando enlace...</p>
          ) : !hasSession ? (
            <div className="flex flex-col gap-4">
              <p role="alert" className="text-sm font-medium text-destructive">
                Este enlace no es válido o ya venció.
              </p>
              <Link href="/recuperar-contrasena" className="text-sm font-semibold text-primary hover:underline">
                Pedir un enlace nuevo
              </Link>
            </div>
          ) : success ? (
            <p className="text-sm font-medium text-success">Contraseña actualizada. Entrando...</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirmar contraseña</FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </Field>
                {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar contraseña'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
