import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NominaRD — Gestión de Nómina',
  description:
    'Sistema de nómina para pymes dominicanas. Cálculo automático de TSS, ISR, regalía pascual y vacaciones según legislación dominicana.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="flex h-screen overflow-hidden bg-zinc-50 font-sans">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  )
}
