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
  Building2,
} from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
import { calcularNomina } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'

function useDashboardData() {
  const nominas = EMPLEADOS_ACTIVOS.map(e => calcularNomina(e))
  const totalBruto        = nominas.reduce((s, n) => s + n.totalBruto, 0)
  const totalNeto         = nominas.reduce((s, n) => s + n.salarioNeto, 0)
  const totalISR          = nominas.reduce((s, n) => s + n.isrMensual, 0)
  const totalTSSEmpleador = nominas.reduce((s, n) => s + n.totalAportesEmpleador, 0)
  const totalRegalia      = nominas.reduce((s, n) => s + n.regaliaPascual, 0)

  const tareas = [
    ...EMPLEADOS_ACTIVOS
      .filter(e => e.tipoContrato === 'tiempo_determinado')
      .map(e => ({
        tipo: 'warning' as const,
        titulo: `Renovar contrato — ${fullName(e)}`,
        sub: `Contrato a término determinado · ${e.cargo}`,
      })),
    {
      tipo: 'info' as const,
      titulo: `Pagar ISR este mes: ${formatRD(totalISR)}`,
      sub: 'Vence el día 10 del próximo mes · DGII',
    },
    {
      tipo: 'info' as const,
      titulo: `Pagar TSS empleador: ${formatRD(totalTSSEmpleador)}`,
      sub: 'Vence el día 10 del próximo mes · CNSS',
    },
  ] as { tipo: 'warning' | 'info'; titulo: string; sub: string }[]

  return { totalBruto, totalNeto, totalISR, totalTSSEmpleador, totalRegalia, tareas }
}

const hoy = new Date()
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function DashboardPage() {
  const { totalBruto, totalNeto, totalISR, totalTSSEmpleador, totalRegalia, tareas } =
    useDashboardData()
  const periodo = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Demo Empresa S.R.L." subtitle={periodo} />

      <div className="flex-1 overflow-y-auto bg-zinc-50">

        {/* Company header + tabs */}
        <div className="bg-white border-b border-zinc-200 px-6 pt-5 pb-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-zinc-300" />
              <span className="text-[9px] text-zinc-300 mt-0.5 font-medium">LOGO</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 leading-none">Demo Empresa S.R.L.</h1>
              <p className="text-xs text-zinc-400 mt-1">República Dominicana · RNC: 1-01-12345-6</p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 -mb-px">
            <button className="pb-3 text-sm font-semibold text-teal-600 border-b-2 border-teal-600 transition-colors">
              Resumen nómina
            </button>
            <Link
              href="/reportes"
              className="pb-3 text-sm text-zinc-500 hover:text-zinc-700 border-b-2 border-transparent hover:border-zinc-300 transition-colors"
            >
              Análisis de costos
            </Link>
            <Link
              href="/nomina"
              className="pb-3 text-sm text-zinc-500 hover:text-zinc-700 border-b-2 border-transparent hover:border-zinc-300 transition-colors"
            >
              Procesar nómina
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <StatCard
              label="Empleados Activos"
              value={String(EMPLEADOS_ACTIVOS.length)}
              sub="Personal en planilla activa"
              icon={Users}
              iconColor="bg-teal-50 text-teal-600"
              trend="up"
              trendLabel="+2"
            />
            <StatCard
              label="Nómina Bruta"
              value={formatRD(totalBruto, 0)}
              sub={`Neto: ${formatRD(totalNeto, 0)}`}
              icon={Wallet}
              iconColor="bg-emerald-50 text-emerald-600"
              trend="up"
              trendLabel="+4%"
            />
            <StatCard
              label="TSS Empleador"
              value={formatRD(totalTSSEmpleador, 0)}
              sub="AFP + SFS + SRL empresa"
              icon={TrendingUp}
              iconColor="bg-amber-50 text-amber-600"
              trend="neutral"
              trendLabel="Estable"
            />
            <StatCard
              label="ISR a Retener"
              value={formatRD(totalISR, 0)}
              sub="Retención mensual empleados"
              icon={Receipt}
              iconColor="bg-violet-50 text-violet-600"
              trend="down"
              trendLabel="-2%"
            />
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Tasks / Tareas */}
            <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Tareas pendientes</h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {tareas.length}
                </span>
              </div>
              <div className="divide-y divide-zinc-100">
                {tareas.map((t, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      {t.tipo === 'warning' && (
                        <span className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                          Pendiente
                        </span>
                      )}
                      {t.tipo === 'info' && (
                        <span className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-sky-100 text-sky-700">
                          Aviso
                        </span>
                      )}
                      <p className="text-sm font-semibold text-zinc-900 leading-snug">{t.titulo}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{t.sub}</p>
                    </div>
                    <Link
                      href={t.tipo === 'warning' ? '/empleados' : '/reportes'}
                      className="shrink-0 rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Ir
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel — Costos */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Costos del período</h2>
                <Link href="/reportes" className="text-xs text-teal-600 hover:underline">Ver todo</Link>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: 'Salarios brutos',       value: totalBruto,       badge: null },
                  { label: 'AFP empleador',          value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0710, 0), badge: null },
                  { label: 'SFS empleador',          value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0709, 0), badge: null },
                  { label: 'SRL empleador',          value: EMPLEADOS_ACTIVOS.reduce((s,e) => s + Math.min(e.salarioBase, 420_000) * 0.0110, 0), badge: null },
                  { label: 'Prov. Regalía Pascual',  value: totalRegalia,     badge: 'dic' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                      {row.label}
                      {row.badge && (
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-600 uppercase">{row.badge}</span>
                      )}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-zinc-800">{formatRD(row.value, 0)}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-200 pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900">Total empresa</span>
                  <span className="text-sm font-bold tabular-nums text-teal-700">{formatRD(totalBruto + totalTSSEmpleador, 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Empleados */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">Empleados activos</h2>
              <Link href="/empleados" className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:underline">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">Cargo</th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">Ingreso</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Salario</th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {EMPLEADOS_ACTIVOS.slice(0, 5).map(emp => (
                    <tr key={emp.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700 shrink-0">
                            {emp.nombre[0]}{emp.apellido[0]}
                          </div>
                          <span className="font-medium text-zinc-900 text-sm">{fullName(emp)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-500 text-xs hidden sm:table-cell">{emp.cargo}</td>
                      <td className="px-5 py-3 text-zinc-400 text-xs hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(emp.fechaIngreso)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-900 text-sm">
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

          <p className="text-center text-[11px] text-zinc-400 pb-2">
            Ley 16-92 · Ley 87-01 (TSS) · Ley 11-92 (ISR) · DGII / CNSS · República Dominicana
          </p>
        </div>
      </div>
    </div>
  )
}
