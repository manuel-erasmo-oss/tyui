'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
import { calcularNomina, getMesesServicio } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'
import { Gift, Calendar, AlertTriangle } from 'lucide-react'

const hoy = new Date()
const mesActual = hoy.getMonth() + 1  // 1-based

export default function RegaliaPage() {
  const filas = EMPLEADOS_ACTIVOS.map(e => {
    const mesesServicio      = Math.min(getMesesServicio(e.fechaIngreso), mesActual)
    const mesesAcumulados    = Math.min(mesesServicio, 12)
    const acumulado          = (e.salarioBase / 12) * mesesAcumulados
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
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Acumulado al Mes Actual"
            value={formatRD(totalAcumulado, 0)}
            sub={`${mesActual}/12 meses del año`}
            icon={Gift}
            iconColor="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Proyección Anual Total"
            value={formatRD(totalProyectado, 0)}
            sub="Si todos completan el año"
            icon={Calendar}
            iconColor="bg-[#eef0fb] text-[#1B2980]"
          />
          <StatCard
            label="Días para Vencimiento"
            value={`${diasParaDic20} días`}
            sub="Fecha límite: 20 de diciembre"
            icon={AlertTriangle}
            iconColor={diasParaDic20 < 30 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}
            trend={diasParaDic20 < 30 ? 'down' : 'neutral'}
            trendLabel={diasParaDic20 < 30 ? 'Urgente' : 'En tiempo'}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900">Provisión por Empleado — Año {hoy.getFullYear()}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cálculo: Salario mensual ÷ 12 × meses laborados en el año. Pago obligatorio entre el 1 y 20 de diciembre.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Salario Mensual</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">Meses Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Acumulado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Proyección Anual</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filas.map(({ empleado, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }) => (
                  <tr key={empleado.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500">Ingreso: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700">
                      {formatRD(empleado.salarioBase, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                        {mesesAcumulados}/12
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700">
                      {formatRD(acumulado, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700">
                      {formatRD(proyeccionAnual, 0)}
                    </td>
                    <td className="px-4 py-3.5 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-zinc-500 w-8 text-right">
                          {Math.round(porcentaje)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-950 text-white">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-300">{formatRD(totalAcumulado, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{formatRD(totalProyectado, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-800">
          <p className="font-semibold mb-1">Art. 219, Código de Trabajo — República Dominicana</p>
          <p>Todo empleador tiene la obligación de pagar a cada uno de sus trabajadores, en el período navideño, <strong>una regalía pascual equivalente a un salario ordinario del mes de diciembre</strong>. Dicha regalía deberá pagarse en la primera quincena del mes de diciembre. El trabajador que al 30 de noviembre no haya completado el año de servicio recibirá la parte proporcional correspondiente.</p>
        </div>
      </div>
    </div>
  )
}
