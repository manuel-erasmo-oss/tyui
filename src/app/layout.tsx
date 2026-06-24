import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ThemeProvider } from '@/lib/theme'
import { EmpleadosProvider } from '@/lib/empleados-context'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Cielo Cloud — Gestión de Nómina',
  description:
    'Sistema de nómina para pymes dominicanas. Cálculo automático de TSS, ISR, regalía pascual y vacaciones según legislación dominicana.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply saved theme class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('cielo-theme');
            var p = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (t === 'dark' || (!t && p)) document.documentElement.classList.add('dark');
          } catch(e) {}
        `}} />
      </head>
      <body className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#0d0f1a] font-sans transition-colors duration-200">
        <ThemeProvider>
          <EmpleadosProvider>
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">{children}</main>
            <BottomNav />
          </EmpleadosProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
