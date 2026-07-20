'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { useRetribuciones } from '@/lib/retribuciones-context'
import { TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES, fechaLimiteIR17 } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName } from '@/lib/utils'
import {
  Landmark, Percent, CalendarClock, Plus, Trash2, Info, Download,
  ChevronLeft, ChevronRight, CheckCircle2, Undo2, History,
} from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Categorías genéricas de beneficios en especie más comunes en la práctica dominicana
const CATEGORIAS_RETRIBUCION = [
  'Vehículo de la empresa',
  'Vivienda',
  'Colegios / Educación',
  'Otros beneficios en especie',
] as const

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

const hoy = new Date()

export default function RetribucionesComplementariasPage() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa } = useEmpresa()
  const { retribuciones, agregar, eliminar, marcarDeclarado, desmarcarDeclarado } = useRetribuciones()

  const [mesSel, setMesSel] = useState(hoy.getMonth() + 1)
  const [anioSel, setAnioSel] = useState(hoy.getFullYear())

  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [concepto, setConcepto] = useState<string>(CATEGORIAS_RETRIBUCION[0])
  const [valorMensual, setValorMensual] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  function cambiarMes(delta: number) {
    let m = mesSel + delta
    let a = anioSel
    if (m > 12) { m = 1; a += 1 }
    if (m < 1) { m = 12; a -= 1 }
    setMesSel(m)
    setAnioSel(a)
  }

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(valorMensual) || 0
    if (valor <= 0) return
    agregar(mesSel, anioSel, concepto, valor, empleadoId || undefined)
    setValorMensual('')
  }

  function handleEliminar(id: string) {
    eliminar(id)
  }

  const lineasDelMes = useMemo(
    () => retribuciones.filter(r => r.mes === mesSel && r.anio === anioSel).sort((a, b) => a.id.localeCompare(b.id)),
    [retribuciones, mesSel, anioSel]
  )

  const totalMensual = lineasDelMes.reduce((s, l) => s + l.valorMensual, 0)
  const impuestoMensual = totalMensual * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES
  const impuestoAnualizado = impuestoMensual * 12

  const declarado = lineasDelMes.length > 0 && lineasDelMes.every(l => l.declarada)
  const fechaDeclaracionMes = declarado ? lineasDelMes[0]?.fechaDeclaracion : undefined
  const limiteIR17 = fechaLimiteIR17(mesSel, anioSel)
  const diasRestantes = Math.ceil((limiteIR17.getTime() - hoy.getTime()) / (1000 * 3600 * 24))

  function handleMarcarDeclarado() {
    marcarDeclarado(mesSel, anioSel, hoy.toISOString().split('T')[0])
    setToast(`Declaración IR-17 de ${MESES[mesSel - 1]} ${anioSel} marcada como sometida`)
  }

  function handleDesmarcarDeclarado() {
    desmarcarDeclarado(mesSel, anioSel)
    setToast('Declaración revertida a pendiente')
  }

  // ── Historial de meses — agrupa TODAS las líneas registradas, sin importar
  // el mes en vista, para dar una vista consolidada de cumplimiento mensual.
  const historialMeses = useMemo(() => {
    const grupos = new Map<string, { mes: number; anio: number; total: number; declarada: boolean; fecha?: string }>()
    for (const r of retribuciones) {
      const key = `${r.anio}-${r.mes}`
      const g = grupos.get(key) ?? { mes: r.mes, anio: r.anio, total: 0, declarada: true }
      g.total += r.valorMensual
      if (!r.declarada) g.declarada = false
      else if (!g.fecha) g.fecha = r.fechaDeclaracion
      grupos.set(key, g)
    }
    return Array.from(grupos.values()).sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))
  }, [retribuciones])

  async function handleExportarExcel() {
    if (retribuciones.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasDetalle = lineasDelMes.map(l => [
      l.concepto,
      l.empleadoId && empMap[l.empleadoId] ? fullName(empMap[l.empleadoId]) : 'General / sin asignar',
      l.valorMensual,
      l.valorMensual * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES,
    ])
    const filasHistorial = historialMeses.map(g => [
      `${MESES[g.mes - 1]} ${g.anio}`,
      g.total,
      g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES,
      g.declarada ? `Declarado${g.fecha ? ` (${formatDate(g.fecha)})` : ''}` : 'Pendiente',
    ])
    await exportarExcel({
      nombreArchivo: `retribuciones-complementarias-${anioSel}-${String(mesSel).padStart(2, '0')}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [
        {
          nombre: 'Detalle',
          titulo: `Retribuciones Complementarias — ${MESES[mesSel - 1]} ${anioSel}`,
          subtitulo: `Impuesto Sustitutivo 27% — Formulario IR-17 — límite ${formatDate(limiteIR17.toISOString())}`,
          encabezados: ['Concepto', 'Empleado', 'Valor Mensual (RD$)', 'Impuesto Sustitutivo 27%'],
          filas: filasDetalle,
          totales: [`TOTAL — ${lineasDelMes.length} concepto(s)`, '', totalMensual, impuestoMensual],
          anchos: [30, 26, 20, 22],
        },
        {
          nombre: 'Historial Mensual',
          titulo: 'Historial de Declaraciones IR-17',
          subtitulo: 'Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII',
          encabezados: ['Mes', 'Valor Total (RD$)', 'Impuesto Sustitutivo 27%', 'Estado'],
          filas: filasHistorial,
          anchos: [20, 20, 22, 26],
        },
      ],
    })
    setToast('Retribuciones complementarias exportadas a Excel')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Retribuciones Complementarias"
        subtitle="Impuesto Sustitutivo 27% · Formulario IR-17 · Guía DGII"
        actions={
          <button
            onClick={handleExportarExcel}
            disabled={retribuciones.length === 0}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Selector de mes + estado de declaración ─────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-5 py-3.5 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => cambiarMes(-1)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {MESES[mesSel - 1]} {anioSel}
            </span>
            <button
              onClick={() => cambiarMes(1)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {declarado ? (
              <>
                <Badge variant="success">
                  Declarado{fechaDeclaracionMes ? ` — ${formatDate(fechaDeclaracionMes)}` : ''}
                </Badge>
                <button
                  onClick={handleDesmarcarDeclarado}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                >
                  <Undo2 className="h-3.5 w-3.5" /> deshacer
                </button>
              </>
            ) : (
              <>
                <Badge variant={diasRestantes < 0 ? 'danger' : diasRestantes <= 10 ? 'warning' : 'neutral'}>
                  {diasRestantes < 0
                    ? `IR-17 vencido hace ${Math.abs(diasRestantes)} día(s)`
                    : `IR-17 vence en ${diasRestantes} día(s)`}
                </Badge>
                <button
                  onClick={handleMarcarDeclarado}
                  disabled={lineasDelMes.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1B2980] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como Declarado (IR-17)
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Form: registrar nueva retribución ──────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Registrar Retribución — {MESES[mesSel - 1]} {anioSel}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Registre el valor mensual de cada beneficio en especie otorgado (vehículo, vivienda, colegios, etc.)
              para calcular el Impuesto Sustitutivo que asume la empresa.
            </p>
          </div>
          <div className="px-5 py-4">
            <form onSubmit={handleAgregar} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="flex-[2] min-w-[200px] space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Concepto
                </label>
                <select value={concepto} onChange={e => setConcepto(e.target.value)} className={INPUT_CLASS}>
                  {CATEGORIAS_RETRIBUCION.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-[2] min-w-[200px] space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Empleado beneficiario (opcional)
                </label>
                <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} className={INPUT_CLASS}>
                  <option value="">— General / sin asignar —</option>
                  {empleadosActivos.map(e => (
                    <option key={e.id} value={e.id}>{fullName(e)} — {e.cargo}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Valor Mensual (RD$)
                </label>
                <input
                  type="number"
                  min="0"
                  value={valorMensual}
                  onChange={e => setValorMensual(e.target.value)}
                  placeholder="0.00"
                  className={INPUT_CLASS}
                />
              </div>
              <button
                type="submit"
                disabled={!(parseFloat(valorMensual) > 0)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </form>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                El empleado beneficiario es solo de referencia interna: el Impuesto Sustitutivo lo paga la empresa y
                no cambia según quién reciba el beneficio.
              </span>
            </p>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Retribuciones (Mensual)"
            value={formatRD(totalMensual)}
            sub={`${lineasDelMes.length} concepto(s) registrado(s)`}
            icon={Landmark}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Impuesto Sustitutivo (27%)"
            value={formatRD(impuestoMensual)}
            sub="Sobre el valor mensual de los beneficios"
            icon={Percent}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="Impuesto Anualizado (referencia)"
            value={formatRD(impuestoAnualizado)}
            sub="Impuesto mensual × 12 — para presupuesto"
            icon={CalendarClock}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle de Retribuciones — {MESES[mesSel - 1]} {anioSel}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concepto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Mensual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Impuesto Sustitutivo (27%)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {lineasDelMes.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <Landmark className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                          Sin retribuciones registradas en {MESES[mesSel - 1]} {anioSel}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                          Agregue arriba el valor mensual de cada beneficio en especie (vehículo, vivienda, colegios,
                          etc.) para calcular el Impuesto Sustitutivo de este mes.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {lineasDelMes.map(l => {
                  const emp = l.empleadoId ? empMap[l.empleadoId] : undefined
                  return (
                    <tr key={l.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">{l.concepto}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {emp ? fullName(emp) : <span className="text-zinc-300 dark:text-zinc-600">General / sin asignar</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(l.valorMensual)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(l.valorMensual * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleEliminar(l.id)}
                          className="rounded-lg p-1.5 text-zinc-300 dark:text-zinc-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {lineasDelMes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                    <td colSpan={2} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      TOTAL — {lineasDelMes.length} concepto(s)
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-600 dark:text-zinc-400">
                      {formatRD(totalMensual)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                      {formatRD(impuestoMensual)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Historial de meses ───────────────────────────────────────── */}
        {historialMeses.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Historial de Declaraciones IR-17</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mes</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Impuesto (27%)</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {historialMeses.map(g => (
                    <tr
                      key={`${g.anio}-${g.mes}`}
                      className={
                        g.mes === mesSel && g.anio === anioSel
                          ? 'bg-[#eef0fb]/50 dark:bg-indigo-950/20'
                          : 'hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors'
                      }
                    >
                      <td className="px-5 py-3 font-medium text-zinc-700 dark:text-zinc-300">{MESES[g.mes - 1]} {g.anio}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(g.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {g.declarada
                          ? <Badge variant="success">Declarado{g.fecha ? ` — ${formatDate(g.fecha)}` : ''}</Badge>
                          : <Badge variant="warning">Pendiente</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setMesSel(g.mes); setAnioSel(g.anio) }}
                          className="text-xs font-semibold text-[#1B2980] dark:text-indigo-400 hover:underline"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Legal note ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1.5">
              <p className="font-semibold">Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII, República Dominicana</p>
              <p>
                Las <strong>Retribuciones Complementarias</strong> son beneficios en especie que el empleador otorga
                a determinados empleados (típicamente ejecutivos) además de su salario — uso de vehículo de la
                empresa, vivienda, colegios u otros beneficios similares. La DGII grava el valor de estos beneficios
                con un <strong>Impuesto Sustitutivo del 27%</strong> que <strong>paga la empresa</strong>, en lugar de
                sumarlos al salario del empleado y tributar el ISR progresivo normal.
              </p>
              <p>
                Este impuesto <strong>no se descuenta al empleado ni se combina con el ISR regular de su salario</strong> —
                es una obligación tributaria independiente de la empresa. Se declara y paga mensualmente mediante el{' '}
                <strong>Formulario IR-17</strong> ("Otras Retenciones y Retribuciones Complementarias") vía la Oficina
                Virtual de la DGII, <strong>a más tardar el día 10 de cada mes</strong>, junto con las demás
                retenciones del mes (si el día 10 cae fin de semana, se traslada al siguiente día hábil).
              </p>
              <p>
                Declarar fuera de plazo genera recargo por mora (10% el primer mes o fracción, 4% progresivo por cada
                mes adicional) más 1.10% de interés indemnizatorio acumulativo por mes o fracción sobre el monto a
                pagar. Base legal: Código Tributario, Ley No. 11-92, modificada por las Leyes No. 557-05, 139-11 y
                253-12. Consulte la guía oficial de la DGII (dgii.gov.do) para confirmar el tratamiento aplicable a
                cada tipo de beneficio antes de declarar.
              </p>
            </div>
          </div>
        </div>

      </div>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  )
}
