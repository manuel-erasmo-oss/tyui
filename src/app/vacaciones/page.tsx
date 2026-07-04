'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import {
  getAnosServicio,
  getDivisorSalarioDiario,
  DIAS_VACACIONES_HASTA_5_ANOS,
  DIAS_VACACIONES_MAS_5_ANOS,
} from '@/lib/dominican-labor'
import { formatRD, formatDate, formatAnosServicio, fullName } from '@/lib/utils'
import { CalendarDays, Users, Clock, AlertCircle } from 'lucide-react'

export default function VacacionesPage() {
  const { empleadosActivos } = useEmpleados()
  const filas = empleadosActivos.map(e => {
    const anos            = getAnosServicio(e.fechaIngreso)
    const diasAnuales     = anos >= 5 ? DIAS_VACACIONES_MAS_5_ANOS : DIAS_VACACIONES_HASTA_5_ANOS
    // Fraccional, sin truncar — prorratea el mes en curso proporcionalmente
    const mesesServicio   = anos < 1 ? anos * 12 : ((anos % 1) * 12 || 12)
    const diasAcumulados  = (diasAnuales / 12) * mesesServicio
    const valorDiario     = e.salarioBase / getDivisorSalarioDiario(e)
    const valorAcumulado  = diasAcumulados * valorDiario
    const puedeGozar      = anos >= 1
    return { empleado: e, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, puedeGozar }
  })

  const totalDias        = filas.reduce((s, f) => s + f.diasAcumulados, 0)
  const totalValor       = filas.reduce((s, f) => s + f.valorAcumulado, 0)
  const empleadosAptos   = filas.filter(f => f.puedeGozar).length

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Vacaciones"
        subtitle="Art. 177 · Código de Trabajo · Ley 16-92"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Días Acumulados"
            value={`${totalDias.toFixed(1)} días`}
            sub="Total planilla activa"
            icon={CalendarDays}
            iconColor="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          />
          <StatCard
            label="Valor Provisión"
            value={formatRD(totalValor, 0)}
            sub="Días acumulados × tarifa diaria"
            icon={Clock}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Empleados con Derecho"
            value={`${empleadosAptos} / ${filas.length}`}
            sub="Completaron 1 año de servicio"
            icon={Users}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vacaciones por Empleado</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              14 días laborables (1–5 años) · 18 días laborables (más de 5 años). Tarifa diaria = salario ÷ 26.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días/Año</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tarifa Diaria</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Acum.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4M10 15h4" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados activos</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Registra empleados en la sección de Empleados para ver sus vacaciones acumuladas.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.map(({ empleado, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, puedeGozar }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-xs font-bold text-sky-700 dark:text-sky-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingresó: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        diasAnuales === DIAS_VACACIONES_MAS_5_ANOS
                          ? 'bg-[#eef0fb] text-[#151f66] dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-[#1a1d2e] dark:text-zinc-400'
                      }`}>
                        {diasAnuales} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatRD(valorDiario, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {diasAcumulados.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {formatRD(valorAcumulado, 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      {puedeGozar
                        ? <Badge variant="success">Puede gozar</Badge>
                        : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">En acumulación</span>
                          </div>
                        )
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-[#252840] bg-zinc-950 dark:bg-[#0a0c14] text-white">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-300">{totalDias.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-300">{formatRD(totalValor, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 px-5 py-4 text-xs text-sky-800 dark:text-sky-300">
          <p className="font-semibold mb-1">Art. 177–179, Código de Trabajo — República Dominicana</p>
          <p>Después de un trabajo continuo no menor de un año, el trabajador tendrá derecho a <strong>un período de vacaciones remuneradas de catorce (14) días laborables</strong>. Después de cinco años de servicio ininterrumpido, el trabajador tendrá derecho a <strong>dieciocho (18) días laborables</strong> de vacaciones. Las vacaciones no pueden ser sustituidas por una compensación en dinero, excepto cuando el contrato termina sin que hayan sido disfrutadas.</p>
        </div>
      </div>
    </div>
  )
}
