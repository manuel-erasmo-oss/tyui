'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularNomina } from '@/lib/dominican-labor'
import { fullName } from '@/lib/utils'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { AgendaNomina } from '@/components/dashboard/AgendaNomina'
import { CentroAlertas } from '@/components/dashboard/CentroAlertas'
import { ChartSkeleton } from '@/components/charts/ChartSkeleton'

const PayrollBarChart = dynamic(
  () => import('@/components/charts/PayrollBarChart').then(m => m.PayrollBarChart),
  { ssr: false, loading: () => <ChartSkeleton variant="bars" height={120} /> }
)
const CostDonutChart = dynamic(
  () => import('@/components/charts/CostDonutChart').then(m => m.CostDonutChart),
  { ssr: false, loading: () => <ChartSkeleton variant="donut" height={110} /> }
)
const TrendLineChart = dynamic(
  () => import('@/components/charts/TrendLineChart').then(m => m.TrendLineChart),
  { ssr: false, loading: () => <ChartSkeleton variant="line" height={120} /> }
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
  children,
}: {
  label: string
  value: string
  subtitle: string
  delta?: { pct: number; positive: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</p>
      <div>
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{value}</p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
        {delta && (
          <p className={`mt-1.5 text-xs font-semibold ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {delta.positive ? '↑' : '↓'} {Math.abs(delta.pct).toFixed(1)}% vs período anterior
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

const RANGO_OPCIONES = [3, 6, 12] as const
type RangoMeses = typeof RANGO_OPCIONES[number]

function RangoSelector({ value, onChange }: { value: RangoMeses; onChange: (v: RangoMeses) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-0.5">
      {RANGO_OPCIONES.map(opcion => (
        <button
          key={opcion}
          type="button"
          onClick={() => onChange(opcion)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === opcion
              ? 'bg-[#1B2980] text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          {opcion}M
        </button>
      ))}
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

  // ── Historial de nómina para los gráficos ─────────────────────────────────
  // Antes solo consideraba tipo==='mensual' — cualquier empresa en modalidad
  // quincenal (Empresa.modalidadNomina==='quincenal') nunca tenía períodos
  // 'mensual' reales, así que sus gráficos siempre caían al relleno sintético
  // sin importar cuántos períodos hubiera procesado. Ahora se agregan ambos
  // tipos, sumando las 2 quincenas de un mismo mes en un solo total mensual.
  const [rangoMeses, setRangoMeses] = useState<RangoMeses>(6)

  const periodosPorMes = useMemo(() => {
    const acumulado = new Map<string, { anio: number; mes: number; bruto: number; aportes: number }>()
    for (const p of periodos) {
      if (p.estado === 'en_proceso') continue
      if (p.tipo !== 'mensual' && p.tipo !== 'quincenal') continue
      const key = `${p.anio}-${p.mes}`
      const fila = acumulado.get(key) ?? { anio: p.anio, mes: p.mes, bruto: 0, aportes: 0 }
      fila.bruto   += p.totales.bruto
      fila.aportes += p.totales.aportes
      acumulado.set(key, fila)
    }
    return Array.from(acumulado.values()).sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
  }, [periodos])

  const periodosReales = periodosPorMes.slice(-rangoMeses)
  // Distingue año en la etiqueta solo si el rango visible cruza más de un año
  // calendario — evita ambigüedad tipo "Ene" repetido para 2025 y 2026 en un
  // rango de 12 meses, sin ensuciar la etiqueta cuando no hace falta.
  const multiAnio = new Set(periodosReales.map(p => p.anio)).size > 1
  const labelMes = (p: { anio: number; mes: number }) => multiAnio ? `${MESES[p.mes - 1]} ${String(p.anio).slice(2)}` : MESES[p.mes - 1]

  const BAR_DATA = periodosReales.length >= 1
    ? periodosReales.map(p => ({ mes: labelMes(p), nomina: p.bruto, tss: p.aportes }))
    : Array.from({ length: rangoMeses }, (_, i) => {
        const offset = rangoMeses - 1 - i
        const ratio  = 0.85 + (i / (rangoMeses - 1)) * 0.15
        return {
          mes: MESES[((hoy.getMonth() - offset) % 12 + 12) % 12],
          nomina: Math.round(totalBruto * ratio),
          tss: Math.round(totalTSSEmpleador * ratio),
        }
      })

  const netoRatio  = totalBruto > 0 ? totalNeto / totalBruto : 0
  const LINE_DATA  = BAR_DATA.map(d => ({ mes: d.mes, valor: Math.round(d.nomina * netoRatio) }))

  // BAR_DATA/LINE_DATA tienen entre 1 y `rangoMeses` elementos según cuántos
  // períodos reales existan — nunca asumir una cantidad fija.
  const ultimoIdx  = BAR_DATA.length - 1
  const anteriorIdx = ultimoIdx - 1
  const prevBruto  = anteriorIdx >= 0 ? BAR_DATA[anteriorIdx].nomina : 0
  const prevCosto  = anteriorIdx >= 0 ? BAR_DATA[anteriorIdx].nomina + BAR_DATA[anteriorIdx].tss : 0
  const prevNeto   = anteriorIdx >= 0 ? LINE_DATA[anteriorIdx].valor : 0
  const deltaBruto = prevBruto > 0 ? ((BAR_DATA[ultimoIdx].nomina  - prevBruto) / prevBruto) * 100 : 0
  const deltaCosto = prevCosto > 0 ? ((costoTotal                   - prevCosto) / prevCosto) * 100 : 0
  const deltaNeto  = prevNeto  > 0 ? ((LINE_DATA[ultimoIdx].valor  - prevNeto)  / prevNeto)  * 100 : 0

  const DONUT_DATA = [
    { name: 'Salario neto',  value: totalNeto,        color: '#1B2980' },
    { name: 'AFP empleador', value: afpEmpleador,      color: '#0891b2' },
    { name: 'SFS empleador', value: sfsEmpleador,      color: '#7c3aed' },
    { name: 'SRL',           value: srlEmpleador,      color: '#d97706' },
    { name: 'Infotep',       value: infotepEmpleador,  color: '#65a30d' },
    { name: 'ISR retenido',  value: totalISR,          color: '#e11d48' },
  ]

  const maxBar = Math.max(...[afpEmpleador, sfsEmpleador, srlEmpleador, infotepEmpleador, totalISR, totalRegalia])

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

          {/* Centro de Alertas — consolida en un solo lugar, ordenado por
              severidad, las alertas que antes vivían dispersas: salario
              mínimo, vencimiento de Bonificación/Regalía, préstamos con
              gestión de cobro requerida, empleados fuera de banda salarial. */}
          <CentroAlertas />

          {/* Selector de rango — comparte estado con las 3 chart cards de abajo */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Historial de nómina</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {periodosReales.length > 0
                  ? `${periodosReales.length} período${periodosReales.length !== 1 ? 's' : ''} real${periodosReales.length !== 1 ? 'es' : ''} procesado${periodosReales.length !== 1 ? 's' : ''}`
                  : 'Datos ilustrativos — aún no hay períodos procesados'}
              </p>
            </div>
            <RangoSelector value={rangoMeses} onChange={setRangoMeses} />
          </div>

          {/* Row 1 — 3 chart cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartCard
              label="Nómina mensual"
              value={formatK(totalBruto)}
              subtitle="Salario bruto planilla activa"
              delta={anteriorIdx >= 0 ? { pct: deltaBruto, positive: deltaBruto >= 0 } : undefined}
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
              delta={anteriorIdx >= 0 ? { pct: deltaCosto, positive: deltaCosto >= 0 } : undefined}
            >
              <CostDonutChart data={DONUT_DATA} />
            </ChartCard>

            <ChartCard
              label="Nómina neta"
              value={formatK(totalNeto)}
              subtitle="Total a pagar a empleados"
              delta={anteriorIdx >= 0 ? { pct: deltaNeto, positive: deltaNeto >= 0 } : undefined}
            >
              <TrendLineChart data={LINE_DATA} />
            </ChartCard>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Retenciones */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Retenciones</p>
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
              <div className="divide-y divide-zinc-200 dark:divide-[#252840]">
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
