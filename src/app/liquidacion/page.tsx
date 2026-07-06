'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { usePeriodos } from '@/lib/periodos-context'
import { useLiquidaciones } from '@/lib/liquidaciones-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import { calcularCesantia, calcularPreaviso, calcularAsistenciaEconomica, calcularSalarioPromedioUltimos12Meses, getDivisorSalarioDiario, getDiasPreavisoRequeridos } from '@/lib/dominican-labor'
import { formatRD, formatDate, formatAnosServicio, fullName } from '@/lib/utils'
import type { MotivoLiquidacion } from '@/types'
import { Download, FileText, UserMinus, Briefcase, Building2, CalendarDays, Banknote, HandCoins, AlertTriangle, History, Info, CheckCircle2, XCircle } from 'lucide-react'

type Motivo = MotivoLiquidacion

// ── CSV export ────────────────────────────────────────────────────────────────
function exportarCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = '﻿'
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

const MOTIVO_LABELS: Record<Motivo, string> = {
  renuncia: 'Renuncia Voluntaria',
  despido_sin_causa: 'Despido Sin Causa (Art. 87)',
  despido_con_causa: 'Despido Con Causa (Art. 88)',
  mutuo_acuerdo: 'Mutuo Acuerdo',
  vencimiento_contrato: 'Vencimiento de Contrato (Art. 74/82)',
}

