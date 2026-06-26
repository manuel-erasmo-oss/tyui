'use client'

import { useState, useEffect } from 'react'
import {
  Plus, ArrowLeft, X, DollarSign, Users, CheckCircle2, ChevronRight,
  AlertTriangle, CreditCard, Calendar, TrendingDown, FileText,
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
          <Icon className="h-4.5 w-4.5" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl">
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
  onRegistrarPago: (prestamoId: string, monto: number, descripcion: string) => void
}) {
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoDesc, setPagoDesc]   = useState('')

  // Build amortization table
  const cuotaBase  = prestamo.cuotaBase
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
    onRegistrarPago(prestamo.id, monto, pagoDesc)
    setPagoMonto('')
    setPagoDesc('')
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
                {prestamo.notas && ` · ${prestamo.notas}`}
              </p>
            </div>
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
                  className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
  const { empleadosActivos } = useEmpleados()
  const { empresa }          = useEmpresa()
  const { prestamos, otorgar, registrarPago, cancelar } = usePrestamos()

  // ── View state ──────────────────────────────────────────────────────────────
  const [vista, setVista]                               = useState<'lista' | 'detalle'>('lista')
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<Prestamo | null>(null)
  const [filtro, setFiltro]                             = useState<EstadoPrestamo | 'todos'>('activo')
  const [showForm, setShowForm]                         = useState(false)
  const [toast, setToast]                               = useState<string | null>(null)
  const [confirmId, setConfirmId]                       = useState<string | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [fEmpleado,   setFEmpleado]   = useState('')
  const [fMonto,      setFMonto]      = useState('')
  const [fTasa,       setFTasa]       = useState('0')
  const [fCuotas,     setFCuotas]     = useState('12')
  const [fFrecuencia, setFFrecuencia] = useState<'mensual' | 'quincenal'>('mensual')
  const [fNotas,      setFNotas]      = useState('')

  // Init frequency from company settings
  useEffect(() => {
    if (empresa.modalidadNomina === 'quincenal' || empresa.modalidadNomina === 'mensual') {
      setFFrecuencia(empresa.modalidadNomina)
    }
  }, [empresa.modalidadNomina])

  // ── Derived data ────────────────────────────────────────────────────────────
  const prestamosActivos  = prestamos.filter(p => p.estado === 'activo')
  const now               = new Date()
  const thisMonth         = now.getMonth()
  const thisYear          = now.getFullYear()
  const pagadosEsteMes    = prestamos.filter(p => {
    if (p.estado !== 'pagado') return false
    const d = new Date(p.fechaOtorgamiento)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length

  const saldoTotalPendiente = prestamosActivos.reduce((s, p) => s + p.saldoPendiente, 0)

  // Filter by tab
  const prestamosFiltrados = filtro === 'todos'
    ? prestamos
    : prestamos.filter(p => p.estado === filtro)

  // Live cuota preview
  const previewMonto  = parseFloat(fMonto) || 0
  const previewTasa   = parseFloat(fTasa)  || 0
  const previewCuotas = parseInt(fCuotas)  || 0
  const previewCuota  = calcularCuotaBase(previewMonto, previewTasa, previewCuotas)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getEmpleadoName(empleadoId: string): string {
    const emp = empleadosActivos.find(e => e.id === empleadoId)
    return emp ? fullName(emp) : 'Empleado desconocido'
  }

  function getEmpleadoInitials(empleadoId: string): string {
    const emp = empleadosActivos.find(e => e.id === empleadoId)
    if (!emp) return '?'
    return `${emp.nombre[0]}${emp.apellido[0]}`
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleOtorgar(e: React.FormEvent) {
    e.preventDefault()
    if (!fEmpleado || previewMonto <= 0 || previewCuotas <= 0) return
    otorgar({
      empleadoId:        fEmpleado,
      monto:             previewMonto,
      tasaInteres:       previewTasa,
      cuotas:            previewCuotas,
      cuotaBase:         previewCuota,
      frecuencia:        fFrecuencia,
      fechaOtorgamiento: new Date().toISOString().split('T')[0],
      notas:             fNotas.trim() || undefined,
    })
    // Reset form
    setFEmpleado('')
    setFMonto('')
    setFTasa('0')
    setFCuotas('12')
    setFNotas('')
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
    const updated = prestamos.find(p => p.id === prestamoId)
    if (updated) setPrestamoSeleccionado(updated)
    setToast('Pago registrado exitosamente')
  }

  function handleVerDetalle(prestamo: Prestamo) {
    setPrestamoSeleccionado(prestamo)
    setVista('detalle')
  }

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
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors"
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
            <form onSubmit={handleOtorgar} className="p-5">
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
                      <option key={emp.id} value={emp.id}>{fullName(emp)}</option>
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
                <div>
                  <label className={labelCls}>Cuotas <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputCls}
                    value={fCuotas}
                    onChange={e => setFCuotas(e.target.value)}
                    placeholder="12"
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
                <div>
                  <label className={labelCls}>Notas</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={fNotas}
                    onChange={e => setFNotas(e.target.value)}
                    placeholder="Motivo del préstamo…"
                  />
                </div>
              </div>

              {/* Live cuota preview */}
              {previewMonto > 0 && previewCuotas > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#1B2980]/20 dark:border-indigo-600/30 bg-[#eef0fb] dark:bg-indigo-950/30 px-4 py-3">
                  <DollarSign className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#1B2980] dark:text-indigo-300">Cuota calculada</p>
                    <p className="text-lg font-bold tabular-nums text-[#1B2980] dark:text-indigo-200">
                      {formatRD(previewCuota)}
                      <span className="ml-1 text-xs font-normal opacity-70">/ {frecuenciaLabel(fFrecuencia).toLowerCase()}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-3">
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
                  className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Otorgar Préstamo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 px-6 mb-4">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFiltro(tab.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filtro === tab.value
                  ? 'bg-[#1B2980] text-white dark:bg-indigo-600'
                  : 'border border-zinc-200 dark:border-[#252840] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
            {prestamosFiltrados.length} resultado{prestamosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Loan table */}
        <div className="px-6 pb-6">
          {prestamosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 text-center shadow-sm dark:shadow-none">
              <FileText className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-3" />
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No hay préstamos en esta categoría</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                {filtro === 'activo' ? 'Usa el botón "Nuevo Préstamo" para registrar uno.' : 'Cambia el filtro para ver otros registros.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      {['Empleado', 'Monto Original', 'Saldo Pendiente', 'Cuota', 'Cuotas', 'Tasa', 'Frecuencia', 'Fecha', 'Estado', ''].map(h => (
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
                      const pct     = (prestamo.monto - prestamo.saldoPendiente) / prestamo.monto * 100
                      const empName = getEmpleadoName(prestamo.empleadoId)
                      const initials = getEmpleadoInitials(prestamo.empleadoId)

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
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{empName}</span>
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
