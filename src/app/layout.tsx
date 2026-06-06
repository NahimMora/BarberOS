import type { Metadata } from 'next'
import { Geist_Mono, Manrope, Newsreader } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BarberOS',
  description: 'Plataforma operativa para barberías',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
