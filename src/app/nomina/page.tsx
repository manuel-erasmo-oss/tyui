'use client'

import { useState } from 'react'
import {
  ChevronRight,
  Download,
  Printer,
  Info,
  CheckCircle2,
  PlayCircle,
  Clock,
  Lock,
  Trash2,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos } from '@/lib/periodos-context'
import { calcularNomina, calcularNominaQuincenal } from '@/lib/dominican-labor'
import { formatRD, formatPeriodo, fullName } from '@/lib/utils'
import type { Empleado, ResultadoNomina, PeriodoNomina, TipoPeriodo } from '@/types'
import { Wallet, TrendingUp, Receipt, BarChart3 } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const hoy = new Date()

// ── CSV export ────────────────────────────────────────────────────────────────
function exportarCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = '﻿'
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Label helper ──────────────────────────────────────────────────────────────
function labelPeriodo(p: PeriodoNomina): string {
  const mes = MESES[p.mes - 1]
  if (p.tipo === 'quincenal') {
    return `${p.quincena === 1 ? '1ª' : '2ª'} Quincena · ${mes} ${p.anio}`
  }
  return `${mes} ${p.anio}`
}

// ── Detalle modal ─────────────────────────────────────────────────────────────
function DetalleNomina({
  empleado,
  nomina,
  periodoLabel,
  onClose,
}: {
  empleado: Empleado
  nomina: ResultadoNomina
  periodoLabel: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-2xl bg-zinc-950 dark:bg-[#080a12] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Comprobante · {periodoLabel}</p>
            <p className="mt-1 text-lg font-bold">{fullName(empleado)}</p>
            <p className="text-sm text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-100 dark:divide-[#1d2035]">
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Devengos</p>
            <div className="space-y-2">
              {[
                { label: 'Salario Básico',      value: nomina.salarioBruto },
                { label: 'H.E. 35% Recargo',    value: nomina.importeHE35,    hide: nomina.importeHE35 === 0 },
                { label: 'H.E. 100% Recargo',   value: nomina.importeHE100,   hide: nomina.importeHE100 === 0 },
                { label: 'Bonificaciones',       value: nomina.bonificaciones, hide: nomina.bonificaciones === 0 },
                { label: 'Comisiones',           value: nomina.comisiones,     hide: nomina.comisiones === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{formatRD(row.value)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Bruto</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{formatRD(nomina.totalBruto)}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-600">Descuentos</p>
            <div className="space-y-2">
              {[
                { label: 'AFP Empleado (2.87%)',  value: nomina.afpEmpleado },
                { label: 'SFS Empleado (3.04%)',  value: nomina.sfsEmpleado },
                { label: 'ISR Retención',          value: nomina.isrMensual,      hide: nomina.isrMensual === 0 },
                { label: 'Otros Descuentos',       value: nomina.otrosDescuentos, hide: nomina.otrosDescuentos === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-rose-700 dark:text-rose-400">({formatRD(row.value)})</span>
                </div>
              ))}
              {nomina.isrMensual === 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">ISR: anticipo de quincena (se liquida en 2ª quincena)</p>
              )}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Descuentos</span>
                <span className="text-rose-700 dark:text-rose-400 tabular-nums">({formatRD(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] p-6 rounded-b-2xl">
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide">Salario Neto a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">{formatRD(nomina.salarioNeto, 0)}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4 space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide mb-2">Aportes Empresa (TSS)</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">AFP Empleador (7.10%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SFS Empleador (7.09%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SRL Empleador</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.srlEmpleador)}</span>
            </div>
            <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-1.5 flex justify-between text-xs font-bold">
              <span className="dark:text-zinc-200">Costo Total Empresa</span>
              <span className="text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(nomina.totalCostoEmpleador)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Regalía/período: <strong className="text-zinc-800 dark:text-zinc-200">{formatRD(nomina.regaliaPascual, 0)}</strong></span>
            <span>Vacaciones: <strong className="text-zinc-800 dark:text-zinc-200">{nomina.vacacionesMensualesDias.toFixed(2)} días</strong></span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">Ley 16-92 · Ley 87-01 · Ley 11-92</p>
        </div>
      </div>
    </div>
  )
}

// ── Historial table ───────────────────────────────────────────────────────────
function HistorialTable({
  periodos,
  cerrar,
  eliminar,
}: {
  periodos: PeriodoNomina[]
  cerrar: (id: string) => void
  eliminar: (id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
      <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          Historial de Nóminas Generadas
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{periodos.length} período(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Neto Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Empresa</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
            {periodos.map(p => (
              <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{labelPeriodo(p)}</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Generada: {new Date(p.fechaGeneracion).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                    p.tipo === 'quincenal'
                      ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-800/50'
                      : 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-800/50'
                  }`}>
                    {p.tipo === 'quincenal' ? `${p.quincena === 1 ? '1ª' : '2ª'} Quincena` : 'Mensual'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center tabular-nums text-zinc-600 dark:text-zinc-400">
                  {p.totalEmpleados}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#151f66] dark:text-indigo-300">
                  {formatRD(p.totales.neto, 0)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                  {formatRD(p.totales.costoTotal, 0)}
                </td>
                <td className="px-4 py-3.5">
                  {p.estado === 'cerrada' ? (
                    <Badge variant="neutral">
                      <Lock className="mr-1 h-3 w-3" />
                      Cerrada
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Procesada
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    {p.estado === 'procesada' && (
                      <button
                        onClick={() => cerrar(p.id)}
                        title="Cerrar período"
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!confirm(`¿Eliminar el período "${labelPeriodo(p)}"?`)) return
                        eliminar(p.id)
                      }}
                      title="Eliminar período"
                      className="rounded-lg border border-rose-200 dark:border-rose-800/50 p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NominaPage() {
  const [mes, setMes]         = useState(hoy.getMonth() + 1)
  const [anio, setAnio]       = useState(hoy.getFullYear())
  const [tipo, setTipo]       = useState<TipoPeriodo>('mensual')
  const [quincena, setQuincena] = useState<1 | 2>(1)
  const [detalle, setDetalle] = useState<{ emp: Empleado; nom: ResultadoNomina } | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  const { empleadosActivos }            = useEmpleados()
  const { periodos, generar, cerrar, eliminar } = usePeriodos()

  const nominas = empleadosActivos.map(e => ({
    empleado: e,
    resultado: tipo === 'quincenal'
      ? calcularNominaQuincenal(e, quincena)
      : calcularNomina(e),
  }))

  const totales = {
    bruto:      nominas.reduce((s, n) => s + n.resultado.totalBruto, 0),
    descuentos: nominas.reduce((s, n) => s + n.resultado.totalDescuentos, 0),
    neto:       nominas.reduce((s, n) => s + n.resultado.salarioNeto, 0),
    aportes:    nominas.reduce((s, n) => s + n.resultado.totalAportesEmpleador, 0),
    isr:        nominas.reduce((s, n) => s + n.resultado.isrMensual, 0),
    costoTotal: nominas.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  const periodoLabel = tipo === 'quincenal'
    ? `${quincena === 1 ? '1ª' : '2ª'} Quincena — ${formatPeriodo(anio, mes)}`
    : formatPeriodo(anio, mes)

  function handleExportar() {
    const headers = ['Empleado', 'Cargo', 'Departamento', 'S. Bruto', 'AFP Emp', 'SFS Emp', 'ISR', 'Total Desc.', 'S. Neto', 'AFP Empr', 'SFS Empr', 'SRL', 'Costo Total']
    const rows = nominas.map(({ empleado, resultado }) => [
      fullName(empleado),
      empleado.cargo,
      empleado.departamento,
      resultado.totalBruto.toFixed(2),
      resultado.afpEmpleado.toFixed(2),
      resultado.sfsEmpleado.toFixed(2),
      resultado.isrMensual.toFixed(2),
      resultado.totalDescuentos.toFixed(2),
      resultado.salarioNeto.toFixed(2),
      resultado.afpEmpleador.toFixed(2),
      resultado.sfsEmpleador.toFixed(2),
      resultado.srlEmpleador.toFixed(2),
      resultado.totalCostoEmpleador.toFixed(2),
    ])
    const slug = periodoLabel.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    exportarCSV(`nomina-${slug}.csv`, headers, rows)
    setToast('Nómina exportada correctamente')
  }

  function handleGenerar() {
    generar({
      tipo,
      quincena: tipo === 'quincenal' ? quincena : undefined,
      mes, anio,
      estado: 'procesada',
      totalEmpleados: empleadosActivos.length,
      totales,
    })
    setToast(`Nómina "${periodoLabel}" generada correctamente`)
  }

  const anios = [anio - 1, anio, anio + 1]

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Procesar Nómina"
        subtitle={`Período: ${periodoLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setToast('Preparando documento para imprimir…')}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Period selector ── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-3 shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center gap-3">

            {/* Tipo toggle */}
            <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840] shrink-0">
              {(['mensual', 'quincenal'] as TipoPeriodo[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    tipo === t
                      ? 'bg-[#1B2980] text-white'
                      : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                  }`}
                >
                  {t === 'mensual' ? 'Mensual' : 'Quincenal'}
                </button>
              ))}
            </div>

            {/* Month + Year */}
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
            >
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
            >
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {/* Quincena selector */}
            {tipo === 'quincenal' && (
              <select
                value={quincena}
                onChange={e => setQuincena(Number(e.target.value) as 1 | 2)}
                className="rounded-lg border border-violet-300 dark:border-violet-700/60 bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              >
                <option value={1}>1ª Quincena (1–15)</option>
                <option value={2}>2ª Quincena (16–fin)</option>
              </select>
            )}

            <Badge variant="success" className="shrink-0">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Calculada
            </Badge>

            <div className="ml-auto shrink-0">
              <button
                onClick={handleGenerar}
                className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                Generar Nómina
              </button>
            </div>
          </div>

          {tipo === 'quincenal' && (
            <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {quincena === 1
                ? '1ª quincena: anticipo sin ISR. El ISR mensual completo se liquida en la 2ª quincena.'
                : '2ª quincena: incluye el ISR mensual completo del período.'}
            </p>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Bruto"
            value={formatRD(totales.bruto, 0)}
            sub="Suma devengados"
            icon={Wallet}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Total Neto"
            value={formatRD(totales.neto, 0)}
            sub="A transferir empleados"
            icon={BarChart3}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Aportes TSS Empresa"
            value={formatRD(totales.aportes, 0)}
            sub="AFP + SFS + SRL"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="ISR Retenido"
            value={formatRD(totales.isr, 0)}
            sub={tipo === 'quincenal' && quincena === 1 ? 'Anticipo — sin ISR' : 'Por remitir a DGII'}
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          />
        </div>

        {/* ── Tabla empleados ── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle por Empleado — {periodoLabel}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Info className="h-3.5 w-3.5" />
              Haz clic en una fila para ver el comprobante
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AFP Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">SFS Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ISR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">T. Desc.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 bg-[#eef0fb] dark:bg-indigo-950/40">S. Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Emp.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {nominas.map(({ empleado, resultado }) => (
                  <tr
                    key={empleado.id}
                    className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                    onClick={() => setDetalle({ emp: empleado, nom: resultado })}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d5d9f4] dark:bg-indigo-900/40 text-xs font-bold text-[#151f66] dark:text-indigo-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{empleado.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{formatRD(resultado.totalBruto, 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatRD(resultado.afpEmpleado, 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatRD(resultado.sfsEmpleado, 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-violet-700 dark:text-violet-400">
                      {resultado.isrMensual === 0 ? <span className="text-zinc-300 dark:text-zinc-600">—</span> : formatRD(resultado.isrMensual, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-800 dark:text-rose-400 font-medium">{formatRD(resultado.totalDescuentos, 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#151f66] dark:text-indigo-300 bg-[#eef0fb]/60 dark:bg-indigo-950/30">{formatRD(resultado.salarioNeto, 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatRD(resultado.totalCostoEmpleador, 0)}</td>
                    <td className="px-4 py-3.5"><ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-[#252840] bg-zinc-950 dark:bg-[#0a0c14] text-white">
                  <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">
                    TOTALES — {empleadosActivos.length} empleados
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold">{formatRD(totales.bruto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300">{formatRD(nominas.reduce((s,n) => s + n.resultado.afpEmpleado, 0), 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300">{formatRD(nominas.reduce((s,n) => s + n.resultado.sfsEmpleado, 0), 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-violet-300">{formatRD(totales.isr, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300 font-semibold">{formatRD(totales.descuentos, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-indigo-300">{formatRD(totales.neto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-amber-300 font-bold">{formatRD(totales.costoTotal, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Nota legal ── */}
        <div className="rounded-xl border border-teal-100 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-0.5">
              <p className="font-semibold">Normativa aplicada</p>
              <p>AFP 2.87% emp / 7.10% empr · SFS 3.04% emp / 7.09% empr · SRL 1.10% empr · Tope TSS RD$420,000</p>
              {tipo === 'quincenal'
                ? <p>Quincenal: 1ª quincena = anticipo sin ISR · 2ª quincena = ISR mensual completo liquidado · Ley 11-92 Art. 309</p>
                : <p>ISR calculado sobre base anual según tramos DGII vigentes · Ley 11-92 Art. 309</p>
              }
            </div>
          </div>
        </div>

        {/* ── Historial ── */}
        {periodos.length > 0 && (
          <HistorialTable periodos={periodos} cerrar={cerrar} eliminar={eliminar} />
        )}

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {detalle && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm" />
          <DetalleNomina
            empleado={detalle.emp}
            nomina={detalle.nom}
            periodoLabel={periodoLabel}
            onClose={() => setDetalle(null)}
          />
        </>
      )}
    </div>
  )
}
