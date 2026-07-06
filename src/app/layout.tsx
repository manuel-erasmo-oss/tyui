import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/theme'
import { EmpleadosProvider } from '@/lib/empleados-context'
import { PeriodosProvider } from '@/lib/periodos-context'
import { EmpresaProvider } from '@/lib/empresa-context'
import { PrestamosProvider } from '@/lib/prestamos-context'
import { AumentosProvider } from '@/lib/aumentos-context'
import { LicenciasProvider } from '@/lib/licencias-context'
import { BandasSalarialesProvider } from '@/lib/bandas-salariales-context'
import { LiquidacionesProvider } from '@/lib/liquidaciones-context'
import { SaldoISRProvider } from '@/lib/saldo-isr-context'
import { ChecklistAnualProvider } from '@/lib/inicio-de-ano-context'
import { AuthProvider } from '@/lib/auth-context'
import { RouteGuard } from '@/components/auth/RouteGuard'

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
          <AuthProvider>
            <EmpresaProvider>
              <EmpleadosProvider>
                <BandasSalarialesProvider>
                  <PrestamosProvider>
                    <AumentosProvider>
                      <LicenciasProvider>
                        <LiquidacionesProvider>
                          <SaldoISRProvider>
                            <PeriodosProvider>
                              <ChecklistAnualProvider>
                                <RouteGuard>{children}</RouteGuard>
                              </ChecklistAnualProvider>
                            </PeriodosProvider>
                          </SaldoISRProvider>
                        </LiquidacionesProvider>
                      </LicenciasProvider>
                    </AumentosProvider>
                  </PrestamosProvider>
                </BandasSalarialesProvider>
              </EmpleadosProvider>
            </EmpresaProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
