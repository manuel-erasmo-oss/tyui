'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, CheckCircle2, MoreHorizontal, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
import { calcularNomina } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'

const PayrollBarChart = dynamic(
  () => import('@/components/charts/PayrollBarChart').then(m => m.PayrollBarChart),
  { ssr: false, loading: () => <div className="h-[120px] animate-pulse rounded bg-zinc-50" /> }
)
const CostDonutChart = dynamic(
  () => import('@/components/charts/CostDonutChart').then(m => m.CostDonutChart),
  { ssr: false, loading: () => <div className="h-[110px] animate-pulse rounded bg-zinc-50" /> }
)
const TrendLineChart = dynamic(
  () => import('@/components/charts/TrendLineChart').then(m => m.TrendLineChart),
  { ssr: false, loading: () => <div className="h-[120px] animate-pulse rounded bg-zinc-50" /> }
)

const hoy = new Date()
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatK(v: number) {
  if (v >= 1_000_000) return `RD$${(v / 1_000_000).toFixed(1)}M`
  return `RD$${(v / 1_000).toFixed(0)}K`
}

function ChartCard({
  label,
  value,
  subtitle,
  period = 'Este mes',
  children,
}: {
  label: string
  value: string
  subtitle: string
  period?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
          {period} <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <p className="text-3xl font-bold text-zinc-900 leading-none">{value}</p>
        <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const nominas = EMPLEADOS_ACTIVOS.map(e => calcularNomina(e))
  const totalBruto        = nominas.reduce((s, n) => s + n.totalBruto, 0)
  const totalNeto         = nominas.reduce((s, n) => s + n.salarioNeto, 0)
  const totalISR          = nominas.reduce((s, n) => s + n.isrMensual, 0)
  const totalTSSEmpleador = nominas.reduce((s, n) => s + n.totalAportesEmpleador, 0)
  const totalRegalia      = nominas.reduce((s, n) => s + n.regaliaPascual, 0)
  const afpEmpleador      = EMPLEADOS_ACTIVOS.reduce((s, e) => s + Math.min(e.salarioBase, 420_000) * 0.0710, 0)
  const sfsEmpleador      = EMPLEADOS_ACTIVOS.reduce((s, e) => s + Math.min(e.salarioBase, 420_000) * 0.0709, 0)
  const srlEmpleador      = EMPLEADOS_ACTIVOS.reduce((s, e) => s + Math.min(e.salarioBase, 420_000) * 0.0110, 0)

  const periodo = `${MES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`

  // Simulated 5-month payroll trend
  const BAR_DATA = [
    { mes: MESES[(hoy.getMonth() - 4 + 12) % 12], nomina: Math.round(totalBruto * 0.88), tss: Math.round(totalTSSEmpleador * 0.88) },
    { mes: MESES[(hoy.getMonth() - 3 + 12) % 12], nomina: Math.round(totalBruto * 0.91), tss: Math.round(totalTSSEmpleador * 0.91) },
    { mes: MESES[(hoy.getMonth() - 2 + 12) % 12], nomina: Math.round(totalBruto * 0.95), tss: Math.round(totalTSSEmpleador * 0.95) },
    { mes: MESES[(hoy.getMonth() - 1 + 12) % 12], nomina: Math.round(totalBruto * 0.98), tss: Math.round(totalTSSEmpleador * 0.98) },
    { mes: MESES[hoy.getMonth()],                  nomina: totalBruto,                    tss: totalTSSEmpleador },
  ]

  const LINE_DATA = BAR_DATA.map(d => ({ mes: d.mes, valor: Math.round(d.nomina * (totalNeto / totalBruto)) }))

  const DONUT_DATA = [
    { name: 'Salario neto',  value: totalNeto,   color: '#1B2980' },
    { name: 'AFP empleador', value: afpEmpleador, color: '#0891b2' },
    { name: 'SFS empleador', value: sfsEmpleador, color: '#7c3aed' },
    { name: 'SRL',           value: srlEmpleador, color: '#d97706' },
    { name: 'ISR retenido',  value: totalISR,     color: '#e11d48' },
  ]

  const maxBar = Math.max(...[afpEmpleador, sfsEmpleador, srlEmpleador, totalISR, totalRegalia])

  const tareas = [
    ...EMPLEADOS_ACTIVOS
      .filter(e => e.tipoContrato === 'tiempo_determinado')
      .map(e => ({ tipo: 'warning' as const, titulo: `Renovar contrato — ${fullName(e)}`, sub: `Contrato a término determinado · ${e.cargo}` })),
    { tipo: 'info' as const, titulo: `ISR a retener: ${formatRD(totalISR)}`, sub: 'Vence día 10 del próximo mes · DGII' },
    { tipo: 'info' as const, titulo: `TSS empleador: ${formatRD(totalTSSEmpleador)}`, sub: 'Vence día 10 del próximo mes · CNSS' },
  ] as { tipo: 'warning' | 'info'; titulo: string; sub: string }[]

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Demo Empresa S.R.L." subtitle={periodo} />

      <div className="flex-1 overflow-y-auto bg-zinc-50">

        {/* Company + Tabs */}
        <div className="bg-white border-b border-zinc-200 px-6 pt-5 pb-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-zinc-300" />
              <span className="text-[8px] text-zinc-300 font-medium tracking-wide">LOGO</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 leading-none">Demo Empresa S.R.L.</h1>
              <p className="text-xs text-zinc-400 mt-0.5">República Dominicana · RNC 1-01-12345-6</p>
            </div>
          </div>
          <div className="flex gap-6 -mb-px">
            <button className="pb-3 text-sm font-semibold text-[#1B2980] border-b-2 border-[#1B2980]">
              Resumen nómina
            </button>
            <Link href="/reportes" className="pb-3 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent hover:border-zinc-300 transition-colors">
              Análisis de costos
            </Link>
            <Link href="/nomina" className="pb-3 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent hover:border-zinc-300 transition-colors">
              Procesar nómina
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4">

          {/* Row 1 — 3 chart cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Nómina mensual — Bar chart */}
            <ChartCard
              label="Nómina mensual"
              value={formatK(totalBruto)}
              subtitle="Salario bruto planilla activa"
            >
              <PayrollBarChart data={BAR_DATA} />
              <div className="flex items-center gap-4 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#1B2980] inline-block" /> Bruto</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#00E676] inline-block" /> TSS empl.</span>
              </div>
            </ChartCard>

            {/* Composición de costos — Donut */}
            <ChartCard
              label="Composición de costos"
              value={formatK(totalBruto + totalTSSEmpleador)}
              subtitle="Costo total empresa este mes"
            >
              <CostDonutChart data={DONUT_DATA} />
            </ChartCard>

            {/* Nómina neta — Line chart */}
            <ChartCard
              label="Nómina neta"
              value={formatK(totalNeto)}
              subtitle="Total a pagar a empleados"
            >
              <TrendLineChart data={LINE_DATA} />
            </ChartCard>
          </div>

          {/* Row 2 — Retenciones + Tareas + Empleados */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Retenciones y obligaciones */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Retenciones</p>
                <button className="text-xs text-zinc-400 hover:text-zinc-600">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-3xl font-bold text-zinc-900 leading-none">{formatK(totalISR + totalTSSEmpleador)}</p>
              <p className="mt-1 text-xs text-zinc-400 mb-4">Obligaciones del período</p>
              <div className="space-y-3">
                {[
                  { label: 'AFP empleador',  value: afpEmpleador,      color: '#0891b2', badge: null },
                  { label: 'SFS empleador',  value: sfsEmpleador,      color: '#7c3aed', badge: null },
                  { label: 'SRL empleador',  value: srlEmpleador,      color: '#d97706', badge: null },
                  { label: 'ISR retenido',   value: totalISR,          color: '#e11d48', badge: '10 jul' },
                  { label: 'Regalía prov.',  value: totalRegalia,      color: '#059669', badge: 'dic' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        {row.label}
                        {row.badge && (
                          <span className="rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-semibold text-zinc-500 uppercase">{row.badge}</span>
                        )}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-zinc-700">{formatK(row.value)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(row.value / maxBar) * 100}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tareas */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Tareas</p>
                <span className="h-5 w-5 rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 flex items-center justify-center">
                  {tareas.length}
                </span>
              </div>
              <div className="divide-y divide-zinc-50">
                {tareas.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    {t.tipo === 'warning'
                      ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1B2980]" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 leading-snug">{t.titulo}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{t.sub}</p>
                    </div>
                    <Link
                      href={t.tipo === 'warning' ? '/empleados' : '/reportes'}
                      className="shrink-0 rounded border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      Ir
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Empleados activos */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Empleados</p>
                <Link href="/empleados" className="text-xs text-[#1B2980] hover:underline flex items-center gap-0.5">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-zinc-50">
                {EMPLEADOS_ACTIVOS.slice(0, 5).map((emp, i) => {
                  const n = nominas[EMPLEADOS_ACTIVOS.indexOf(emp)]
                  return (
                    <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 truncate">{fullName(emp)}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{emp.cargo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold tabular-nums text-zinc-900">{formatK(n.salarioNeto)}</p>
                        <p className="text-[10px] text-zinc-400">neto</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-300 pb-2 tracking-wide">
            LEY 16-92 · LEY 87-01 TSS · LEY 11-92 ISR · DGII / CNSS · REPÚBLICA DOMINICANA
          </p>
        </div>
      </div>
    </div>
  )
}
