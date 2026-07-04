'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, MoreHorizontal, Building2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularNomina, getSalarioMinimoAplicable } from '@/lib/dominican-labor'
import { fullName, formatRD } from '@/lib/utils'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { AgendaNomina } from '@/components/dashboard/AgendaNomina'

const PayrollBarChart = dynamic(
  () => import('@/components/charts/PayrollBarChart').then(m => m.PayrollBarChart),
  { ssr: false, loading: () => <div className="h-[120px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" /> }
)
const CostDonutChart = dynamic(
  () => import('@/components/charts/CostDonutChart').then(m => m.CostDonutChart),
  { ssr: false, loading: () => <div className="h-[110px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" /> }
)
const TrendLineChart = dynamic(
  () => import('@/components/charts/TrendLineChart').then(m => m.TrendLineChart),
  { ssr: false, loading: () => <div className="h-[120px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" /> }
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
  delta,
  period = 'Este mes',
  children,
}: {
  label: string
  value: string
  subtitle: string
  delta?: { pct: number; positive: boolean }
  period?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</p>
        <button className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          {period} <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{value}</p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
        {delta && (
          <p className={`mt-1.5 text-xs font-semibold ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {delta.positive ? '↑' : '↓'} {Math.abs(delta.pct).toFixed(1)}% vs mes anterior
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { empresa } = useEmpresa()
  const { periodos } = usePeriodos()
  const nombreEmpresa = empresa.nombre || 'Mi Empresa'
  const infoEmpresa = [
    empresa.ciudad || 'República Dominicana',
    empresa.rnc ? `RNC ${empresa.rnc}` : null,
  ].filter(Boolean).join(' · ')

  const { empleadosActivos } = useEmpleados()
  const nominas = empleadosActivos.map(e => calcularNomina(e))
  const totalBruto        = nominas.reduce((s, n) => s + n.totalBruto, 0)
  const totalNeto         = nominas.reduce((s, n) => s + n.salarioNeto, 0)
  const totalISR          = nominas.reduce((s, n) => s + n.isrMensual, 0)
  const totalTSSEmpleador = nominas.reduce((s, n) => s + n.totalAportesEmpleador, 0)
  const totalRegalia      = nominas.reduce((s, n) => s + n.regaliaPascual, 0)
  const afpEmpleador      = nominas.reduce((s, n) => s + n.afpEmpleador, 0)
  const sfsEmpleador      = nominas.reduce((s, n) => s + n.sfsEmpleador, 0)
  const srlEmpleador      = nominas.reduce((s, n) => s + n.srlEmpleador, 0)
  const infotepEmpleador  = nominas.reduce((s, n) => s + n.infotepEmpleador, 0)
  const costoTotal        = totalBruto + totalTSSEmpleador

  const periodo = `${MES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`

  // Build chart from real processed periods (monthly only, last 5)
  const periodosReales = [...periodos]
    .filter(p => p.tipo === 'mensual' && p.estado !== 'en_proceso')
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
    .slice(-5)

  const BAR_DATA = periodosReales.length >= 2
    ? periodosReales.map(p => ({
        mes: MESES[p.mes - 1],
        nomina: p.totales.bruto,
        tss: p.totales.aportes,
      }))
    : [
        { mes: MESES[(hoy.getMonth() - 4 + 12) % 12], nomina: Math.round(totalBruto * 0.88), tss: Math.round(totalTSSEmpleador * 0.88) },
        { mes: MESES[(hoy.getMonth() - 3 + 12) % 12], nomina: Math.round(totalBruto * 0.91), tss: Math.round(totalTSSEmpleador * 0.91) },
        { mes: MESES[(hoy.getMonth() - 2 + 12) % 12], nomina: Math.round(totalBruto * 0.95), tss: Math.round(totalTSSEmpleador * 0.95) },
        { mes: MESES[(hoy.getMonth() - 1 + 12) % 12], nomina: Math.round(totalBruto * 0.98), tss: Math.round(totalTSSEmpleador * 0.98) },
        { mes: MESES[hoy.getMonth()],                  nomina: totalBruto,                    tss: totalTSSEmpleador },
      ]

  const netoRatio  = totalBruto > 0 ? totalNeto / totalBruto : 0
  const LINE_DATA  = BAR_DATA.map(d => ({ mes: d.mes, valor: Math.round(d.nomina * netoRatio) }))

  const prevBruto  = BAR_DATA[3].nomina
  const prevCosto  = BAR_DATA[3].nomina + BAR_DATA[3].tss
  const prevNeto   = LINE_DATA[3].valor
  const deltaBruto = prevBruto > 0 ? ((BAR_DATA[4].nomina   - prevBruto) / prevBruto) * 100 : 0
  const deltaCosto = prevCosto > 0 ? ((costoTotal             - prevCosto) / prevCosto) * 100 : 0
  const deltaNeto  = prevNeto  > 0 ? ((LINE_DATA[4].valor    - prevNeto)  / prevNeto)  * 100 : 0

  const DONUT_DATA = [
    { name: 'Salario neto',  value: totalNeto,        color: '#1B2980' },
    { name: 'AFP empleador', value: afpEmpleador,      color: '#0891b2' },
    { name: 'SFS empleador', value: sfsEmpleador,      color: '#7c3aed' },
    { name: 'SRL',           value: srlEmpleador,      color: '#d97706' },
    { name: 'Infotep',       value: infotepEmpleador,  color: '#65a30d' },
    { name: 'ISR retenido',  value: totalISR,          color: '#e11d48' },
  ]

  const maxBar = Math.max(...[afpEmpleador, sfsEmpleador, srlEmpleador, infotepEmpleador, totalISR, totalRegalia])

  // ─── Alerta de salario mínimo (según categoría de empresa o zona franca) ───
  const salarioMinimoAplicable = getSalarioMinimoAplicable(empresa)
  const empleadosBajoMinimo = salarioMinimoAplicable
    ? empleadosActivos.filter(e => e.salarioBase < salarioMinimoAplicable)
    : []
  const CATEGORIA_LABEL: Record<string, string> = { micro: 'Micro', pequeña: 'Pequeña', mediana: 'Mediana', grande: 'Grande' }
  const categoriaAlertaLabel = empresa.zonaFranca ? 'Zona Franca' : (empresa.categoriaEmpresa ? CATEGORIA_LABEL[empresa.categoriaEmpresa] : '')

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title={nombreEmpresa} subtitle={periodo} />

      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Company + Tabs */}
        <div className="bg-white dark:bg-[#141722] border-b border-zinc-200 dark:border-[#252840] px-6 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] flex items-center justify-center shrink-0 overflow-hidden">
              {empresa.logo ? (
                <img src={empresa.logo} alt={nombreEmpresa} className="h-full w-full object-contain p-1" />
              ) : (
                <Building2 className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
              )}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{infoEmpresa}</p>
          </div>
          <div className="flex gap-6 -mb-px">
            <button className="pb-3 text-sm font-semibold text-[#1B2980] dark:text-indigo-400 border-b-2 border-[#1B2980] dark:border-indigo-500">
              Resumen nómina
            </button>
            <Link href="/reportes" className="pb-3 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              Análisis de costos
            </Link>
            <Link href="/nomina" className="pb-3 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              Procesar nómina
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4">

          {/* Alerta de salario mínimo */}
          {empleadosBajoMinimo.length > 0 && salarioMinimoAplicable && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {empleadosBajoMinimo.length} empleado{empleadosBajoMinimo.length !== 1 ? 's' : ''} por debajo del salario mínimo
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    {empresa.zonaFranca ? categoriaAlertaLabel : `Categoría ${categoriaAlertaLabel}`} — mínimo legal {formatRD(salarioMinimoAplicable, 0)}/mes
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {empleadosBajoMinimo.map(e => (
                      <li key={e.id} className="flex items-center justify-between text-xs">
                        <span className="text-amber-800 dark:text-amber-300">{fullName(e)}</span>
                        <span className="tabular-nums font-semibold text-amber-800 dark:text-amber-300">
                          {formatRD(e.salarioBase, 0)}
                          <span className="ml-1.5 font-normal text-amber-600 dark:text-amber-500">
                            (faltan {formatRD(salarioMinimoAplicable - e.salarioBase, 0)})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5 flex items-center gap-4">
                    <Link href="/empleados" className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline">
                      Ir a Empleados →
                    </Link>
                    <Link href="/configuracion" className="text-xs text-amber-600 dark:text-amber-500 hover:underline">
                      ¿Categoría incorrecta? Cámbiala en Configuración
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 1 — 3 chart cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartCard
              label="Nómina mensual"
              value={formatK(totalBruto)}
              subtitle="Salario bruto planilla activa"
              delta={{ pct: deltaBruto, positive: deltaBruto >= 0 }}
            >
              <PayrollBarChart data={BAR_DATA} />
              <div className="flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#1B2980] dark:bg-indigo-400 inline-block" /> Bruto</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#10b981] inline-block" /> TSS empl.</span>
              </div>
            </ChartCard>

            <ChartCard
              label="Composición de costos"
              value={formatK(costoTotal)}
              subtitle="Costo total empresa este mes"
              delta={{ pct: deltaCosto, positive: deltaCosto >= 0 }}
            >
              <CostDonutChart data={DONUT_DATA} />
            </ChartCard>

            <ChartCard
              label="Nómina neta"
              value={formatK(totalNeto)}
              subtitle="Total a pagar a empleados"
              delta={{ pct: deltaNeto, positive: deltaNeto >= 0 }}
            >
              <TrendLineChart data={LINE_DATA} />
            </ChartCard>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Retenciones */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Retenciones</p>
                <button className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{formatK(totalISR + totalTSSEmpleador)}</p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 mb-4">Obligaciones del período</p>
              <div className="space-y-3">
                {[
                  { label: 'AFP empleador',  value: afpEmpleador,      color: '#0891b2', badge: null },
                  { label: 'SFS empleador',  value: sfsEmpleador,      color: '#7c3aed', badge: null },
                  { label: 'SRL empleador',  value: srlEmpleador,      color: '#d97706', badge: null },
                  { label: 'Infotep',        value: infotepEmpleador,  color: '#65a30d', badge: null },
                  { label: 'ISR retenido',   value: totalISR,          color: '#e11d48', badge: '10 jul' },
                  { label: 'Regalía prov.',  value: totalRegalia,      color: '#059669', badge: 'dic' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        {row.label}
                        {row.badge && (
                          <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-1 py-0.5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase">{row.badge}</span>
                        )}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{formatK(row.value)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-[#1a1d2e] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(row.value / maxBar) * 100}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <AgendaNomina />

            {/* Empleados activos */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Empleados</p>
                <Link href="/empleados" className="text-xs text-[#1B2980] dark:text-indigo-400 hover:underline flex items-center gap-0.5">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {empleadosActivos.slice(0, 5).map((emp, i) => {
                  const n = nominas[i]
                  return (
                    <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#1a1d2e] text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{fullName(emp)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{emp.cargo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatK(n.salarioNeto)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">neto</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-300 dark:text-zinc-600 pb-2 tracking-wide">
            LEY 16-92 · LEY 87-01 TSS · LEY 11-92 ISR · DGII / CNSS · REPÚBLICA DOMINICANA
          </p>
        </div>
      </div>
    </div>
  )
}
