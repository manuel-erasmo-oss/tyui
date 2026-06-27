'use client'

import { useState, useEffect } from 'react'
import {
  ChevronRight,
  Download,
  Lock,
  Trash2,
  ArrowLeft,
  Plus,
  X,
  Info,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
  PlayCircle,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos } from '@/lib/periodos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { calcularNomina, calcularNominaQuincenal, cuotaDependienteSFS } from '@/lib/dominican-labor'
import { formatRD, fullName } from '@/lib/utils'
import type {
  Empleado,
  ResultadoNomina,
  PeriodoNomina,
  TipoPeriodo,
  ParametrosNomina,
  ConceptoAjuste,
  AjusteLinea,
} from '@/types'
import { Wallet, TrendingUp, Receipt, BarChart3 } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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

// ── Label helpers ─────────────────────────────────────────────────────────────
function labelPeriodo(p: PeriodoNomina): string {
  const mes = MESES[p.mes - 1]
  if (p.tipo === 'quincenal') {
    return `${p.quincena === 1 ? '1ª' : '2ª'} Quincena · ${mes} ${p.anio}`
  }
  return `${mes} ${p.anio}`
}

function labelConcepto(concepto: ConceptoAjuste): string {
  const map: Record<ConceptoAjuste, string> = {
    horas_extras_35:  'H.E. 35%',
    horas_extras_100: 'H.E. 100%',
    comision:         'Comisión',
    bono:             'Bono',
    prestamo:         'Préstamo',
    dependiente_sfs:  'Dep. SFS',
    otro_ingreso:     'Otro Ingreso',
    otro_descuento:   'Otro Desc.',
  }
  return map[concepto]
}

function isHorasConcepto(concepto: ConceptoAjuste): boolean {
  return concepto === 'horas_extras_35' || concepto === 'horas_extras_100'
}

