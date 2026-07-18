'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { getAnosServicio } from '@/lib/dominican-labor'
import { resultadoBonificacion } from '@/lib/nomina-shared'
import { formatRD, formatAnosServicio, fullName, BTN_PRIMARY, cn } from '@/lib/utils'
import {
  Percent, Users, Banknote, Info, Download, Send, Pencil, Check, X,
  ArrowRight, CheckCircle2, History,
} from 'lucide-react'
import type { PeriodoNomina } from '@/types'

// Tarifa diaria estándar del sistema (salario mensual / 23.83 días)
const DIAS_MES = 23.83

const hoy = new Date()
const anioActualDefault = hoy.getFullYear()
const ANIOS_FISCALES = Array.from({ length: 12 }, (_, i) => anioActualDefault - 10 + i)

export default function BonificacionPage() {
  const { empleadosActivos } = useEmpleados()
  const { empresa } = useEmpresa()
  const { periodos, generar } = usePeriodos()
  const [utilidadNeta, setUtilidadNeta] = useState<string>('')
  const [anioFiscal, setAnioFiscal] = useState(anioActualDefault)
  const [toast, setToast] = useState<string | null>(null)

  const utilidad = parseFloat(utilidadNeta) || 0
  const distribuible = utilidad * 0.10

  // Elegibles: empleados de tiempo indefinido (fijo)
  const elegibles = useMemo(
    () => empleadosActivos.filter(e => e.tipoContrato === 'fijo'),
    [empleadosActivos]
  )

  const totalSalarios = elegibles.reduce((s, e) => s + e.salarioBase, 0)

  const filas = useMemo(() => {
    return elegibles.map(e => {
      const anos = getAnosServicio(e.fechaIngreso)
      const diasTope = anos >= 3 ? 60 : 45
      const salarioDiario = e.salarioBase / DIAS_MES
      const topeIndividual = diasTope * salarioDiario
      const proporcional = totalSalarios > 0 ? (e.salarioBase / totalSalarios) * distribuible : 0
      const montoFinal = Math.min(proporcional, topeIndividual)
      const topeAplicado = proporcional > topeIndividual
      return { empleado: e, anos, diasTope, salarioDiario, topeIndividual, proporcional, montoFinal, topeAplicado }
    }).sort((a, b) => b.montoFinal - a.montoFinal)
  }, [elegibles, totalSalarios, distribuible])

  const totalRepartido = filas.reduce((s, f) => s + f.montoFinal, 0)
  const empleadosConTope = filas.filter(f => f.topeAplicado).length

  // ── Solicitar Liquidación de Bonificación ───────────────────────────────────
  // Igual mecanismo que Regalía Pascual: crea un período especial en Nómina
  // con el monto bruto de cada empleado ya congelado. A diferencia de
  // Regalía, sí lleva AFP/SFS/ISR reales — los totales del período se
  // calculan con resultadoBonificacion() (motor real de nómina), no con un
  // resultado sintético en cero.
  //
  // Solo bloquea una nueva solicitud mientras el período del año fiscal
  // elegido sigue en_proceso/procesada en Nómina — una vez cerrado (pagado),
  // se puede solicitar la liquidación de otro año sin problema.
  const periodoBonifAnio = periodos.find(p => p.tipo === 'bonificacion' && p.anio === anioFiscal)
  const periodoBonifExistente = periodoBonifAnio?.estado !== 'cerrada' ? periodoBonifAnio : undefined

  const historialBonificacion = periodos
    .filter(p => p.tipo === 'bonificacion' && p.estado === 'cerrada')
    .sort((a, b) => b.anio - a.anio)

  const [solicitudAbierta, setSolicitudAbierta] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, { monto: number; motivo: string }>>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [montoEdit, setMontoEdit] = useState('')
  const [motivoEdit, setMotivoEdit] = useState('')
  const [periodoCreado, setPeriodoCreado] = useState<PeriodoNomina | null>(null)

  function abrirSolicitud() {
    setOverrides({})
    setEditandoId(null)
    setPeriodoCreado(null)
    setSolicitudAbierta(true)
  }

  function montoDe(empId: string, montoCalculado: number): number {
    return overrides[empId]?.monto ?? montoCalculado
  }

  function abrirEdicion(empId: string, montoActual: number) {
    setEditandoId(empId)
    setMontoEdit(String(Math.round(montoActual * 100) / 100))
    setMotivoEdit(overrides[empId]?.motivo ?? '')
  }

  function guardarEdicion(empId: string) {
    const monto = parseFloat(montoEdit)
    if (isNaN(monto) || monto < 0 || !motivoEdit.trim()) return
    setOverrides(prev => ({ ...prev, [empId]: { monto, motivo: motivoEdit.trim() } }))
    setEditandoId(null)
  }

  function quitarEdicion(empId: string) {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[empId]
      return next
    })
  }

  function confirmarSolicitud() {
    const montosBonificacion: Record<string, number> = {}
    const motivosAjusteBonificacion: Record<string, string> = {}
    let totalBruto = 0, totalDescuentos = 0, totalNeto = 0, totalAportes = 0, totalIsr = 0, totalCosto = 0
    for (const f of filas) {
      const monto = montoDe(f.empleado.id, f.montoFinal)
      if (monto <= 0) continue
      const montoRedondeado = Math.round(monto * 100) / 100
      montosBonificacion[f.empleado.id] = montoRedondeado
      const ov = overrides[f.empleado.id]
      if (ov) motivosAjusteBonificacion[f.empleado.id] = ov.motivo
      const r = resultadoBonificacion(f.empleado, montoRedondeado)
      totalBruto += r.totalBruto
      totalDescuentos += r.totalDescuentos
      totalNeto += r.salarioNeto
      totalAportes += r.totalAportesEmpleador
      totalIsr += r.isrMensual
      totalCosto += r.totalCostoEmpleador
    }
    const totalEmpleados = Object.keys(montosBonificacion).length
    if (totalEmpleados === 0) return
    const nuevo = generar({
      tipo: 'bonificacion',
      mes: hoy.getMonth() + 1,
      anio: anioFiscal,
      estado: 'en_proceso',
      totalEmpleados,
      totales: {
        bruto: Math.round(totalBruto * 100) / 100,
        descuentos: Math.round(totalDescuentos * 100) / 100,
        neto: Math.round(totalNeto * 100) / 100,
        aportes: Math.round(totalAportes * 100) / 100,
        isr: Math.round(totalIsr * 100) / 100,
        costoTotal: Math.round(totalCosto * 100) / 100,
      },
      montosBonificacion,
      ...(Object.keys(motivosAjusteBonificacion).length > 0 ? { motivosAjusteBonificacion } : {}),
    })
    setPeriodoCreado(nuevo)
  }

  // Exporta exactamente las mismas filas ya calculadas para la tabla en
  // pantalla (mismo desglose, mismo total). Carga la librería bajo demanda.
  async function handleExportarExcel() {
    if (filas.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasExcel = filas.map(({ empleado, anos, diasTope, proporcional, montoFinal }) => [
      fullName(empleado),
      formatAnosServicio(anos),
      empleado.salarioBase,
      diasTope,
      proporcional,
      montoFinal,
    ])
    await exportarExcel({
      nombreArchivo: `bonificacion-utilidades-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Bonificación',
        titulo: 'Bonificación por Participación en Utilidades',
        subtitulo: `Art. 223 · Utilidad Neta: ${formatRD(utilidad)} · 10% Distribuible: ${formatRD(distribuible)}`,
        encabezados: ['Empleado', 'Antigüedad', 'Salario Base', 'Tope (días)', 'Proporcional', 'Monto a Pagar'],
        filas: filasExcel,
        totales: [
          `TOTAL — ${filas.length} empleado(s)`, '', '',
          '', filas.reduce((s, f) => s + f.proporcional, 0), totalRepartido,
        ],
        anchos: [26, 16, 16, 14, 16, 18],
        columnasEnteras: [3],
      }],
    })
    setToast('Bonificación por utilidades exportada a Excel')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Bonificación por Utilidades"
        subtitle="Art. 223 · Código de Trabajo · Ley 16-92"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportarExcel}
              disabled={filas.length === 0}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
            {periodoBonifExistente ? (
              <Link
                href="/nomina"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Liquidación {anioFiscal} en Nómina
              </Link>
            ) : (
              <button
                onClick={abrirSolicitud}
                disabled={totalRepartido <= 0}
                className={cn(BTN_PRIMARY, 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none')}
              >
                <Send className="h-4 w-4" />
                Solicitar Liquidación
              </button>
            )}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {periodoBonifExistente && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-3.5 text-sm">
            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Ya se solicitó la liquidación de Bonificación por Utilidades {anioFiscal} — continúa el pago desde Nómina.
            </div>
            <Link href="/nomina" className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              Ir a Nómina <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ── Input card ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Utilidad Neta Anual</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Ingrese la utilidad neta anual de la empresa para calcular el 10% distribuible entre los empleados
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="max-w-xs space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Utilidad Neta Anual (RD$)
                </label>
                <input
                  type="number"
                  min="0"
                  value={utilidadNeta}
                  onChange={e => setUtilidadNeta(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="w-32 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Año Fiscal
                </label>
                <select
                  value={anioFiscal}
                  onChange={e => setAnioFiscal(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none"
                >
                  {ANIOS_FISCALES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="10% Distribuible"
            value={formatRD(distribuible)}
            sub="Utilidad neta × 10% (Art. 223)"
            icon={Percent}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Total a Repartir"
            value={formatRD(totalRepartido)}
            sub={`${filas.length} empleado(s) de tiempo indefinido`}
            icon={Banknote}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Empleados con Tope Aplicado"
            value={`${empleadosConTope} / ${filas.length}`}
            sub="45 días (menos de 3 años) · 60 días (3+ años)"
            icon={Users}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Distribución por Empleado</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Reparto proporcional al salario, respetando el tope individual de 45 días (menos de 3 años) o 60 días (3+ años) de salario diario.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Base</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tope (días)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Proporcional</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <Percent className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                          {empleadosActivos.length === 0 ? 'Sin empleados activos' : 'Sin empleados elegibles'}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                          {empleadosActivos.length === 0
                            ? 'Registra empleados en la sección de Empleados para calcular la bonificación.'
                            : 'Solo los empleados de contrato Fijo (tiempo indefinido) tienen derecho a esta bonificación.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.map(({ empleado, anos, diasTope, topeIndividual, proporcional, montoFinal, topeAplicado }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef0fb] dark:bg-indigo-900/40 text-xs font-bold text-[#1B2980] dark:text-indigo-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">{empleado.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(empleado.salarioBase)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {diasTope} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(proporcional)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                      <div className="flex items-center justify-end gap-1.5">
                        {formatRD(montoFinal)}
                        {topeAplicado && <Badge variant="warning">Tope</Badge>}
                      </div>
                      {topeAplicado && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">
                          Tope: {formatRD(topeIndividual)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={4} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                    TOTAL — {filas.length} empleado(s)
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-600 dark:text-zinc-400">
                    {formatRD(filas.reduce((s, f) => s + f.proporcional, 0))}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                    {formatRD(totalRepartido)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Historial de liquidaciones ───────────────────────────────── */}
        {historialBonificacion.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <History className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bonificaciones Liquidadas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Año Fiscal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Bruto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Neto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de Pago</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {historialBonificacion.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{p.anio}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{p.totalEmpleados}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(p.totales.bruto)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">{formatRD(p.totales.neto)}</td>
                      <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400">{p.pagada && p.fechaPago ? p.fechaPago : '—'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href="/nomina" className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline">
                          Ver en Nómina
                        </Link>
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
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1">
              <p className="font-semibold">Art. 223 — Código de Trabajo, República Dominicana</p>
              <p>
                El empleador debe repartir el <strong>10% de sus utilidades netas anuales</strong> entre los empleados
                de tiempo indefinido, con un tope individual de <strong>45 días de salario</strong> (empleados con menos
                de 3 años en la empresa) o <strong>60 días de salario</strong> (empleados con 3 años o más de antigüedad).
                Esta bonificación es distinta de la Regalía Pascual (Art. 219). A diferencia de esta última, la
                Bonificación por Utilidades sí es salario ordinario a efectos fiscales — lleva AFP, SFS e ISR normales.
              </p>
            </div>
          </div>
        </div>

      </div>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}

      {solicitudAbierta && (() => {
        const filasSolicitud = filas.filter(f => montoDe(f.empleado.id, f.montoFinal) > 0 || overrides[f.empleado.id])
        const totalSolicitud = filasSolicitud.reduce((s, f) => s + montoDe(f.empleado.id, f.montoFinal), 0)

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
              onClick={() => setSolicitudAbierta(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
                {periodoCreado ? (
                  <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Liquidación solicitada</p>
                    <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                      Se creó el período <strong>Bonificación Utilidades {anioFiscal}</strong> en Nómina con{' '}
                      {periodoCreado.totalEmpleados} empleado(s) por un total bruto de {formatRD(periodoCreado.totales.bruto)}{' '}
                      ({formatRD(periodoCreado.totales.neto)} neto, con AFP/SFS/ISR ya aplicados).
                    </p>
                    <Link
                      href="/nomina"
                      className={cn(BTN_PRIMARY, 'mt-6')}
                    >
                      Ir a Nómina a procesar el pago <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                      <div className="flex items-center gap-2">
                        <Percent className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Solicitar Liquidación de Bonificación {anioFiscal}
                        </h2>
                      </div>
                      <button onClick={() => setSolicitudAbierta(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Esto crea un período especial en Nómina con el monto bruto de cada empleado ya congelado
                        (con AFP/SFS/ISR calculados al procesar), listo para pagar. Puedes ajustar manualmente el
                        monto de un empleado antes de confirmar (motivo obligatorio) — útil si hace falta un ajuste puntual.
                      </p>

                      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                              <th className="px-3 py-2 font-medium">Empleado</th>
                              <th className="px-3 py-2 font-medium text-right">Monto Bruto a Liquidar</th>
                              <th className="px-3 py-2 font-medium text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                            {filasSolicitud.map(({ empleado, montoFinal }) => {
                              const monto = montoDe(empleado.id, montoFinal)
                              const ov = overrides[empleado.id]
                              const editando = editandoId === empleado.id
                              return (
                                <tr key={empleado.id}>
                                  <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                                    {fullName(empleado)}
                                    {ov && (
                                      <p className="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400" title={ov.motivo}>
                                        Ajustado: {ov.motivo}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {editando ? (
                                      <input
                                        type="number"
                                        autoFocus
                                        value={montoEdit}
                                        onChange={e => setMontoEdit(e.target.value)}
                                        className="w-28 rounded-md border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#0d0f1a] dark:text-zinc-200 px-2 py-1 text-right text-xs focus:border-[#1B2980] focus:outline-none"
                                      />
                                    ) : (
                                      <span className={`tabular-nums font-semibold ${ov ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        {formatRD(monto)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {editando ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <input
                                          type="text"
                                          placeholder="Motivo del ajuste (obligatorio)"
                                          value={motivoEdit}
                                          onChange={e => setMotivoEdit(e.target.value)}
                                          className="w-40 rounded-md border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#0d0f1a] dark:text-zinc-200 px-2 py-1 text-xs focus:border-[#1B2980] focus:outline-none"
                                        />
                                        <button
                                          onClick={() => guardarEdicion(empleado.id)}
                                          disabled={!motivoEdit.trim() || montoEdit === '' || isNaN(parseFloat(montoEdit))}
                                          title="Guardar"
                                          className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setEditandoId(null)}
                                          title="Cancelar"
                                          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e]"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => abrirEdicion(empleado.id, monto)}
                                          title="Ajustar manualmente"
                                          className="rounded-md p-1 text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {ov && (
                                          <button
                                            onClick={() => quitarEdicion(empleado.id)}
                                            title="Quitar ajuste manual"
                                            className="rounded-md p-1 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {filasSolicitud.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-zinc-400 dark:text-zinc-500">
                                  Ningún empleado tiene monto por liquidar todavía.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-[#eef0fb] dark:bg-indigo-950/20 px-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-300">Total Bruto a Liquidar</span>
                        <span className="text-base font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">{formatRD(totalSolicitud)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                      <button
                        onClick={() => setSolicitudAbierta(false)}
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmarSolicitud}
                        disabled={filasSolicitud.length === 0}
                        className={cn(BTN_PRIMARY, 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none')}
                      >
                        <Send className="h-4 w-4" />
                        Confirmar y Crear Período
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