const LEGAL_NOTES: Record<Motivo, { title: string; text: string }> = {
  renuncia: {
    title: 'Art. 75 — Renuncia Voluntaria',
    text: 'El trabajador que renuncia no tiene derecho a cesantía ni preaviso pagado. Se le adeuda vacaciones proporcionales y regalía del período.',
  },
  despido_sin_causa: {
    title: 'Art. 87 — Despido Sin Causa Justificada',
    text: 'El empleador que despide sin causa justificada debe pagar cesantía + preaviso + vacaciones acumuladas + regalía proporcional.',
  },
  despido_con_causa: {
    title: 'Art. 88 — Despido Con Causa Justificada',
    text: 'El despido por causa justificada no genera cesantía ni preaviso, pero el trabajador conserva el derecho a vacaciones acumuladas y regalía proporcional.',
  },
  mutuo_acuerdo: {
    title: 'Acuerdo Bilateral — Mutuo Acuerdo',
    text: 'Los montos son negociables. Se recomienda pagar cesantía + preaviso como base mínima para evitar litigios.',
  },
  vencimiento_contrato: {
    title: 'Art. 74/82 — Vencimiento de Contrato por Tiempo Determinado u Obra',
    text: 'Al terminar un contrato por tiempo determinado o para una obra o servicio determinado (o en casos de terminación sin responsabilidad de las partes), no aplica cesantía ni preaviso. En su lugar corresponde la Asistencia Económica: 5 días (3–6 meses), 10 días (6–12 meses), o 15 días por cada año cumplido más el proporcional del año en curso (12+ meses), además de vacaciones no gozadas y regalía proporcional.',
  },
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

export default function LiquidacionPage() {
  const { empleadosActivos, empleados, update } = useEmpleados()
  const { getPrestamosActivos, registrarPago } = usePrestamos()
  const { periodos } = usePeriodos()
  const { liquidaciones, registrar } = useLiquidaciones()
  const { getSaldosActivos, liquidar: liquidarSaldoISR } = useSaldoISR()
  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [motivo, setMotivo] = useState<Motivo | ''>('')
  const [fechaTerminacion, setFechaTerminacion] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  // Solo aplica cuando motivo === 'renuncia' — fecha en que el empleado avisó
  // que se iba, distinta de fechaTerminacion (fecha efectiva de salida).
  const [fechaNotificacionRenuncia, setFechaNotificacionRenuncia] = useState<string>('')
  const [prestamosADescontar, setPrestamosADescontar] = useState<string[]>([])
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])
  const liquidacionesOrdenadas = useMemo(
    () => [...liquidaciones].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    [liquidaciones]
  )
  const totalPagadoGeneral = liquidaciones.reduce((s, l) => s + l.totalPagado, 0)

  // ── Calculation ────────────────────────────────────────────────────────────
  const emp = empleadosActivos.find(e => e.id === empleadoId) ?? null
  const prestamosActivos = emp ? getPrestamosActivos(emp.id) : []
  const saldosISRActivos = emp ? getSaldosActivos(emp.id) : []
  const saldoISRPendiente = saldosISRActivos.reduce((s, x) => s + x.saldoPendiente, 0)

  const resultado = (() => {
    if (!emp || !motivo) return null

    const fechaHire = new Date(emp.fechaIngreso)
    const fechaTerm = new Date(fechaTerminacion)
    const anosServicio = (fechaTerm.getTime() - fechaHire.getTime()) / (365.25 * 24 * 3600 * 1000)

    // Regalía: proportional to calendar year (Jan 1 → termination)
    const inicioAnio = new Date(fechaTerm.getFullYear(), 0, 1)
    const mesesCalendario = Math.min(
      Math.ceil((fechaTerm.getTime() - inicioAnio.getTime()) / (30.44 * 24 * 3600 * 1000)),
      12
    )

    // Vacaciones: proporcional al ciclo de aniversario, sin truncar el mes en
    // curso — un empleado con 7.65 años acumula 0.65 de su octavo año, no 0
    const mesesCicloVac = anosServicio < 1
      ? anosServicio * 12
      : ((anosServicio % 1) * 12 || 12)

    // Salario ordinario real (promedio últimos 12 meses de nómina procesada,
    // incluye comisiones/horas extra habituales) — nunca menor al salario base.
    // Aplica a Cesantía/Preaviso/Asistencia Económica (Art. 76/80/82 CT), que
    // deben reflejar la capacidad real de ingreso del trabajador, no solo su
    // salario contractual. Vacaciones y Regalía siguen usando el salario base
    // actual, como corresponde a esos conceptos.
    const salarioOrdinario = calcularSalarioPromedioUltimos12Meses(emp, periodos, fechaTerm)
    const divisorDiario    = getDivisorSalarioDiario(emp)

    const cesantia = (motivo === 'despido_sin_causa' || motivo === 'mutuo_acuerdo')
      ? calcularCesantia(salarioOrdinario, anosServicio, divisorDiario)
      : 0

    const preaviso = (motivo === 'despido_sin_causa' || motivo === 'mutuo_acuerdo')
      ? calcularPreaviso(salarioOrdinario, anosServicio, divisorDiario)
      : 0

    const asistenciaEconomica = motivo === 'vencimiento_contrato'
      ? calcularAsistenciaEconomica(salarioOrdinario, anosServicio, divisorDiario)
      : 0

    const diasVacAnuales = anosServicio >= 5 ? 18 : 14
    // + saldo inicial: empleados con historial previo a Cielo Cloud (migración)
    const diasVacAcum = (diasVacAnuales / 12) * mesesCicloVac + (emp.saldoVacacionesInicial ?? 0)
    const vacaciones = diasVacAcum * (emp.salarioBase / divisorDiario)

    // Regalía del año en curso, neta de lo ya pagado antes de la migración
    const regaliaBruta = (emp.salarioBase / 12) * mesesCalendario
    const regalia = Math.max(0, regaliaBruta - (emp.regaliaPagadaEsteAnio ?? 0))

    const subtotal = cesantia + preaviso + asistenciaEconomica + vacaciones + regalia
    const totalPrestamos = prestamosADescontar.reduce((s, pid) => {
      const p = prestamosActivos.find(x => x.id === pid)
      return s + (p?.saldoPendiente ?? 0)
    }, 0)
    // Saldo ISR a favor pendiente: la empresa se lo debe al empleado (ISR
    // retenido de más en el pasado que nunca terminó de acreditarse vía
    // nómina) — se reembolsa completo en la liquidación, no se descuenta.
    const total = Math.max(0, subtotal + saldoISRPendiente - totalPrestamos)

    // Cumplimiento de preaviso en renuncias (Art. 76) — el empleado también
    // debe avisar con la anticipación mínima que le correspondería recibir
    // si fuera despedido (7/14/28 días según antigüedad). Solo se evalúa
    // cuando el motivo es renuncia y se capturó la fecha de notificación.
    const diasPreavisoRequeridos = motivo === 'renuncia' ? getDiasPreavisoRequeridos(anosServicio) : null
    const diasAnticipacionReal = (motivo === 'renuncia' && fechaNotificacionRenuncia)
      ? Math.round((fechaTerm.getTime() - new Date(fechaNotificacionRenuncia).getTime()) / (24 * 3600 * 1000))
      : null
    const cumplioPreaviso = (diasAnticipacionReal !== null && diasPreavisoRequeridos !== null)
      ? diasAnticipacionReal >= diasPreavisoRequeridos
      : null
    const diferenciaDiasPreaviso = (diasAnticipacionReal !== null && diasPreavisoRequeridos !== null)
      ? diasAnticipacionReal - diasPreavisoRequeridos
      : null

    return {
      anosServicio, mesesCicloVac, mesesCalendario, salarioOrdinario, cesantia, preaviso,
      asistenciaEconomica, vacaciones, regalia, subtotal, totalPrestamos, saldoISR: saldoISRPendiente, total,
      diasPreavisoRequeridos, diasAnticipacionReal, cumplioPreaviso, diferenciaDiasPreaviso,
    }
  })()

  function handleExportCSV() {
    if (!emp || !resultado || !motivo) return
    const { cesantia, preaviso, asistenciaEconomica, vacaciones, regalia, subtotal, totalPrestamos, saldoISR, total } = resultado
    const rows: (string | number)[][] = [
      ['Cesantía', cesantia > 0 ? 'Sí' : 'No', cesantia.toFixed(2)],
      ['Preaviso', preaviso > 0 ? 'Sí' : 'No', preaviso.toFixed(2)],
      ['Asistencia Económica', asistenciaEconomica > 0 ? 'Sí' : 'No', asistenciaEconomica.toFixed(2)],
      ['Vacaciones No Gozadas', 'Sí', vacaciones.toFixed(2)],
      ['Regalía Proporcional', 'Sí', regalia.toFixed(2)],
      ['Subtotal Prestaciones', '', subtotal.toFixed(2)],
    ]
    if (saldoISR > 0) {
      rows.push(['Saldo ISR a Favor', 'Sí', saldoISR.toFixed(2)])
    }
    if (totalPrestamos > 0) {
      rows.push(['Descuento Préstamos Pendientes', 'Sí', (-totalPrestamos).toFixed(2)])
    }
    if (resultado.cumplioPreaviso !== null) {
      rows.push([
        'Cumplimiento Preaviso (Art. 76)',
        resultado.cumplioPreaviso ? 'Cumplió' : `Incumplió por ${Math.abs(resultado.diferenciaDiasPreaviso ?? 0)} días`,
        `${resultado.diasAnticipacionReal} de ${resultado.diasPreavisoRequeridos} días requeridos`,
      ])
    }
    rows.push(['TOTAL NETO A PAGAR', '', total.toFixed(2)])
    exportarCSV(
      `liquidacion_${fullName(emp).replace(/\s+/g, '_')}_${fechaTerminacion}.csv`,
      ['Concepto', 'Aplica', 'Monto (RD$)'],
      rows,
    )
    setToast('CSV exportado')
    setTimeout(() => setToast(null), 2500)
  }

  function handleFinalizarLiquidacion() {
    if (!emp || !resultado || !motivo) return

    // Register loan payments as liquidation payments
    for (const pid of prestamosADescontar) {
      const p = prestamosActivos.find(x => x.id === pid)
      if (!p) continue
      registrarPago(p.id, {
        fecha: new Date().toISOString(),
        montoPagado: p.saldoPendiente,
        esLiquidacion: true,
      })
    }

    // Cualquier saldo ISR a favor pendiente se reembolsa completo aquí
    // (ya está incluido en resultado.total) — se marca 'liquidado' para
    // que no se vuelva a aplicar ni a mostrar como pendiente.
    for (const s of saldosISRActivos) {
      liquidarSaldoISR(s.id)
    }

    // Persist the liquidation record — this is the source of truth for
    // the termination details (motivo, montos, fecha)
    registrar({
      empleadoId: emp.id,
      motivo,
      fechaTerminacion,
      anosServicio: resultado.anosServicio,
      cesantia: resultado.cesantia,
      preaviso: resultado.preaviso,
      asistenciaEconomica: resultado.asistenciaEconomica,
      vacaciones: resultado.vacaciones,
      regalia: resultado.regalia,
      totalPrestamosDescontados: resultado.totalPrestamos,
      saldoISRReembolsado: resultado.saldoISR,
      totalPagado: resultado.total,
      ...(motivo === 'renuncia' && fechaNotificacionRenuncia ? { fechaNotificacionRenuncia } : {}),
    })

    // Mark the employee as inactive — this is the only state that needs to
    // change on Empleado; automatically removes them from empleadosActivos
    // across nómina, dashboard y reportes
    update(emp.id, { activo: false })

    handleExportCSV()

    setToast(`Liquidación registrada — ${fullName(emp)} marcado como inactivo`)
    setConfirmFinalizar(false)

    // Reset form — the employee will disappear from empleadosActivos
    setEmpleadoId('')
    setMotivo('')
    setFechaNotificacionRenuncia('')
    setPrestamosADescontar([])
  }

  const legalNote = motivo ? LEGAL_NOTES[motivo] : null

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Liquidación de Empleado"
        subtitle="Cálculo de prestaciones laborales · Ley 16-92"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Selector card ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos de Terminación</h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 ml-6">
              Seleccione el empleado, motivo y fecha de terminación del contrato
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Employee selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Empleado
                </label>
                <select
                  value={empleadoId}
                  onChange={e => setEmpleadoId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">— Seleccionar empleado —</option>
                  {empleadosActivos.map(e => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)} — {e.cargo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Motivo selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Motivo de Terminación
                </label>
                <select
                  value={motivo}
                  onChange={e => {
                    const next = e.target.value as Motivo | ''
                    setMotivo(next)
                    if (next !== 'renuncia') setFechaNotificacionRenuncia('')
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">— Seleccionar motivo —</option>
                  <option value="renuncia">Renuncia Voluntaria</option>
                  <option value="despido_sin_causa">Despido Sin Causa (Art. 87)</option>
                  <option value="despido_con_causa">Despido Con Causa (Art. 88)</option>
                  <option value="mutuo_acuerdo">Mutuo Acuerdo</option>
                  <option value="vencimiento_contrato">Vencimiento de Contrato (Art. 74/82)</option>
                </select>
              </div>

              {/* Fecha de terminación */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Fecha de Terminación
                </label>
                <input
                  type="date"
                  value={fechaTerminacion}
                  onChange={e => setFechaTerminacion(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Fecha de notificación de renuncia — solo cuando el motivo es renuncia (Art. 76) */}
            {motivo === 'renuncia' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-100 dark:border-[#1d2035] pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Fecha en que el Empleado Notificó su Renuncia
                  </label>
                  <input
                    type="date"
                    value={fechaNotificacionRenuncia}
                    onChange={e => setFechaNotificacionRenuncia(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                {resultado && resultado.diasPreavisoRequeridos !== null && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Cumplimiento de Preaviso (Art. 76)
                    </label>
                    {resultado.cumplioPreaviso === null ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1.5">
                        Captura la fecha de notificación para verificar el cumplimiento —
                        requiere {resultado.diasPreavisoRequeridos} días de anticipación
                        según la antigüedad del empleado.
                      </p>
                    ) : resultado.cumplioPreaviso ? (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Cumplió
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {resultado.diasAnticipacionReal} días de anticipación (mínimo {resultado.diasPreavisoRequeridos})
                          {resultado.diferenciaDiasPreaviso! > 0 && ` · +${resultado.diferenciaDiasPreaviso} días de más`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/50">
                          <XCircle className="h-3.5 w-3.5" />
                          Incumplió por {Math.abs(resultado.diferenciaDiasPreaviso!)} días
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {resultado.diasAnticipacionReal! < 0 ? 'Fecha de notificación posterior a la terminación' : `${resultado.diasAnticipacionReal} días de anticipación (mínimo ${resultado.diasPreavisoRequeridos})`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Employee summary card ──────────────────────────────────────── */}
        {emp && (
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos del Empleado</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: '#1B2980' }}
                >
                  {emp.nombre[0]}{emp.apellido[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Cargo</p>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{emp.cargo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Departamento</p>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{emp.departamento}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Fecha Ingreso</p>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{formatDate(emp.fechaIngreso)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Banknote className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Salario Base</p>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{formatRD(emp.salarioBase, 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Seniority badge */}
                {resultado && (
                  <div className="shrink-0 rounded-lg bg-[#eef0fb] dark:bg-indigo-950/40 px-3 py-2 text-center">
                    <p className="text-xs font-semibold text-[#1B2980] dark:text-indigo-400">Antigüedad</p>
                    <p className="text-sm font-bold text-[#1B2980] dark:text-indigo-300 mt-0.5 whitespace-nowrap">
                      {formatAnosServicio(resultado.anosServicio)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Results section ───────────────────────────────────────────── */}
        {emp && motivo && resultado && (
          <>
            {resultado.salarioOrdinario > emp.salarioBase + 0.01 && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 flex items-start gap-3">
                <Info className="h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0 mt-0.5" />
                <p className="text-xs text-[#151f66] dark:text-indigo-200">
                  Cesantía, Preaviso y Asistencia Económica se calculan sobre{' '}
                  <strong>{formatRD(resultado.salarioOrdinario, 2)}</strong> (salario ordinario —
                  promedio real de los últimos 12 meses de nómina procesada, incluyendo comisiones
                  y horas extra habituales), en vez del salario base de {formatRD(emp.salarioBase, 2)},
                  según el criterio de "salario ordinario" para prestaciones laborales.
                </p>
              </div>
            )}

            {/* Concept grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Cesantía */}
              <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Cesantía</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Art. 80 — Código de Trabajo</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400">
                    <UserMinus className="h-4 w-4" />
                  </div>
                </div>
                {resultado.cesantia > 0 ? (
                  <p className="mt-3 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                    {formatRD(resultado.cesantia, 2)}
                  </p>
                ) : (
                  <div className="mt-3">
                    <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      No aplica
                    </span>
                  </div>
                )}
              </div>

              {/* Preaviso */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Preaviso</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Art. 76 — Código de Trabajo</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                </div>
                {resultado.preaviso > 0 ? (
                  <p className="mt-3 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {formatRD(resultado.preaviso, 2)}
                  </p>
                ) : (
                  <div className="mt-3">
                    <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      No aplica
                    </span>
                  </div>
                )}
              </div>

              {/* Asistencia Económica */}
              <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Asistencia Económica</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Art. 82 — Código de Trabajo</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-500 dark:text-violet-400">
                    <HandCoins className="h-4 w-4" />
                  </div>
                </div>
                {resultado.asistenciaEconomica > 0 ? (
                  <p className="mt-3 text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {formatRD(resultado.asistenciaEconomica, 2)}
                  </p>
                ) : (
                  <div className="mt-3">
                    <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      No aplica
                    </span>
                  </div>
                )}
              </div>

              {/* Vacaciones no gozadas */}
              <div className="rounded-xl border border-sky-200 dark:border-sky-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">Vacaciones No Gozadas</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      Art. 177 — {resultado.mesesCicloVac.toFixed(1)} meses × tarifa diaria
                    </p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-500 dark:text-sky-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                  {formatRD(resultado.vacaciones, 2)}
                </p>
              </div>

              {/* Regalía proporcional */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Regalía Proporcional</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      Art. 219 — {resultado.mesesCalendario}/12 del salario
                    </p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400">
                    <Banknote className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatRD(resultado.regalia, 2)}
                </p>
              </div>

              {/* Saldo ISR a Favor */}
              {resultado.saldoISR > 0 && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Saldo ISR a Favor</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">ISR retenido de más — se reembolsa</p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-500 dark:text-teal-400">
                      <Banknote className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                    {formatRD(resultado.saldoISR, 2)}
                  </p>
                </div>
              )}
            </div>

            {/* Préstamos pendientes */}
            {prestamosActivos.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
                <div className="border-b border-rose-100 dark:border-rose-900/40 px-5 py-4 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Préstamos y Avances Pendientes</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Seleccione los préstamos/avances a descontar del finiquito</p>
                  </div>
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {prestamosActivos.map(p => (
                    <label
                      key={p.id}
                      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-rose-50/40 dark:hover:bg-rose-950/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={prestamosADescontar.includes(p.id)}
                        onChange={e => setPrestamosADescontar(prev =>
                          e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                        )}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-[#252840] text-[#1B2980] focus:ring-[#1B2980]/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {p.notas || (p.tipo === 'avance' ? 'Avance de salario' : 'Préstamo')}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Original: {formatRD(p.monto, 0)} · {p.cuotas} cuotas
                          {p.tasaInteres > 0 && ` · ${p.tasaInteres}% mensual`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                          {formatRD(p.saldoPendiente, 2)}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">saldo pendiente</p>
                      </div>
                    </label>
                  ))}
                </div>
                {prestamosADescontar.length > 0 && (
                  <div className="border-t border-rose-100 dark:border-rose-900/40 px-5 py-3 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
                    <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                      Total a descontar del finiquito
                    </span>
                    <span className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                      ({formatRD(resultado.totalPrestamos, 2)})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Total a Pagar */}
            <div className="rounded-xl bg-zinc-950 dark:bg-[#080a12] text-white shadow-sm dark:shadow-none overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {MOTIVO_LABELS[motivo]}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">Total Neto a Pagar al Empleado</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-white">
                      {formatRD(resultado.total, 2)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">Pesos Dominicanos</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-zinc-800 pt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-500 uppercase tracking-wide">Cesantía</p>
                    <p className={`font-semibold mt-0.5 ${resultado.cesantia > 0 ? 'text-rose-300' : 'text-zinc-600'}`}>
                      {resultado.cesantia > 0 ? formatRD(resultado.cesantia, 0) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 uppercase tracking-wide">Preaviso</p>
                    <p className={`font-semibold mt-0.5 ${resultado.preaviso > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>
                      {resultado.preaviso > 0 ? formatRD(resultado.preaviso, 0) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 uppercase tracking-wide">Asist. Económica</p>
                    <p className={`font-semibold mt-0.5 ${resultado.asistenciaEconomica > 0 ? 'text-violet-300' : 'text-zinc-600'}`}>
                      {resultado.asistenciaEconomica > 0 ? formatRD(resultado.asistenciaEconomica, 0) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 uppercase tracking-wide">Vacaciones</p>
                    <p className="font-semibold mt-0.5 text-sky-300">{formatRD(resultado.vacaciones, 0)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 uppercase tracking-wide">Regalía</p>
                    <p className="font-semibold mt-0.5 text-emerald-300">{formatRD(resultado.regalia, 0)}</p>
                  </div>
                  {resultado.saldoISR > 0 && (
                    <div className="col-span-2 md:col-span-5 border-t border-zinc-800 pt-3">
                      <p className="text-zinc-500 uppercase tracking-wide">Saldo ISR a Favor</p>
                      <p className="font-semibold mt-0.5 text-teal-300">
                        +{formatRD(resultado.saldoISR, 0)}
                      </p>
                    </div>
                  )}
                  {resultado.totalPrestamos > 0 && (
                    <div className="col-span-2 md:col-span-5 border-t border-zinc-800 pt-3">
                      <p className="text-zinc-500 uppercase tracking-wide">Desc. Préstamos</p>
                      <p className="font-semibold mt-0.5 text-rose-400">
                        ({formatRD(resultado.totalPrestamos, 0)})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
              <button
                onClick={() => setConfirmFinalizar(true)}
                className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors"
              >
                <Download className="h-4 w-4" />
                Finalizar y Exportar
              </button>
            </div>
          </>
        )}

        {/* ── Legal note ─────────────────────────────────────────────────── */}
        {legalNote && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-4">
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">
                  {legalNote.title}
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                  {legalNote.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Placeholder when nothing selected ────────────────────────── */}
        {!emp && (
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
              <UserMinus className="h-7 w-7 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Seleccione un empleado para calcular su liquidación
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Cesantía · Preaviso · Vacaciones no gozadas · Regalía proporcional
            </p>
          </div>
        )}

        {/* ── Liquidaciones registradas ─────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Liquidaciones Registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha Terminación</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Motivo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {liquidacionesOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <History className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin liquidaciones registradas</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Al finalizar una liquidación quedará registrada aquí y el empleado pasará a inactivo.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {liquidacionesOrdenadas.map(l => {
                  const empL = empMap[l.empleadoId]
                  return (
                    <tr key={l.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        {empL ? (
                          <div>
                            <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(empL)}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">{empL.cargo}</p>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs">Empleado eliminado</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(l.fechaTerminacion)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {MOTIVO_LABELS[l.motivo]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                        {formatRD(l.totalPagado, 2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {liquidacionesOrdenadas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      TOTAL — {liquidacionesOrdenadas.length} liquidación(es)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                      {formatRD(totalPagadoGeneral, 2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>

      {/* ── Confirm finalizar dialog ───────────────────────────────────── */}
      {confirmFinalizar && emp && resultado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl animate-modal-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿Finalizar liquidación?</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Esto registrará la liquidación de <span className="font-medium text-zinc-700 dark:text-zinc-300">{fullName(emp)}</span> por
                  {' '}{formatRD(resultado.total, 2)} y marcará al empleado como inactivo en todo el sistema
                  (nómina, dashboard y reportes). Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmFinalizar(false)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizarLiquidacion}
                className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors"
              >
                Sí, finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