// ── calcularConAjustes ────────────────────────────────────────────────────────
function calcularConAjustes(
  empleado: Empleado,
  ajustes: AjusteLinea[],
  tipo: TipoPeriodo,
  quincena: 1 | 2,
): ResultadoNomina {
  const horasExtras35  = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a) => s + a.valor, 0)
  const horasExtras100 = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
  const bonificaciones = ajustes.filter(a => a.concepto === 'bono' || a.concepto === 'otro_ingreso').reduce((s, a) => s + a.valor, 0)
  const comisiones     = ajustes.filter(a => a.concepto === 'comision').reduce((s, a) => s + a.valor, 0)
  const otrosDescuentos = ajustes.filter(a => a.concepto === 'prestamo' || a.concepto === 'dependiente_sfs' || a.concepto === 'otro_descuento').reduce((s, a) => s + a.valor, 0)
  const params: ParametrosNomina = { horasExtras35, horasExtras100, bonificaciones, comisiones, otrosDescuentos }
  return tipo === 'quincenal'
    ? calcularNominaQuincenal(empleado, quincena, params)
    : calcularNomina(empleado, params)
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
        className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-xl bg-zinc-950 dark:bg-[#080a12] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Comprobante · {periodoLabel}
            </p>
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">Descuentos</p>
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
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  ISR: anticipo de quincena (se liquida en 2ª quincena)
                </p>
              )}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Descuentos</span>
                <span className="text-rose-700 dark:text-rose-400 tabular-nums">({formatRD(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] p-6 rounded-b-xl">
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NominaPage() {
  const { empleadosActivos } = useEmpleados()
  const { periodos, generar, cerrar, eliminar, actualizarAjustes, marcarProcesados } = usePeriodos()
  const { empresa } = useEmpresa()
  const { getPrestamosActivos, registrarPago } = usePrestamos()

  // View state
  const [periodoAbierto, setPeriodoAbierto] = useState<string | null>(null)

  // Create period form
  const [nuevoTipo, setNuevoTipo]         = useState<TipoPeriodo>('mensual')
  const [nuevoMes, setNuevoMes]           = useState(hoy.getMonth() + 1)
  const [nuevoAnio, setNuevoAnio]         = useState(hoy.getFullYear())
  const [nuevaQuincena, setNuevaQuincena] = useState<1 | 2>(1)

  // Ajuste inline form
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)
  const [newTipo, setNewTipo]             = useState<'ingreso' | 'deduccion'>('ingreso')
  const [newConcepto, setNewConcepto]     = useState<ConceptoAjuste>('bono')
  const [newValor, setNewValor]           = useState('')
  const [newDesc, setNewDesc]             = useState('')

  // Selección para procesamiento masivo
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set())

  // Modal + toast
  const [detalleModal, setDetalleModal] = useState<{ emp: Empleado; nom: ResultadoNomina } | null>(null)
  const [toast, setToast]               = useState<string | null>(null)

  useEffect(() => {
    if (empresa.modalidadNomina) setNuevoTipo(empresa.modalidadNomina)
  }, [empresa.modalidadNomina])

  const periodoActual = periodos.find(p => p.id === periodoAbierto) ?? null
  const periodoActualLabel = periodoActual ? labelPeriodo(periodoActual) : ''

  function calcularTotalesRapido() {
    const rs = empleadosActivos.map(e => calcularNomina(e))
    return {
      bruto:      rs.reduce((s, r) => s + r.totalBruto, 0),
      descuentos: rs.reduce((s, r) => s + r.totalDescuentos, 0),
      neto:       rs.reduce((s, r) => s + r.salarioNeto, 0),
      aportes:    rs.reduce((s, r) => s + r.totalAportesEmpleador, 0),
      isr:        rs.reduce((s, r) => s + r.isrMensual, 0),
      costoTotal: rs.reduce((s, r) => s + r.totalCostoEmpleador, 0),
    }
  }

  function handleCrearPeriodo() {
    // Block duplicate period (same tipo/mes/anio/quincena)
    const duplicado = periodos.some(p =>
      p.tipo === nuevoTipo &&
      p.mes  === nuevoMes  &&
      p.anio === nuevoAnio &&
      (nuevoTipo === 'mensual' || p.quincena === nuevaQuincena)
    )
    if (duplicado) {
      setToast('Ya existe un período con ese tipo, mes y año')
      return
    }

    // Pre-load active loan installments as deductions per employee
    const ajustesIniciales: Record<string, AjusteLinea[]> = {}
    for (const emp of empleadosActivos) {
      const loans = getPrestamosActivos(emp.id)
      if (loans.length > 0) {
        ajustesIniciales[emp.id] = loans.map(p => ({
          id: `loan-${p.id}`,
          tipo: 'deduccion' as const,
          concepto: 'prestamo' as const,
          descripcion: p.notas ? `Préstamo — ${p.notas}` : 'Préstamo',
          valor: p.cuotaBase,
          prestamoId: p.id,
        }))
      }
    }
    for (const emp of empleadosActivos) {
      const deps = emp.dependientes ?? []
      if (deps.length > 0) {
        const cuotaMensualDep = cuotaDependienteSFS(emp.salarioBase)
        const depAjustes = deps.map(d => ({
          id: `dep-${d.id}-${Date.now().toString(36)}`,
          tipo: 'deduccion' as const,
          concepto: 'dependiente_sfs' as const,
          descripcion: `SFS Dep. — ${d.nombre} ${d.apellido}`,
          valor: nuevoTipo === 'quincenal' ? Math.round(cuotaMensualDep / 2) : Math.round(cuotaMensualDep),
        }))
        ajustesIniciales[emp.id] = [...(ajustesIniciales[emp.id] ?? []), ...depAjustes]
      }
    }
    const nuevo = generar({
      tipo:               nuevoTipo,
      quincena:           nuevoTipo === 'quincenal' ? nuevaQuincena : undefined,
      mes:                nuevoMes,
      anio:               nuevoAnio,
      estado:             'en_proceso',
      totalEmpleados:     empleadosActivos.length,
      totales:            calcularTotalesRapido(),
      ajustesPorEmpleado: ajustesIniciales,
    })
    setPeriodoAbierto(nuevo.id)
    setSelectedEmps(new Set())
    setToast('Período creado · Cuotas de préstamos pre-cargadas')
  }

  function handleCerrarPeriodo() {
    if (!periodoActual) return
    // Register actual paid amounts against each loan
    const ajustesPorEmp = periodoActual.ajustesPorEmpleado ?? {}
    for (const ajustes of Object.values(ajustesPorEmp)) {
      for (const ajuste of ajustes) {
        if (ajuste.concepto === 'prestamo' && ajuste.prestamoId && ajuste.valor > 0) {
          registrarPago(ajuste.prestamoId, {
            periodoId: periodoActual.id,
            fecha: new Date().toISOString(),
            montoPagado: ajuste.valor,
            esLiquidacion: false,
          })
        }
      }
    }
    cerrar(periodoActual.id)
    setToast('Período cerrado · Pagos de préstamos registrados')
  }

  function handleExportar() {
    if (!periodoActual) return
    const ajustesPorEmp  = periodoActual.ajustesPorEmpleado ?? {}
    const quincenaActual: 1 | 2 = periodoActual.quincena ?? 1
    const rows = empleadosActivos.map(e => {
      const r = calcularConAjustes(e, ajustesPorEmp[e.id] ?? [], periodoActual.tipo, quincenaActual)
      return [
        fullName(e), e.cargo, e.departamento,
        r.totalBruto.toFixed(2), r.afpEmpleado.toFixed(2), r.sfsEmpleado.toFixed(2),
        r.isrMensual.toFixed(2), r.totalDescuentos.toFixed(2), r.salarioNeto.toFixed(2),
        r.afpEmpleador.toFixed(2), r.sfsEmpleador.toFixed(2), r.srlEmpleador.toFixed(2),
        r.totalCostoEmpleador.toFixed(2),
      ]
    })
    const slug = periodoActualLabel.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    exportarCSV(
      `nomina-${slug}.csv`,
      ['Empleado','Cargo','Departamento','S. Bruto','AFP Emp','SFS Emp','ISR','Total Desc.','S. Neto','AFP Empr','SFS Empr','SRL','Costo Total'],
      rows,
    )
    setToast('Nómina exportada correctamente')
  }

  function getAjustes(empleadoId: string): AjusteLinea[] {
    return (periodoActual?.ajustesPorEmpleado ?? {})[empleadoId] ?? []
  }

  function handleRemoveAjuste(empleadoId: string, ajusteId: string) {
    if (!periodoActual) return
    actualizarAjustes(periodoActual.id, empleadoId, getAjustes(empleadoId).filter(a => a.id !== ajusteId))
  }

  function handleAgregarAjuste(empleadoId: string) {
    if (!periodoActual || !newValor) return
    const valor = parseFloat(newValor)
    if (isNaN(valor) || valor <= 0) return
    const ajuste: AjusteLinea = {
      id:          Date.now().toString(36),
      tipo:        newTipo,
      concepto:    newConcepto,
      descripcion: newDesc,
      valor,
    }
    actualizarAjustes(periodoActual.id, empleadoId, [...getAjustes(empleadoId), ajuste])
    setNewValor('')
    setNewDesc('')
    setExpandedEmpId(null)
  }

  function openAjusteForm(empId: string) {
    setExpandedEmpId(empId)
    setNewTipo('ingreso')
    setNewConcepto('bono')
    setNewValor('')
    setNewDesc('')
  }

  function handleProcesarEmpleado(empId: string) {
    if (!periodoActual) return
    marcarProcesados(periodoActual.id, [empId])
    setSelectedEmps(prev => { const s = new Set(prev); s.delete(empId); return s })
  }

  function handleProcesarSeleccionados() {
    if (!periodoActual) return
    const ids = selectedEmps.size > 0
      ? [...selectedEmps]
      : empleadosActivos.map(e => e.id)
    marcarProcesados(periodoActual.id, ids)
    setSelectedEmps(new Set())
    setToast(selectedEmps.size > 0 ? `${ids.length} empleado(s) procesado(s)` : 'Todos los empleados procesados')
  }

  function toggleSeleccionEmp(empId: string) {
    setSelectedEmps(prev => {
      const s = new Set(prev)
      if (s.has(empId)) s.delete(empId); else s.add(empId)
      return s
    })
  }

  function toggleSeleccionTodos() {
    const noProcessados = empleadosActivos
      .filter(e => !(periodoActual?.empleadosProcesados ?? []).includes(e.id))
      .map(e => e.id)
    if (selectedEmps.size === noProcessados.length && noProcessados.length > 0) {
      setSelectedEmps(new Set())
    } else {
      setSelectedEmps(new Set(noProcessados))
    }
  }

  const anios = [nuevoAnio - 1, nuevoAnio, nuevoAnio + 1]
  const conceptosIngreso: ConceptoAjuste[]   = ['horas_extras_35', 'horas_extras_100', 'comision', 'bono', 'otro_ingreso']
  const conceptosDeduccion: ConceptoAjuste[] = ['prestamo', 'dependiente_sfs', 'otro_descuento']

  // ── VISTA: LISTA ─────────────────────────────────────────────────────────────
  if (!periodoAbierto) {
    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header title="Nómina" subtitle="Gestión de períodos de pago" />

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50 dark:bg-[#0d0f1a]">

          {/* Crear período */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Crear Período</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tipo</label>
                  <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                    {(['mensual', 'quincenal'] as TipoPeriodo[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setNuevoTipo(t)}
                        className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                          nuevoTipo === t
                            ? 'bg-[#1B2980] text-white'
                            : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                        }`}
                      >
                        {t === 'mensual' ? 'Mensual' : 'Quincenal'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Mes</label>
                  <select
                    value={nuevoMes}
                    onChange={e => setNuevoMes(Number(e.target.value))}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                  >
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Año</label>
                  <select
                    value={nuevoAnio}
                    onChange={e => setNuevoAnio(Number(e.target.value))}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                  >
                    {anios.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {nuevoTipo === 'quincenal' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Quincena</label>
                    <select
                      value={nuevaQuincena}
                      onChange={e => setNuevaQuincena(Number(e.target.value) as 1 | 2)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                    >
                      <option value={1}>1ª Quincena (1–15)</option>
                      <option value={2}>2ª Quincena (16–fin)</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={handleCrearPeriodo}
                  disabled={empleadosActivos.length === 0}
                  className="self-end flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Crear Período
                </button>
              </div>

              {empleadosActivos.length === 0 && (
                <p className="mt-2.5 text-xs text-amber-600 dark:text-amber-400">
                  Debes registrar al menos un empleado activo para crear un período de nómina.
                </p>
              )}
            </div>
          </div>

          {/* Period cards */}
          {periodos.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin períodos de nómina</p>
                <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                  Crea tu primer período usando el formulario de arriba para comenzar a procesar pagos.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {periodos.map(p => (
                <div
                  key={p.id}
                  className="flex flex-col rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden"
                >
                  <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{labelPeriodo(p)}</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {p.totalEmpleados} empleado{p.totalEmpleados !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {p.estado === 'cerrada' ? (
                      <Badge variant="neutral"><Lock className="mr-1 h-3 w-3" />Cerrada</Badge>
                    ) : p.estado === 'procesada' ? (
                      <Badge variant="success">Procesada</Badge>
                    ) : (
                      <Badge variant="warning">En Proceso</Badge>
                    )}
                  </div>

                  <div className="flex-1 px-5 py-4 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Neto Total</span>
                      <span className="text-lg font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">
                        {formatRD(p.totales.neto, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Costo Empresa</span>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                        {formatRD(p.totales.costoTotal, 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-5 py-3 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <button
                      onClick={() => setPeriodoAbierto(p.id)}
                      className="flex-1 rounded-lg bg-[#1B2980] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors text-center"
                    >
                      Abrir
                    </button>
                    {p.estado === 'procesada' && (
                      <button
                        onClick={() => cerrar(p.id)}
                        title="Cerrar período"
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      >
                        <Lock className="h-4 w-4" />
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
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ── VISTA: DETALLE ────────────────────────────────────────────────────────────
  if (!periodoActual) {
    setPeriodoAbierto(null)
    return null
  }

  const ajustesPorEmp  = periodoActual.ajustesPorEmpleado ?? {}
  const quincenaActual: 1 | 2 = periodoActual.quincena ?? 1
  const esEnProceso    = periodoActual.estado === 'en_proceso'
  const esProcesada    = periodoActual.estado === 'procesada'
  const procesados     = new Set(periodoActual.empleadosProcesados ?? [])
  const noProcessados  = empleadosActivos.filter(e => !procesados.has(e.id))
  const todosSeleccionados = noProcessados.length > 0 && noProcessados.every(e => selectedEmps.has(e.id))

  const nominas = empleadosActivos.map(e => ({
    empleado: e,
    resultado: calcularConAjustes(e, ajustesPorEmp[e.id] ?? [], periodoActual.tipo, quincenaActual),
  }))

  const totales = {
    bruto:      nominas.reduce((s, n) => s + n.resultado.totalBruto, 0),
    descuentos: nominas.reduce((s, n) => s + n.resultado.totalDescuentos, 0),
    neto:       nominas.reduce((s, n) => s + n.resultado.salarioNeto, 0),
    aportes:    nominas.reduce((s, n) => s + n.resultado.totalAportesEmpleador, 0),
    isr:        nominas.reduce((s, n) => s + n.resultado.isrMensual, 0),
    costoTotal: nominas.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title={periodoActualLabel}
        subtitle={esEnProceso ? 'En proceso' : esProcesada ? 'Período procesado' : 'Período cerrado'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPeriodoAbierto(null); setSelectedEmps(new Set()) }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Períodos
            </button>
            {esEnProceso && (
              <button
                onClick={handleProcesarSeleccionados}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                {selectedEmps.size > 0 ? `Procesar (${selectedEmps.size})` : 'Procesar Todo'}
              </button>
            )}
            {esProcesada && (
              <button
                onClick={handleCerrarPeriodo}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <Lock className="h-4 w-4" />
                Cerrar
              </button>
            )}
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* KPIs */}
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
            sub={periodoActual.tipo === 'quincenal' && quincenaActual === 1 ? 'Anticipo — sin ISR' : 'Por remitir a DGII'}
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          />
        </div>

        {/* Employee table */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle por Empleado — {periodoActualLabel}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Info className="h-3.5 w-3.5" />
              {esEnProceso
                ? `${procesados.size}/${empleadosActivos.length} empleados procesados`
                : esProcesada
                  ? 'Período procesado — solo lectura'
                  : 'Período cerrado — solo lectura'}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {esEnProceso && (
                    <th className="pl-4 pr-2 py-3 w-8">
                      <button
                        onClick={toggleSeleccionTodos}
                        className="text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 transition-colors"
                        title={todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar pendientes'}
                      >
                        {todosSeleccionados
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                  )}
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ajustes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AFP+SFS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ISR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Emp.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {nominas.map(({ empleado, resultado }) => {
                  const ajustes      = ajustesPorEmp[empleado.id] ?? []
                  const isExpanded   = expandedEmpId === empleado.id
                  const isProcesado  = procesados.has(empleado.id)
                  const isSelected   = selectedEmps.has(empleado.id)
                  const colSpanTotal = esEnProceso ? 9 : 8

                  return (
                    <>
                      <tr
                        key={empleado.id}
                        className={`border-b border-zinc-50 dark:border-[#1d2035] transition-colors ${
                          isProcesado
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                            : 'hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        {/* Checkbox column */}
                        {esEnProceso && (
                          <td className="pl-4 pr-2 py-3.5 w-8">
                            {isProcesado ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <button
                                onClick={() => toggleSeleccionEmp(empleado.id)}
                                className="text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 transition-colors"
                              >
                                {isSelected
                                  ? <CheckSquare className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                                  : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                        )}

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isProcesado
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[#eef0fb] dark:bg-indigo-900/40 text-[#1B2980] dark:text-indigo-300'
                            }`}>
                              {empleado.nombre[0]}{empleado.apellido[0]}
                            </div>
                            <div>
                              <p className="font-medium text-[#1B2980] dark:text-indigo-400 leading-tight">{fullName(empleado)}</p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">{empleado.cedula} · {empleado.cargo}</p>
                            </div>
                          </div>
                        </td>

                        {/* Ajustes chips */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            {ajustes.map(a => (
                              <span
                                key={a.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                  a.tipo === 'ingreso'
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50'
                                    : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/50'
                                }`}
                              >
                                {labelConcepto(a.concepto)}{' '}
                                {isHorasConcepto(a.concepto) ? `${a.valor}h` : formatRD(a.valor, 0)}
                                {esEnProceso && (
                                  <button
                                    onClick={() => handleRemoveAjuste(empleado.id, a.id)}
                                    className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                                    title="Eliminar ajuste"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {esEnProceso && (
                              <button
                                onClick={() => isExpanded ? setExpandedEmpId(null) : openAjusteForm(empleado.id)}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-zinc-100 dark:bg-[#252840] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#2d3152] transition-colors"
                                title="Agregar ajuste"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {formatRD(resultado.totalBruto, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatRD(resultado.afpEmpleado + resultado.sfsEmpleado, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.isrMensual === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : formatRD(resultado.isrMensual, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                          {formatRD(resultado.salarioNeto, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatRD(resultado.totalCostoEmpleador, 0)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {esEnProceso && !isProcesado && (
                              <button
                                onClick={() => handleProcesarEmpleado(empleado.id)}
                                className="rounded-md border border-emerald-300 dark:border-emerald-700/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                title="Procesar este empleado"
                              >
                                Procesar
                              </button>
                            )}
                            <button
                              onClick={() => setDetalleModal({ emp: empleado, nom: resultado })}
                              className="rounded-lg p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                              title="Ver comprobante"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline ajuste form */}
                      {isExpanded && (
                        <tr
                          key={`${empleado.id}-form`}
                          className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]"
                        >
                          <td colSpan={colSpanTotal} className="px-5 py-4">
                            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                                Agregar ajuste — {fullName(empleado)}
                              </p>
                              <div className="flex flex-wrap items-end gap-3">

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo</label>
                                  <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                                    <button
                                      onClick={() => { setNewTipo('ingreso'); setNewConcepto('bono') }}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${newTipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Ingreso
                                    </button>
                                    <button
                                      onClick={() => { setNewTipo('deduccion'); setNewConcepto('prestamo') }}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${newTipo === 'deduccion' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Deducción
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Concepto</label>
                                  <select
                                    value={newConcepto}
                                    onChange={e => setNewConcepto(e.target.value as ConceptoAjuste)}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  >
                                    {(newTipo === 'ingreso' ? conceptosIngreso : conceptosDeduccion).map(c => (
                                      <option key={c} value={c}>{labelConcepto(c)}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {isHorasConcepto(newConcepto) ? 'Horas' : 'Monto RD$'}
                                  </label>
                                  <input
                                    type="number"
                                    value={newValor}
                                    onChange={e => setNewValor(e.target.value)}
                                    placeholder={isHorasConcepto(newConcepto) ? '0' : '0.00'}
                                    min="0"
                                    step={isHorasConcepto(newConcepto) ? '1' : '0.01'}
                                    className="w-32 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Descripción (opcional)</label>
                                  <input
                                    type="text"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Nota o referencia"
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  />
                                </div>

                                <div className="flex gap-2 self-end">
                                  <button
                                    onClick={() => handleAgregarAjuste(empleado.id)}
                                    disabled={!newValor || parseFloat(newValor) <= 0}
                                    className="rounded-lg bg-[#1B2980] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Agregar
                                  </button>
                                  <button
                                    onClick={() => setExpandedEmpId(null)}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400" colSpan={esEnProceso ? 3 : 2}>
                    TOTALES — {empleadosActivos.length} empleados
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">{formatRD(totales.bruto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatRD(nominas.reduce((s, n) => s + n.resultado.afpEmpleado + n.resultado.sfsEmpleado, 0), 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(totales.isr, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">{formatRD(totales.neto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(totales.costoTotal, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Nota legal */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-0.5">
              <p className="font-semibold">Normativa aplicada</p>
              <p>AFP 2.87% emp / 7.10% empr · SFS 3.04% emp / 7.09% empr · SRL 1.10% empr · Tope TSS RD$420,000</p>
              {periodoActual.tipo === 'quincenal'
                ? <p>Quincenal: 1ª quincena = anticipo sin ISR · 2ª quincena = ISR mensual completo liquidado · Ley 11-92 Art. 309</p>
                : <p>ISR calculado sobre base anual según tramos DGII vigentes · Ley 11-92 Art. 309</p>
              }
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {detalleModal && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <DetalleNomina
            empleado={detalleModal.emp}
            nomina={detalleModal.nom}
            periodoLabel={periodoActualLabel}
            onClose={() => setDetalleModal(null)}
          />
        </>
      )}
    </div>
  )
}
