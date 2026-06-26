'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, ArrowLeft, X, DollarSign, Users, CheckCircle2, ChevronRight,
  AlertTriangle, CreditCard, Calendar, TrendingDown, FileText,
  Upload, Download, Search,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePrestamos, calcularCuotaBase } from '@/lib/prestamos-context'
import { formatRD, fullName, formatDate } from '@/lib/utils'
import type { Prestamo, EstadoPrestamo } from '@/types'

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'
const labelCls = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

// ── Badge helpers ─────────────────────────────────────────────────────────────
function estadoBadgeVariant(estado: EstadoPrestamo): 'success' | 'neutral' | 'danger' {
  switch (estado) {
    case 'activo':    return 'success'
    case 'pagado':    return 'neutral'
    case 'cancelado': return 'danger'
  }
}

function estadoLabel(estado: EstadoPrestamo): string {
  switch (estado) {
    case 'activo':    return 'Activo'
    case 'pagado':    return 'Pagado'
    case 'cancelado': return 'Cancelado'
  }
}

function frecuenciaLabel(f: 'mensual' | 'quincenal'): string {
  return f === 'mensual' ? 'Mensual' : 'Quincenal'
}

// ── Cuotas from date range ────────────────────────────────────────────────────
function cuotasFromDates(inicio: string, fin: string, frecuencia: 'mensual' | 'quincenal'): number {
  const s = new Date(inicio)
  const e = new Date(fin)
  if (e <= s) return 1
  if (frecuencia === 'mensual') {
    return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()))
  }
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (15 * 24 * 3600 * 1000)))
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, iconColor,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconColor: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-[#252840] overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({
  message, onConfirm, onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl animate-modal-in">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
          >
            No, cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
          >
            Sí, cancelar préstamo
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista Detalle ─────────────────────────────────────────────────────────────
function VistaDetalle({
  prestamo,
  nombreEmpleado,
  initials,
  onBack,
  onRegistrarPago,
}: {
  prestamo: Prestamo
  nombreEmpleado: string
  initials: string
  onBack: () => void
  onRegistrarPago: (prestamoId: string, monto: number) => void
}) {
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoDesc, setPagoDesc]   = useState('')

  // Build amortization table
  const cuotaBase   = prestamo.cuotaBase
  const tasaMensual = prestamo.tasaInteres / 100
  const rows: {
    num: number
    cuota: number
    capital: number
    interes: number
    saldo: number
    pagado: boolean
    esProxima: boolean
  }[] = []

  let saldo = prestamo.monto
  const numPagos = prestamo.pagos.length

  for (let i = 1; i <= prestamo.cuotas; i++) {
    let interes: number
    let capital: number
    let cuota: number

    if (prestamo.tasaInteres === 0) {
      interes = 0
      capital = cuotaBase
      cuota   = cuotaBase
    } else {
      interes = saldo * tasaMensual
      capital = cuotaBase - interes
      cuota   = cuotaBase
    }

    const saldoRestante = Math.max(0, saldo - capital)
    const pagado        = i <= numPagos
    const esProxima     = !pagado && prestamo.estado === 'activo' && rows.filter(r => !r.pagado).length === 0

    rows.push({ num: i, cuota, capital, interes, saldo: saldoRestante, pagado, esProxima })
    saldo = saldoRestante
  }

  function handlePago(e: React.FormEvent) {
    e.preventDefault()
    const monto = parseFloat(pagoMonto)
    if (!monto || monto <= 0) return
    onRegistrarPago(prestamo.id, monto)
    setPagoMonto('')
    setPagoDesc('')
  }

  function handleDescargarDocumento() {
    if (!prestamo.documentoSolicitud || !prestamo.documentoNombre) return
    const byteStr = atob(prestamo.documentoSolicitud)
    const ab = new ArrayBuffer(byteStr.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
    const blob = new Blob([ab], { type: 'application/pdf' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = prestamo.documentoNombre
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Detalle de Préstamo"
        subtitle="Tabla de amortización e historial de pagos"
        actions={
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Loan header card */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm dark:shadow-none">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: '#1B2980' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{nombreEmpleado}</h2>
                <Badge variant={estadoBadgeVariant(prestamo.estado)}>{estadoLabel(prestamo.estado)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Otorgado el {formatDate(prestamo.fechaOtorgamiento)}
                {prestamo.fechaFin && ` · Vence ${formatDate(prestamo.fechaFin)}`}
                {prestamo.notas && ` · ${prestamo.notas}`}
              </p>
            </div>
            {/* Document download */}
            {prestamo.documentoSolicitud && (
              <button
                onClick={handleDescargarDocumento}
                title={`Descargar: ${prestamo.documentoNombre}`}
                className="flex items-center gap-1.5 rounded-lg border border-[#1B2980]/30 dark:border-indigo-600/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-3 py-1.5 text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:bg-[#1B2980]/10 transition-colors shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Solicitud PDF
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Monto Original',   value: formatRD(prestamo.monto) },
              { label: 'Saldo Pendiente',  value: formatRD(prestamo.saldoPendiente), highlight: prestamo.estado === 'activo' },
              { label: 'Cuota',            value: formatRD(prestamo.cuotaBase) },
              { label: 'Tasa Interés',     value: prestamo.tasaInteres === 0 ? 'Sin interés' : `${prestamo.tasaInteres}% mensual` },
              { label: 'Cuotas',           value: `${prestamo.cuotas} cuotas` },
              { label: 'Frecuencia',       value: frecuenciaLabel(prestamo.frecuencia) },
              { label: 'Pagos Realizados', value: `${prestamo.pagos.length} de ${prestamo.cuotas}` },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase text-zinc-400 dark:text-zinc-500">{item.label}</p>
                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${item.highlight ? 'text-[#1B2980] dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>Progreso de pago</span>
              <span>{((prestamo.monto - prestamo.saldoPendiente) / prestamo.monto * 100).toFixed(1)}% pagado</span>
            </div>
            <ProgressBar pct={(prestamo.monto - prestamo.saldoPendiente) / prestamo.monto * 100} />
          </div>
        </div>

        {/* Amortization table */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tabla de Amortización</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Proyección de cuotas · {prestamo.cuotas} períodos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  {['#', 'Cuota', 'Capital', 'Interés', 'Saldo Remanente', 'Estado'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-right first:text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {rows.map(row => (
                  <tr
                    key={row.num}
                    className={
                      row.esProxima
                        ? 'bg-amber-50 dark:bg-amber-950/20'
                        : row.pagado
                          ? 'opacity-50'
                          : ''
                    }
                  >
                    <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">{row.num}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatRD(row.cuota)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(row.capital)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(row.interes)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(row.saldo)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.pagado ? (
                        <Badge variant="success">Pagado</Badge>
                      ) : row.esProxima ? (
                        <Badge variant="warning">Próxima</Badge>
                      ) : (
                        <Badge variant="neutral">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment history */}
        {prestamo.pagos.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Historial de Pagos</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{prestamo.pagos.length} pago{prestamo.pagos.length !== 1 ? 's' : ''} registrado{prestamo.pagos.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    {['Fecha', 'Período', 'Monto Pagado', 'Tipo'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {prestamo.pagos.map(pago => (
                    <tr key={pago.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">{formatDate(pago.fecha)}</td>
                      <td className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                        {pago.periodoId ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatRD(pago.montoPagado)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={pago.esLiquidacion ? 'warning' : 'default'}>
                          {pago.esLiquidacion ? 'Liquidación' : 'Nómina'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual payment form */}
        {prestamo.estado === 'activo' && (
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Registrar Pago Manual</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Pagos fuera de nómina regular</p>
            </div>
            <form onSubmit={handlePago} className="p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Monto a Pagar (RD$) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className={inputCls}
                    value={pagoMonto}
                    onChange={e => setPagoMonto(e.target.value)}
                    placeholder={formatRD(prestamo.cuotaBase)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Descripción</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={pagoDesc}
                    onChange={e => setPagoDesc(e.target.value)}
                    placeholder="Pago adelantado, abono especial…"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={!pagoMonto || parseFloat(pagoMonto) <= 0}
                  className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PrestamosPage() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa }                     = useEmpresa()
  const { prestamos, otorgar, registrarPago, cancelar } = usePrestamos()

  // ── View state ──────────────────────────────────────────────────────────────
  const [vista, setVista]                               = useState<'lista' | 'detalle'>('lista')
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<Prestamo | null>(null)
  const [filtroEstado, setFiltroEstado]                 = useState<EstadoPrestamo | 'todos'>('activo')
  const [showForm, setShowForm]                         = useState(false)
  const [toast, setToast]                               = useState<string | null>(null)
  const [confirmId, setConfirmId]                       = useState<string | null>(null)

  // ── List filter state ───────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [fEmpleado,    setFEmpleado]    = useState('')
  const [fMonto,       setFMonto]       = useState('')
  const [fTasa,        setFTasa]        = useState('0')
  const [fCuotas,      setFCuotas]      = useState('12')
  const [fFrecuencia,  setFFrecuencia]  = useState<'mensual' | 'quincenal'>('mensual')
  const [fFechaInicio, setFFechaInicio] = useState('')
  const [fFechaFin,    setFFechaFin]    = useState('')
  const [fUsarFechas,  setFUsarFechas]  = useState(false)
  const [fNotas,       setFNotas]       = useState('')
  const [fDocBase64,   setFDocBase64]   = useState<string | null>(null)
  const [fDocNombre,   setFDocNombre]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Init frequency from company settings
  useEffect(() => {
    if (empresa.modalidadNomina === 'quincenal' || empresa.modalidadNomina === 'mensual') {
      setFFrecuencia(empresa.modalidadNomina)
    }
  }, [empresa.modalidadNomina])

  // Auto-calculate cuotas from date range when dates change
  useEffect(() => {
    if (fUsarFechas && fFechaInicio && fFechaFin) {
      const n = cuotasFromDates(fFechaInicio, fFechaFin, fFrecuencia)
      setFCuotas(String(n))
    }
  }, [fFechaInicio, fFechaFin, fFrecuencia, fUsarFechas])

  // ── Derived data ────────────────────────────────────────────────────────────
  const prestamosActivos    = prestamos.filter(p => p.estado === 'activo')
  const now                 = new Date()
  const thisMonth           = now.getMonth()
  const thisYear            = now.getFullYear()
  const pagadosEsteMes      = prestamos.filter(p => {
    if (p.estado !== 'pagado') return false
    const d = new Date(p.fechaOtorgamiento)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length

  const saldoTotalPendiente = prestamosActivos.reduce((s, p) => s + p.saldoPendiente, 0)

  // All employees (including inactive) for name lookup
  const todosEmpleados = empleados

  function getEmpleado(empleadoId: string) {
    return todosEmpleados.find(e => e.id === empleadoId)
  }

  function getEmpleadoName(empleadoId: string): string {
    const emp = getEmpleado(empleadoId)
    return emp ? fullName(emp) : 'Empleado desconocido'
  }

  function getEmpleadoInitials(empleadoId: string): string {
    const emp = getEmpleado(empleadoId)
    if (!emp) return '?'
    return `${emp.nombre[0]}${emp.apellido[0]}`
  }

  // Filter by estado tab + name/dept search
  const prestamosBase = filtroEstado === 'todos'
    ? prestamos
    : prestamos.filter(p => p.estado === filtroEstado)

  const prestamosFiltrados = busqueda.trim()
    ? prestamosBase.filter(p => {
        const emp = getEmpleado(p.empleadoId)
        if (!emp) return false
        const q = busqueda.toLowerCase()
        return (
          fullName(emp).toLowerCase().includes(q) ||
          emp.departamento.toLowerCase().includes(q)
        )
      })
    : prestamosBase

  // Live cuota preview
  const previewMonto  = parseFloat(fMonto) || 0
  const previewTasa   = parseFloat(fTasa)  || 0
  const previewCuotas = parseInt(fCuotas)  || 0
  const previewCuota  = calcularCuotaBase(previewMonto, previewTasa, previewCuotas)

  // ── File upload handler ──────────────────────────────────────────────────────
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip data URL prefix to store only the base64 payload
      const base64 = result.split(',')[1]
      setFDocBase64(base64)
      setFDocNombre(file.name)
    }
    reader.readAsDataURL(file)
  }

  function clearFile() {
    setFDocBase64(null)
    setFDocNombre(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleOtorgar(e: React.FormEvent) {
    e.preventDefault()
    if (!fEmpleado || previewMonto <= 0 || previewCuotas <= 0) return
    otorgar({
      empleadoId:          fEmpleado,
      monto:               previewMonto,
      tasaInteres:         previewTasa,
      cuotas:              previewCuotas,
      cuotaBase:           previewCuota,
      frecuencia:          fFrecuencia,
      fechaOtorgamiento:   new Date().toISOString().split('T')[0],
      fechaFin:            fFechaFin || undefined,
      notas:               fNotas.trim() || undefined,
      documentoSolicitud:  fDocBase64 ?? undefined,
      documentoNombre:     fDocNombre ?? undefined,
    })
    // Reset form
    setFEmpleado('')
    setFMonto('')
    setFTasa('0')
    setFCuotas('12')
    setFNotas('')
    setFFechaInicio('')
    setFFechaFin('')
    setFUsarFechas(false)
    clearFile()
    setShowForm(false)
    setToast('Préstamo otorgado exitosamente')
  }

  function handleCancelar(id: string) {
    cancelar(id)
    setConfirmId(null)
    setToast('Préstamo cancelado')
  }

  function handleRegistrarPago(prestamoId: string, monto: number) {
    registrarPago(prestamoId, {
      fecha: new Date().toISOString(),
      montoPagado: monto,
      esLiquidacion: false,
    })
    // Refresh selected loan from updated list
    const updated = prestamos.find(p => p.id === prestamoId)
    if (updated) setPrestamoSeleccionado(updated)
    setToast('Pago registrado exitosamente')
  }

  function handleVerDetalle(prestamo: Prestamo) {
    setPrestamoSeleccionado(prestamo)
    setVista('detalle')
  }

  // Keep prestamoSeleccionado in sync with latest data from context
  useEffect(() => {
    if (prestamoSeleccionado) {
      const fresh = prestamos.find(p => p.id === prestamoSeleccionado.id)
      if (fresh) setPrestamoSeleccionado(fresh)
    }
  }, [prestamos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detalle view ─────────────────────────────────────────────────────────────
  if (vista === 'detalle' && prestamoSeleccionado) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-[#0d0f1a]">
        <VistaDetalle
          prestamo={prestamoSeleccionado}
          nombreEmpleado={getEmpleadoName(prestamoSeleccionado.empleadoId)}
          initials={getEmpleadoInitials(prestamoSeleccionado.empleadoId)}
          onBack={() => { setVista('lista'); setPrestamoSeleccionado(null) }}
          onRegistrarPago={handleRegistrarPago}
        />
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ── Lista view ───────────────────────────────────────────────────────────────
  const FILTER_TABS: { value: EstadoPrestamo | 'todos'; label: string }[] = [
    { value: 'activo',    label: 'Activos'    },
    { value: 'pagado',    label: 'Pagados'    },
    { value: 'cancelado', label: 'Cancelados' },
    { value: 'todos',     label: 'Todos'      },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Préstamos a Empleados"
        subtitle="Control de préstamos y cuotas"
        actions={
          <button
            onClick={() => setShowForm(prev => !prev)}
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cerrar' : 'Nuevo Préstamo'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 p-6 pb-4">
          <StatCard
            label="Préstamos Activos"
            value={String(prestamosActivos.length)}
            sub="En curso"
            icon={CreditCard}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Saldo Total Pendiente"
            value={formatRD(saldoTotalPendiente, 0)}
            sub="Suma de saldos activos"
            icon={TrendingDown}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="En Trámite"
            value={String(pagadosEsteMes)}
            sub="Pagados este mes"
            icon={CheckCircle2}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        {/* New loan form */}
        {showForm && (
          <div className="mx-6 mb-4 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nuevo Préstamo</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Complete los datos del préstamo a otorgar</p>
              </div>
            </div>
            <form onSubmit={handleOtorgar} className="p-5 space-y-5">

              {/* Row 1: employee, amount, tasa */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={labelCls}>Empleado <span className="text-rose-500">*</span></label>
                  <select
                    className={inputCls}
                    value={fEmpleado}
                    onChange={e => setFEmpleado(e.target.value)}
                    required
                  >
                    <option value="">— Seleccionar empleado —</option>
                    {empleadosActivos.map(emp => (
                      <option key={emp.id} value={emp.id}>{fullName(emp)} · {emp.departamento}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Monto (RD$) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className={inputCls}
                    value={fMonto}
                    onChange={e => setFMonto(e.target.value)}
                    placeholder="50000"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Tasa Interés % mensual</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={fTasa}
                    onChange={e => setFTasa(e.target.value)}
                    placeholder="0"
                  />
                  {parseFloat(fTasa) === 0 && (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Sin interés (beneficio laboral)</p>
                  )}
                </div>
              </div>

              {/* Row 2: dates toggle + cuotas + frecuencia */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Date range toggle */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls + ' mb-0'}>Período del Préstamo</label>
                    <button
                      type="button"
                      onClick={() => {
                        setFUsarFechas(v => !v)
                        if (fUsarFechas) {
                          setFFechaInicio('')
                          setFFechaFin('')
                        }
                      }}
                      className="text-[11px] text-[#1B2980] dark:text-indigo-400 hover:underline"
                    >
                      {fUsarFechas ? 'Usar número de cuotas' : 'Usar fechas inicio/fin'}
                    </button>
                  </div>
                  {fUsarFechas ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Inicio</label>
                        <input
                          type="date"
                          className={inputCls}
                          value={fFechaInicio}
                          onChange={e => setFFechaInicio(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Fin</label>
                        <input
                          type="date"
                          className={inputCls}
                          value={fFechaFin}
                          onChange={e => setFFechaFin(e.target.value)}
                          min={fFechaInicio}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 italic">
                      Define directamente el número de cuotas a continuación.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>
                    Cuotas
                    {fUsarFechas && fFechaInicio && fFechaFin && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">(calculado automáticamente)</span>
                    )}
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputCls}
                    value={fCuotas}
                    onChange={e => setFCuotas(e.target.value)}
                    placeholder="12"
                    readOnly={fUsarFechas && !!fFechaInicio && !!fFechaFin}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Frecuencia</label>
                  <div className="flex gap-2">
                    {(['mensual', 'quincenal'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFFrecuencia(f)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          fFrecuencia === f
                            ? 'border-[#1B2980] bg-[#1B2980] text-white dark:border-indigo-600 dark:bg-indigo-600'
                            : 'border-zinc-200 dark:border-[#252840] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                        }`}
                      >
                        {frecuenciaLabel(f)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: notas + PDF upload */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Notas / Motivo</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={fNotas}
                    onChange={e => setFNotas(e.target.value)}
                    placeholder="Motivo del préstamo…"
                  />
                </div>

                {/* PDF Upload */}
                <div>
                  <label className={labelCls}>Solicitud Aprobada (PDF)</label>
                  {fDocNombre ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="flex-1 truncate text-xs text-emerald-700 dark:text-emerald-300">{fDocNombre}</span>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors">
                      <Upload className="h-4 w-4 shrink-0" />
                      <span>Adjuntar PDF escaneado…</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="sr-only"
                        onChange={handleFileUpload}
                      />
                    </label>
                  )}
                  <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                    El documento se almacena localmente junto con el préstamo.
                  </p>
                </div>
              </div>

              {/* Live cuota preview */}
              {previewMonto > 0 && previewCuotas > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-[#1B2980]/20 dark:border-indigo-600/30 bg-[#eef0fb] dark:bg-indigo-950/30 px-4 py-3">
                  <DollarSign className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#1B2980] dark:text-indigo-300">Cuota calculada</p>
                    <p className="text-lg font-bold tabular-nums text-[#1B2980] dark:text-indigo-200">
                      {formatRD(previewCuota)}
                      <span className="ml-1 text-xs font-normal opacity-70">/ {frecuenciaLabel(fFrecuencia).toLowerCase()}</span>
                    </p>
                    {fUsarFechas && fFechaInicio && fFechaFin && (
                      <p className="text-[11px] text-[#1B2980]/70 dark:text-indigo-400/70 mt-0.5">
                        {previewCuotas} cuotas · {formatDate(fFechaInicio)} → {formatDate(fFechaFin)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!fEmpleado || previewMonto <= 0 || previewCuotas <= 0}
                  className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Otorgar Préstamo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter tabs + search */}
        <div className="px-6 mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFiltroEstado(tab.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filtroEstado === tab.value
                    ? 'bg-[#1B2980] text-white dark:bg-indigo-600'
                    : 'border border-zinc-200 dark:border-[#252840] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
              {prestamosFiltrados.length} resultado{prestamosFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Name / department search */}
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o departamento…"
              className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] py-1.5 pl-8 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Loan table */}
        <div className="px-6 pb-6">
          {prestamosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v8M9 19h6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8h5M9.5 10.5h3" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                  {busqueda ? 'Sin coincidencias' : 'Sin préstamos en esta categoría'}
                </p>
                <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                  {filtroEstado === 'activo' && !busqueda
                    ? 'Registra un nuevo préstamo usando el botón superior.'
                    : 'Ajusta el filtro o la búsqueda para ver resultados.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      {['Empleado', 'Monto Original', 'Saldo Pendiente', 'Cuota', 'Cuotas', 'Tasa', 'Frecuencia', 'Fecha', 'Doc', 'Estado', ''].map(h => (
                        <th
                          key={h || 'actions'}
                          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {prestamosFiltrados.map(prestamo => {
                      const pct      = (prestamo.monto - prestamo.saldoPendiente) / prestamo.monto * 100
                      const empName  = getEmpleadoName(prestamo.empleadoId)
                      const initials = getEmpleadoInitials(prestamo.empleadoId)
                      const emp      = getEmpleado(prestamo.empleadoId)

                      return (
                        <tr
                          key={prestamo.id}
                          className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                        >
                          {/* Empleado */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: '#1B2980' }}
                              >
                                {initials}
                              </div>
                              <div>
                                <span className="block font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{empName}</span>
                                {emp && <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">{emp.departamento}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Monto Original */}
                          <td className="px-4 py-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {formatRD(prestamo.monto)}
                          </td>

                          {/* Saldo Pendiente + progress */}
                          <td className="px-4 py-3 min-w-[160px]">
                            <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                              prestamo.estado === 'activo'
                                ? 'text-[#1B2980] dark:text-indigo-400'
                                : 'text-zinc-400 dark:text-zinc-500'
                            }`}>
                              {formatRD(prestamo.saldoPendiente)}
                            </p>
                            <div className="mt-1">
                              <ProgressBar pct={pct} />
                            </div>
                            <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{pct.toFixed(0)}% pagado</p>
                          </td>

                          {/* Cuota */}
                          <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                            {formatRD(prestamo.cuotaBase)}
                          </td>

                          {/* Cuotas */}
                          <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                            <span className="text-xs">
                              {prestamo.pagos.length}/{prestamo.cuotas}
                            </span>
                          </td>

                          {/* Tasa */}
                          <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {prestamo.tasaInteres === 0
                              ? <span className="text-emerald-600 dark:text-emerald-400">Sin interés</span>
                              : `${prestamo.tasaInteres}%`}
                          </td>

                          {/* Frecuencia */}
                          <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                            {frecuenciaLabel(prestamo.frecuencia)}
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {formatDate(prestamo.fechaOtorgamiento)}
                          </td>

                          {/* Document indicator */}
                          <td className="px-4 py-3 text-center">
                            {prestamo.documentoSolicitud ? (
                              <span title={prestamo.documentoNombre}>
                                <FileText className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 mx-auto" />
                              </span>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <Badge variant={estadoBadgeVariant(prestamo.estado)}>
                              {estadoLabel(prestamo.estado)}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVerDetalle(prestamo)}
                                className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-[#252840] px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors whitespace-nowrap"
                              >
                                Ver detalle
                                <ChevronRight className="h-3 w-3" />
                              </button>
                              {prestamo.estado === 'activo' && (
                                <button
                                  onClick={() => setConfirmId(prestamo.id)}
                                  className="rounded-lg border border-rose-200 dark:border-rose-800/50 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm cancel dialog */}
      {confirmId && (
        <ConfirmDialog
          message="¿Está seguro de que desea cancelar este préstamo? Esta acción no se puede deshacer."
          onConfirm={() => handleCancelar(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
