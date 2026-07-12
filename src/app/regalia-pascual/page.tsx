'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { useEmpleados } from '@/lib/empleados-context'
import { getMesesServicio } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'
import { Gift, Calendar, AlertTriangle } from 'lucide-react'

const hoy = new Date()
const mesActual = hoy.getMonth() + 1  // 1-based

export default function RegaliaPage() {
  const { empleadosEnNomina } = useEmpleados()
  const filas = empleadosEnNomina.map(e => {
    const mesesServicio      = Math.min(getMesesServicio(e.fechaIngreso), mesActual)
    // Math.max(0, …): protege contra fechaIngreso en el futuro (error de
    // captura), que de otro modo produciría meses/porcentaje negativos.
    const mesesAcumulados    = Math.max(0, Math.min(mesesServicio, 12))
    // Neto de lo ya pagado antes de la migración a Cielo Cloud (empleados con historial previo)
    const acumuladoBruto     = (e.salarioBase / 12) * mesesAcumulados
    const acumulado          = Math.max(0, acumuladoBruto - (e.regaliaPagadaEsteAnio ?? 0))
    const proyeccionAnual    = e.salarioBase  // 1 salario completo
    const porcentaje         = (mesesAcumulados / 12) * 100
    return { empleado: e, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }
  })

  const totalAcumulado   = filas.reduce((s, f) => s + f.acumulado, 0)
  const totalProyectado  = filas.reduce((s, f) => s + f.proyeccionAnual, 0)
  const diasParaDic20    = Math.max(0, Math.ceil(
    (new Date(hoy.getFullYear(), 11, 20).getTime() - hoy.getTime()) / (1000 * 3600 * 24)
  ))

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Regalía Pascual"
        subtitle="Art. 219 · Código de Trabajo · Ley 16-92"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Acumulado al Mes Actual"
            value={formatRD(totalAcumulado)}
            sub={`${mesActual}/12 meses del año`}
            icon={Gift}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Proyección Anual Total"
            value={formatRD(totalProyectado)}
            sub="Si todos completan el año"
            icon={Calendar}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Días para Vencimiento"
            value={`${diasParaDic20} días`}
            sub="Fecha límite: 20 de diciembre"
            icon={AlertTriangle}
            iconColor={diasParaDic20 < 30 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}
            trend={diasParaDic20 < 30 ? 'down' : 'neutral'}
            trendLabel={diasParaDic20 < 30 ? 'Urgente' : 'En tiempo'}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Provisión por Empleado — Año {hoy.getFullYear()}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cálculo: Salario mensual ÷ 12 × meses laborados en el año. Pago obligatorio entre el 1 y 20 de diciembre.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Mensual</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Meses Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Acumulado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Proyección Anual</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12V22H4V12" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 7H2v5h20V7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados activos</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Registra empleados para calcular la provisión de regalía pascual del año.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.map(({ empleado, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingreso: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(empleado.salarioBase)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-400">
                        {mesesAcumulados}/12
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatRD(acumulado)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(proyeccionAnual)}
                    </td>
                    <td className="px-4 py-3.5 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-8 text-right">
                          {Math.round(porcentaje)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-400">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-300">{formatRD(totalAcumulado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-zinc-700 dark:text-zinc-300">{formatRD(totalProyectado)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Art. 219, Código de Trabajo — República Dominicana</p>
          <p>Todo empleador tiene la obligación de pagar a cada uno de sus trabajadores, en el período navideño, <strong>una regalía pascual equivalente a un salario ordinario del mes de diciembre</strong>. Dicha regalía deberá pagarse en la primera quincena del mes de diciembre. El trabajador que al 30 de noviembre no haya completado el año de servicio recibirá la parte proporcional correspondiente.</p>
        </div>
      </div>
    </div>
  )
}
