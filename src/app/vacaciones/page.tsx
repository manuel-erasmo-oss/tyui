'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import {
  getAnosServicio,
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
    const mesesServicio   = Math.min(Math.floor(anos * 12), 12)
    const diasAcumulados  = (diasAnuales / 12) * mesesServicio
    const valorDiario     = e.salarioBase / 26
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
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Días Acumulados"
            value={`${totalDias.toFixed(1)} días`}
            sub="Total planilla activa"
            icon={CalendarDays}
            iconColor="bg-sky-50 text-sky-600"
          />
          <StatCard
            label="Valor Provisión"
            value={formatRD(totalValor, 0)}
            sub="Días acumulados × tarifa diaria"
            icon={Clock}
            iconColor="bg-[#eef0fb] text-[#1B2980]"
          />
          <StatCard
            label="Empleados con Derecho"
            value={`${empleadosAptos} / ${filas.length}`}
            sub="Completaron 1 año de servicio"
            icon={Users}
            iconColor="bg-emerald-50 text-emerald-600"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900">Vacaciones por Empleado</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              14 días laborables (1–5 años) · 18 días laborables (más de 5 años). Tarifa diaria = salario ÷ 26.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Antigüedad</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">Días/Año</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Tarifa Diaria</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Días Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Valor Acum.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filas.map(({ empleado, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, puedeGozar }) => (
                  <tr key={empleado.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500">Ingresó: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        diasAnuales === DIAS_VACACIONES_MAS_5_ANOS
                          ? 'bg-[#eef0fb] text-[#151f66]'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {diasAnuales} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600">
                      {formatRD(valorDiario, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700">
                      {diasAcumulados.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700">
                      {formatRD(valorAcumulado, 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      {puedeGozar
                        ? <Badge variant="success">Puede gozar</Badge>
                        : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600">En acumulación</span>
                          </div>
                        )
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-950 text-white">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-300">{totalDias.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-300">{formatRD(totalValor, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-xs text-sky-800">
          <p className="font-semibold mb-1">Art. 177–179, Código de Trabajo — República Dominicana</p>
          <p>Después de un trabajo continuo no menor de un año, el trabajador tendrá derecho a <strong>un período de vacaciones remuneradas de catorce (14) días laborables</strong>. Después de cinco años de servicio ininterrumpido, el trabajador tendrá derecho a <strong>dieciocho (18) días laborables</strong> de vacaciones. Las vacaciones no pueden ser sustituidas por una compensación en dinero, excepto cuando el contrato termina sin que hayan sido disfrutadas.</p>
        </div>
      </div>
    </div>
  )
}
