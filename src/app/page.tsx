'use client'

import {
  Users,
  Wallet,
  TrendingUp,
  Receipt,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
import { calcularNomina, getMesesServicio } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'

function useDashboardData() {
  const nominas = EMPLEADOS_ACTIVOS.map(e => calcularNomina(e))

  const totalBruto        = nominas.reduce((s, n) => s + n.totalBruto, 0)
  const totalNeto         = nominas.reduce((s, n) => s + n.salarioNeto, 0)
  const totalISR          = nominas.reduce((s, n) => s + n.isrMensual, 0)
  const totalTSSEmpleador = nominas.reduce((s, n) => s + n.totalAportesEmpleador, 0)
  const totalRegalia      = nominas.reduce((s, n) => s + n.regaliaPascual, 0)

  const alertas = [
    ...EMPLEADOS_ACTIVOS
      .filter(e => e.tipoContrato === 'tiempo_determinado')
      .map(e => ({
        tipo: 'warning' as const,
        mensaje: `${fullName(e)} — contrato a término determinado`,
        sub: `Cargo: ${e.cargo}`,
      })),
    totalISR > 0
      ? { tipo: 'info' as const, mensaje: `ISR a retener este mes: ${formatRD(totalISR)}`, sub: 'Vencimiento: día 10 del próximo mes' }
      : null,
    {
      tipo: 'info' as const,
      mensaje: `TSS empleador por pagar: ${formatRD(totalTSSEmpleador)}`,
      sub: 'Vencimiento: día 10 del próximo mes',
    },
  ].filter(Boolean) as { tipo: 'warning' | 'info'; mensaje: string; sub: string }[]

  return { nominas, totalBruto, totalNeto, totalISR, totalTSSEmpleador, totalRegalia, alertas }
}

const hoy = new Date()
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function DashboardPage() {
  const { totalBruto, totalNeto, totalISR, totalTSSEmpleador, totalRegalia, alertas } =
    useDashboardData()

  const periodo = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Dashboard"
        subtitle={`Período: ${periodo}`}
        actions={
          <Link
            href="/nomina"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Procesar Nómina
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Empleados Activos"
            value={String(EMPLEADOS_ACTIVOS.length)}
            sub="Personal en planilla"
            icon={Users}
            iconColor="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Nómina Bruta"
            value={formatRD(totalBruto, 0)}
            sub="Total devengado este mes"
            icon={Wallet}
            iconColor="bg-emerald-50 text-emerald-600"
            trend="up"
            trendLabel={`Neto ${formatRD(totalNeto, 0)}`}
          />
          <StatCard
            label="TSS Empleador"
            value={formatRD(totalTSSEmpleador, 0)}
            sub="AFP + SFS + SRL empresa"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="ISR a Retener"
            value={formatRD(totalISR, 0)}
            sub="Retención mensual empleados"
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Resumen costos */}
          <div className="col-span-2 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">Resumen de Costos — {periodo}</h2>
              <Link href="/reportes" className="text-xs font-medium text-indigo-600 hover:underline">
                Ver reportes
              </Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {[
                { label: 'Salarios Brutos',              value: totalBruto,        color: 'text-zinc-900' },
                { label: 'AFP Empleador (7.10%)',         value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0710, 0), color: 'text-zinc-700' },
                { label: 'SFS Empleador (7.09%)',         value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0709, 0), color: 'text-zinc-700' },
                { label: 'SRL Empleador',                 value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0110, 0), color: 'text-zinc-700' },
                { label: 'Provisión Regalía Pascual',     value: totalRegalia,      color: 'text-amber-700' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-zinc-600">{row.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${row.color}`}>{formatRD(row.value, 0)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-zinc-50 px-5 py-3 rounded-b-xl">
                <span className="text-sm font-semibold text-zinc-900">Costo Total Empresa</span>
                <span className="text-sm font-bold text-indigo-700 tabular-nums">
                  {formatRD(totalBruto + totalTSSEmpleador, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">Alertas y Avisos</h2>
            </div>
            <div className="divide-y divide-zinc-50">
              {alertas.map((a, i) => (
                <div key={i} className="flex gap-3 px-4 py-3">
                  {a.tipo === 'warning'
                    ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                  }
                  <div>
                    <p className="text-xs font-medium text-zinc-800 leading-snug">{a.mensaje}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{a.sub}</p>
                  </div>
                </div>
              ))}
              {alertas.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-zinc-400">Sin alertas pendientes</p>
              )}
            </div>
          </div>
        </div>

        {/* Empleados recientes */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900">Empleados Activos</h2>
            <Link href="/empleados" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cargo</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingreso</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Salario</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {EMPLEADOS_ACTIVOS.slice(0, 5).map(emp => (
                  <tr key={emp.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {emp.nombre[0]}{emp.apellido[0]}
                        </div>
                        <span className="font-medium text-zinc-900">{fullName(emp)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{emp.cargo}</td>
                    <td className="px-5 py-3 text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDate(emp.fechaIngreso)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-900">
                      {formatRD(emp.salarioBase, 0)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="success">Activo</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer legal */}
        <p className="text-center text-[11px] text-zinc-400">
          Cálculos conforme a Ley 16-92 (Código de Trabajo), Ley 87-01 (TSS), Ley 11-92 (ISR) y normativas DGII / CNSS vigentes · República Dominicana
        </p>
      </div>
    </div>
  )
}
