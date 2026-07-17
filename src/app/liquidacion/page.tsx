'use client'

import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { Header } from '@/components/layout/Header'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { usePeriodos } from '@/lib/periodos-context'
import { useLiquidaciones } from '@/lib/liquidaciones-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import { useVacaciones } from '@/lib/vacaciones-context'
import {
  calcularCesantiaDetalle, calcularPreavisoDetalle, calcularAsistenciaEconomicaDetalle,
  calcularSalarioPromedioUltimos12Meses, getDivisorSalarioDiario, getDiasPreavisoRequeridos,
  calcularDiasTrabajadosPendientes, calcularNomina, MOTIVO_LIQUIDACION_LABELS, regaliaPagadaVigente,
  calcularDiasVacacionesAcumulados,
} from '@/lib/dominican-labor'
import { formatRD, formatNum, formatDate, formatAnosServicio, formatCedula, fullName, BTN_PRIMARY } from '@/lib/utils'
import type { Empleado, Empresa, MotivoLiquidacion, ConceptoLiquidacion, DesgloseConceptoLiquidacion, RegistroLiquidacion } from '@/types'
import {
  Download, FileText, UserMinus, CalendarDays, Banknote, HandCoins,
  AlertTriangle, History, Info, CheckCircle2, XCircle, Clock, Pencil,
  ArrowRight, ArrowLeft, Wallet, Landmark, ShieldCheck, PartyPopper, Printer, Calculator,
} from 'lucide-react'

type Motivo = MotivoLiquidacion
type Paso = 1 | 2 | 3 | 'exito'
type MetodoPago = 'cheque' | 'efectivo' | 'transferencia'

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

const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  cheque: 'Cheque',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia Bancaria',
}
const METODO_PAGO_ICONS: Record<MetodoPago, typeof Wallet> = {
  cheque: FileText,
  efectivo: Wallet,
  transferencia: Landmark,
}
const METODO_PAGO_REF_LABEL: Record<MetodoPago, string> = {
  cheque: 'Número de cheque (opcional)',
  efectivo: 'Referencia / recibo (opcional)',
  transferencia: 'Número de referencia (opcional)',
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

// ── Planilla en PDF — Recibo de Descargo y Liquidación de Prestaciones ─────
// Documento pensado para que empleado y empleador firmen: usa el snapshot
// desgloseCalculo/metodoPago ya persistido en el registro (nunca recalcula
// nada en vivo — el empleado ya está inactivo, así que el registro es la
// única fuente de verdad, igual criterio que PeriodoNomina.resultadosPorEmpleado
// en Nómina). Mismo lenguaje visual que descargarComprobantePDF en Nómina
// (header navy, tarjetas tenues, caja de total con filo superior claro,
// pie de página fijo) para que los documentos de la app se vean consistentes.
function descargarPlanillaLiquidacionPDF(liquidacion: RegistroLiquidacion, empleado: Empleado, empresa: Empresa) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const NR = 27, NG = 41, NB = 128
  const LINE_GRAY: [number, number, number] = [228, 228, 231]

  doc.setFillColor(NR, NG, NB)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFillColor(47, 63, 168)
  doc.rect(0, 27, W, 1, 'F')

  let tX = 14
  if (empresa.logo) {
    try {
      const fmt = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, fmt, 14, 5, 18, 18)
      tX = 36
    } catch { /* logo corrupto o formato no soportado — se omite */ }
  }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.nombre || 'Empresa', tX, 12)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(210, 214, 240)
  doc.text(`RNC: ${empresa.rnc || '—'}  ·  ${empresa.ciudad || 'República Dominicana'}`, tX, 18)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('RECIBO DE DESCARGO Y LIQUIDACIÓN', W - 14, 11, { align: 'right' })
  doc.text('DE PRESTACIONES LABORALES', W - 14, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(210, 214, 240)
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-DO')}`, W - 14, 22.5, { align: 'right' })

  let y = 36
  doc.setFillColor(250, 250, 251)
  doc.setDrawColor(...LINE_GRAY)
  doc.roundedRect(14, y, W - 28, 27, 2, 2, 'FD')
  y += 7
  doc.setTextColor(NR, NG, NB)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(fullName(empleado), 20, y)
  y += 5
  doc.setFontSize(7.6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110, 110, 116)
  doc.text(`${empleado.cargo}  ·  ${empleado.departamento}  ·  Cédula: ${formatCedula(empleado.cedula)}`, 20, y)
  y += 4.3
  doc.text(`Ingreso: ${formatDate(empleado.fechaIngreso)}   Salida: ${formatDate(liquidacion.fechaTerminacion)}   Antigüedad: ${formatAnosServicio(liquidacion.anosServicio)}`, 20, y)
  y += 4.3
  doc.text(`Motivo de terminación: ${MOTIVO_LABELS[liquidacion.motivo]}`, 20, y)
  y += 11

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('DESGLOSE DEL CÁLCULO', 14, y)
  y += 5.5

  const desglose = liquidacion.desgloseCalculo ?? []
  desglose.forEach((d, i) => {
    if (i > 0) {
      doc.setDrawColor(240, 240, 242)
      doc.line(14, y - 3, W - 14, y - 3)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40, 40, 40)
    doc.text(d.label, 14, y)
    const labelWidth = doc.getTextWidth(d.label)   // medido mientras la fuente sigue en bold/8pt
    doc.setFontSize(6.6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(d.articulo, 14 + labelWidth + 3, y)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(formatRD(d.montoFinal), W - 14, y, { align: 'right' })
    y += 3.8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.6)
    doc.setTextColor(130, 130, 130)
    d.detalle.forEach(line => { doc.text(line, 16, y); y += 3.3 })
    if (d.ajustado) {
      doc.setTextColor(180, 120, 10)
      doc.setFont('helvetica', 'italic')
      doc.text(`Ajustado manualmente — motivo: ${d.motivoAjuste}`, 16, y)
      y += 3.3
    }
    y += 3
  })

  doc.setDrawColor(...LINE_GRAY)
  doc.line(14, y, W - 14, y)
  y += 5

  if ((liquidacion.saldoISRReembolsado ?? 0) > 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(16, 150, 100)
    doc.text('Saldo ISR a favor reembolsado', 14, y)
    doc.text(`+${formatRD(liquidacion.saldoISRReembolsado!)}`, W - 14, y, { align: 'right' })
    y += 4.5
  }
  if (liquidacion.totalPrestamosDescontados > 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(190, 40, 40)
    doc.text('Descuento por préstamos/avances pendientes', 14, y)
    doc.text(`-${formatRD(liquidacion.totalPrestamosDescontados)}`, W - 14, y, { align: 'right' })
    y += 4.5
  }
  y += 3

  doc.setFillColor(NR, NG, NB)
  doc.roundedRect(14, y, W - 28, 16, 2.5, 2.5, 'F')
  doc.setFillColor(47, 63, 168)
  doc.roundedRect(14, y, W - 28, 4, 2.5, 2.5, 'F')
  doc.setFillColor(NR, NG, NB)
  doc.rect(14, y + 3, W - 28, 13, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('TOTAL NETO A PAGAR', 22, y + 6.5)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(formatRD(liquidacion.totalPagado), W - 22, y + 11.5, { align: 'right' })
  y += 22

  if (liquidacion.metodoPago) {
    doc.setFillColor(247, 248, 252)
    doc.setDrawColor(...LINE_GRAY)
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'FD')
    doc.setFontSize(7.4)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(NR, NG, NB)
    doc.text('MÉTODO DE PAGO', 20, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const refTxt = liquidacion.referenciaPago ? `  —  Ref. ${liquidacion.referenciaPago}` : ''
    doc.text(`${METODO_PAGO_LABELS[liquidacion.metodoPago]}${refTxt}`, 20, y + 9.5)
    y += 18
  } else {
    y += 4
  }

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  const nota = `El/la trabajador(a) declara recibir a su entera satisfacción el pago de las prestaciones laborales detalladas en este documento, correspondientes a su relación laboral con ${empresa.nombre || 'la empresa'}, y acepta como correcto y válido el cálculo aquí presentado.`
  const notaLines = doc.splitTextToSize(nota, W - 28) as string[]
  doc.text(notaLines, 14, y)
  y += notaLines.length * 3.6 + 16

  if (y > 250) { doc.addPage(); y = 30 }
  const sigY = y
  doc.setDrawColor(120, 120, 120)
  doc.line(20, sigY, 90, sigY)
  doc.line(120, sigY, 190, sigY)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text(fullName(empleado).toUpperCase(), 55, sigY + 4, { align: 'center' })
  doc.text((empresa.nombre || 'EMPRESA').toUpperCase(), 155, sigY + 4, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Empleado(a)', 55, sigY + 8, { align: 'center' })
  doc.text('Empleador / Representante', 155, sigY + 8, { align: 'center' })
  doc.text(`Cédula: ${formatCedula(empleado.cedula)}`, 55, sigY + 12, { align: 'center' })
  doc.text('Fecha: ____ / ____ / ______', 155, sigY + 12, { align: 'center' })

  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(NR, NG, NB)
  doc.setLineWidth(0.6)
  doc.line(14, pageH - 12, W - 14, pageH - 12)
  doc.setLineWidth(0.2)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('Cielo Cloud · Nómina', 14, pageH - 8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(170, 170, 170)
  doc.text('Ley 16-92 · Código de Trabajo — República Dominicana', W - 14, pageH - 8, { align: 'right' })

  doc.save(`recibo-descargo-${fullName(empleado).replace(/\s+/g, '-')}.pdf`)
}

// ── Tarjeta de concepto editable ────────────────────────────────────────────
// Cada concepto (Cesantía, Preaviso, etc.) muestra su fórmula completa y
// permite sobrescribir el monto a mano — el sistema sigue mostrando el valor
// calculado como referencia, pero el usuario decide el monto final, con un
// motivo obligatorio que queda impreso en la planilla de firma. Lenguaje
// visual propio de este módulo (no imitado de Préstamos/Reportería):
// insignia con degradado + halo por concepto, tarjeta con lift al hover y
// sombra teñida, y la fórmula presentada como panel con tinte de color en
// vez de texto gris suelto.
interface ColoresConcepto {
  border: string
  text: string
  panelBg: string
  gradFrom: string
  gradTo: string
  halo: string
  hoverShadow: string
}

function ConceptoLiquidacionCard({
  titulo, articulo, colores, Icon, montoAuto, montoFinal, detalle, override, onGuardar, onQuitar,
}: {
  titulo: string
  articulo: string
  colores: ColoresConcepto
  Icon: typeof UserMinus
  montoAuto: number
  montoFinal: number
  detalle: string[]
  override?: { monto: number; motivo: string }
  onGuardar: (monto: number, motivo: string) => void
  onQuitar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [montoInput, setMontoInput] = useState('')
  const [motivoInput, setMotivoInput] = useState('')

  function iniciarEdicion() {
    setMontoInput(String(override?.monto ?? montoAuto))
    setMotivoInput(override?.motivo ?? '')
    setEditando(true)
  }
  function guardar() {
    const monto = parseFloat(montoInput)
    if (isNaN(monto) || monto < 0 || !motivoInput.trim()) return
    onGuardar(monto, motivoInput.trim())
    setEditando(false)
  }

  return (
    <div className={`group relative rounded-2xl border ${colores.border} bg-white dark:bg-[#141722] shadow-sm dark:shadow-none ${colores.hoverShadow} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className={`absolute inset-0 rounded-2xl ${colores.halo} blur-md opacity-30 group-hover:opacity-50 transition-opacity`} />
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ backgroundImage: `linear-gradient(135deg, ${colores.gradFrom}, ${colores.gradTo})` }}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wide ${colores.text}`}>{titulo}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{articulo}</p>
            </div>
          </div>
          {!editando && (
            <button
              onClick={iniciarEdicion}
              title={override ? 'Editar ajuste' : 'Ajustar manualmente'}
              className="shrink-0 rounded-lg p-1.5 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:!text-[#1B2980] dark:hover:!text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-all"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!editando ? (
          <>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${colores.text}`}>{formatRD(montoFinal, 2)}</p>
            {detalle.length > 0 && (
              <div className={`mt-3 rounded-lg ${colores.panelBg} px-3 py-2 space-y-0.5`}>
                {detalle.map((linea, i) => (
                  <p key={i} className="text-[10.5px] leading-snug text-zinc-600 dark:text-zinc-400 tabular-nums">{linea}</p>
                ))}
              </div>
            )}
            {override && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5">
                <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-700 dark:text-amber-400">
                  <Pencil className="h-3 w-3 shrink-0 mt-0.5" /> Ajustado de {formatRD(montoAuto, 2)} — {override.motivo}
                </p>
                <button onClick={onQuitar} className="shrink-0 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                  Restaurar
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Monto (RD$)</label>
              <input
                type="number" step="0.01" min="0" value={montoInput}
                onChange={e => setMontoInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Motivo del ajuste (requerido)</label>
              <input
                type="text" value={motivoInput} onChange={e => setMotivoInput(e.target.value)}
                placeholder="Ej. Acordado entre las partes no pagar preaviso"
                className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-0.5">
              <button onClick={() => setEditando(false)} className="rounded-lg border border-zinc-200 dark:border-[#252840] px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!motivoInput.trim() || montoInput === '' || isNaN(parseFloat(montoInput))}
                className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiquidacionPage() {
  const { empleadosActivos, empleados, update } = useEmpleados()
  const { empresa } = useEmpresa()
  const { getPrestamosActivos, registrarPago } = usePrestamos()
  const { periodos } = usePeriodos()
  const { liquidaciones, registrar } = useLiquidaciones()
  const { diasTomados } = useVacaciones()
  const { getSaldosActivos, liquidar: liquidarSaldoISR } = useSaldoISR()

  const [paso, setPaso] = useState<Paso>(1)
  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [motivo, setMotivo] = useState<Motivo | ''>('')
  const [fechaTerminacion, setFechaTerminacion] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [fechaNotificacionRenuncia, setFechaNotificacionRenuncia] = useState<string>('')
  const [prestamosADescontar, setPrestamosADescontar] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Partial<Record<ConceptoLiquidacion, { monto: number; motivo: string }>>>({})
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>('')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [confirmoRevision, setConfirmoRevision] = useState(false)
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ultimaLiquidacion, setUltimaLiquidacion] = useState<{ liquidacion: RegistroLiquidacion; empleado: Empleado } | null>(null)

  const pendientesLiquidar = useMemo(
    () => empleadosActivos.filter(e => e.salidaPendiente),
    [empleadosActivos]
  )

  useEffect(() => {
    const idFromUrl = new URLSearchParams(window.location.search).get('empleadoId')
    if (idFromUrl) setEmpleadoId(idFromUrl)
  }, [])

  // Al cambiar de empleado (incluso al vaciar la selección) se reinicia todo
  // el estado del asistente — evita arrastrar ajustes/método de pago de una
  // liquidación a otra por accidente.
  useEffect(() => {
    setOverrides({})
    setMetodoPago('')
    setReferenciaPago('')
    setConfirmoRevision(false)
    setPaso(1)
    const e = empleadosActivos.find(x => x.id === empleadoId)
    if (!e?.salidaPendiente) return
    if (e.motivoSalidaPendiente) setMotivo(e.motivoSalidaPendiente)
    if (e.fechaSalidaPendiente) setFechaTerminacion(e.fechaSalidaPendiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId])

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])
  const liquidacionesOrdenadas = useMemo(
    () => [...liquidaciones].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    [liquidaciones]
  )
  const totalPagadoGeneral = liquidaciones.reduce((s, l) => s + l.totalPagado, 0)

  // ── Cálculo automático (el motor legal — nunca se modifica en sitio) ──────
  const emp = empleadosActivos.find(e => e.id === empleadoId) ?? null
  const prestamosActivos = emp ? getPrestamosActivos(emp.id) : []
  const saldosISRActivos = emp ? getSaldosActivos(emp.id) : []
  const saldoISRPendiente = saldosISRActivos.reduce((s, x) => s + x.saldoPendiente, 0)

  const resultado = (() => {
    if (!emp || !motivo) return null

    const fechaHire = new Date(emp.fechaIngreso)
    const fechaTerm = new Date(fechaTerminacion)
    const anosServicio = (fechaTerm.getTime() - fechaHire.getTime()) / (365.25 * 24 * 3600 * 1000)

    const inicioAnio = new Date(fechaTerm.getFullYear(), 0, 1)
    const inicioComputoRegalia = fechaHire.getTime() > inicioAnio.getTime() ? fechaHire : inicioAnio
    const mesesCalendario = Math.min(
      Math.ceil((fechaTerm.getTime() - inicioComputoRegalia.getTime()) / (30.44 * 24 * 3600 * 1000)),
      12
    )

    const salarioOrdinario = calcularSalarioPromedioUltimos12Meses(emp, periodos, fechaTerm)
    const divisorDiario    = getDivisorSalarioDiario(emp)

    const aplicaCesantiaPreaviso = motivo === 'despido_sin_causa' || motivo === 'mutuo_acuerdo'
    const cesantiaDetalle = aplicaCesantiaPreaviso
      ? calcularCesantiaDetalle(salarioOrdinario, anosServicio, divisorDiario)
      : { dias: 0, tarifaDiaria: salarioOrdinario / divisorDiario, total: 0, tramo: `No genera cesantía automáticamente para "${MOTIVO_LABELS[motivo]}" (Art. 75/80)` }
    const preavisoDetalle = aplicaCesantiaPreaviso
      ? calcularPreavisoDetalle(salarioOrdinario, anosServicio, divisorDiario)
      : { dias: 0, tarifaDiaria: salarioOrdinario / divisorDiario, total: 0, tramo: `No genera preaviso automáticamente para "${MOTIVO_LABELS[motivo]}" (Art. 75/76)` }
    const asistenciaDetalle = motivo === 'vencimiento_contrato'
      ? calcularAsistenciaEconomicaDetalle(salarioOrdinario, anosServicio, divisorDiario)
      : { dias: 0, tarifaDiaria: salarioOrdinario / divisorDiario, total: 0, tramo: `Solo aplica a "Vencimiento de Contrato" (Art. 74/82)` }

    const cesantia = cesantiaDetalle.total
    const preaviso = preavisoDetalle.total
    const asistenciaEconomica = asistenciaDetalle.total

    const diasVacAnuales = anosServicio >= 5 ? 18 : 14
    // calcularDiasVacacionesAcumulados compone TODOS los años completos de
    // servicio (a la tasa vigente en cada uno) + la fracción del año en
    // curso — no solo el ciclo actual, que descartaría años completos nunca
    // disfrutados (un empleado con 1 año 5 meses sin tomar vacaciones debe
    // acumular ~19.8 días, no ~5.8). Se resta lo ya disfrutado/vendido
    // (Disfrute de Vacaciones, /vacaciones) antes de calcular lo pendiente
    // por pagar — de lo contrario esos días se cobrarían DOS veces (una en
    // Nómina al gozarlos/venderlos, otra aquí al liquidar).
    const diasVacAcum = Math.max(0, calcularDiasVacacionesAcumulados(anosServicio, emp.saldoVacacionesInicial ?? 0) - diasTomados(emp.id))
    const tarifaDiariaVac = emp.salarioBase / divisorDiario
    const vacacionesBruto = diasVacAcum * tarifaDiariaVac
    // Las vacaciones SÍ son salario ordinario continuado (Art. 178, Código de
    // Trabajo) — a diferencia de cesantía/preaviso/asistencia económica
    // (indemnizaciones exentas) y de la Regalía Pascual (100% exenta, Art.
    // 219), llevan AFP/SFS/ISR normales si el monto supera la exención del
    // ISR. Mismo mecanismo ya usado para "días trabajados pendientes": se
    // trata el monto como si fuera el salario del mes y se calcula con el
    // motor real (calcularNomina), topado en AFP/SFS y con ISR vía los
    // tramos anuales normales sobre el monto anualizado ×12.
    const vacacionesCalc = calcularNomina({ ...emp, salarioBase: vacacionesBruto })
    const afpVacaciones = vacacionesCalc.afpEmpleado
    const sfsVacaciones = vacacionesCalc.sfsEmpleado
    const isrVacaciones = vacacionesCalc.isrMensual
    const vacaciones = vacacionesCalc.salarioNeto

    const regaliaBruta = (emp.salarioBase / 12) * mesesCalendario
    const regalia = Math.max(0, regaliaBruta - regaliaPagadaVigente(emp, fechaTerm.getFullYear()))

    const diasPendData = emp.pagoDiasTrabajadosPendiente === 'liquidacion'
      ? calcularDiasTrabajadosPendientes(emp, periodos, fechaTerm)
      : null
    const diasTrabajadosCalc = diasPendData
      ? calcularNomina(emp, { diasTrabajados: diasPendData.diasTrabajados, diasLaborablesMes: diasPendData.diasLaborablesMes })
      : null
    const diasTrabajadosPendientes = diasPendData?.diasTrabajados ?? 0
    const salarioDiasTrabajadosBruto = diasTrabajadosCalc?.totalBruto ?? 0
    const afpDiasTrabajados = diasTrabajadosCalc?.afpEmpleado ?? 0
    const sfsDiasTrabajados = diasTrabajadosCalc?.sfsEmpleado ?? 0
    const isrDiasTrabajados = diasTrabajadosCalc?.isrMensual ?? 0
    const salarioDiasTrabajadosNeto = diasTrabajadosCalc?.salarioNeto ?? 0

    const totalPrestamos = prestamosADescontar.reduce((s, pid) => {
      const p = prestamosActivos.find(x => x.id === pid)
      return s + (p?.saldoPendiente ?? 0)
    }, 0)

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
      anosServicio, mesesCalendario, salarioOrdinario,
      cesantia, cesantiaDetalle, preaviso, preavisoDetalle, asistenciaEconomica, asistenciaDetalle,
      vacaciones, vacacionesBruto, afpVacaciones, sfsVacaciones, isrVacaciones,
      diasVacAcum, diasVacAnuales, tarifaDiariaVac,
      regalia, regaliaBruta,
      totalPrestamos, saldoISR: saldoISRPendiente,
      diasPreavisoRequeridos, diasAnticipacionReal, cumplioPreaviso, diferenciaDiasPreaviso,
      diasTrabajadosPendientes, salarioDiasTrabajadosBruto, afpDiasTrabajados,
      sfsDiasTrabajados, isrDiasTrabajados, salarioDiasTrabajadosNeto,
      fechaInicioDiasTrabajados: diasPendData?.fechaInicio ?? null,
    }
  })()

  const diasSinCubrirPorNomina = (emp?.pagoDiasTrabajadosPendiente === 'nomina' && motivo)
    ? calcularDiasTrabajadosPendientes(emp, periodos, new Date(fechaTerminacion))
    : null

  // ── Metadata por concepto: título, colores, fórmula ya formateada ─────────
  const conceptoMeta: Record<ConceptoLiquidacion, { titulo: string; articulo: string; colores: ColoresConcepto; Icon: typeof UserMinus; montoAuto: number; detalle: string[] }> | null =
    (resultado && emp) ? {
      cesantia: {
        titulo: 'Cesantía', articulo: 'Art. 80 — Código de Trabajo',
        colores: {
          border: 'border-rose-200 dark:border-rose-800/40', text: 'text-rose-700 dark:text-rose-300',
          panelBg: 'bg-rose-50/70 dark:bg-rose-950/20', gradFrom: '#e11d48', gradTo: '#fb7185',
          halo: 'bg-rose-500', hoverShadow: 'hover:shadow-rose-500/10',
        },
        Icon: UserMinus,
        montoAuto: resultado.cesantia,
        detalle: [
          resultado.cesantiaDetalle.tramo,
          ...(resultado.cesantiaDetalle.dias > 0 ? [`${formatNum(resultado.cesantiaDetalle.dias, 0)} días × ${formatRD(resultado.cesantiaDetalle.tarifaDiaria, 2)}/día`] : []),
        ],
      },
      preaviso: {
        titulo: 'Preaviso', articulo: 'Art. 76 — Código de Trabajo',
        colores: {
          border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300',
          panelBg: 'bg-amber-50/70 dark:bg-amber-950/20', gradFrom: '#d97706', gradTo: '#fbbf24',
          halo: 'bg-amber-500', hoverShadow: 'hover:shadow-amber-500/10',
        },
        Icon: CalendarDays,
        montoAuto: resultado.preaviso,
        detalle: [
          resultado.preavisoDetalle.tramo,
          ...(resultado.preavisoDetalle.dias > 0 ? [`${formatNum(resultado.preavisoDetalle.dias, 0)} días × ${formatRD(resultado.preavisoDetalle.tarifaDiaria, 2)}/día`] : []),
        ],
      },
      asistenciaEconomica: {
        titulo: 'Asistencia Económica', articulo: 'Art. 82 — Código de Trabajo',
        colores: {
          border: 'border-violet-200 dark:border-violet-800/40', text: 'text-violet-700 dark:text-violet-300',
          panelBg: 'bg-violet-50/70 dark:bg-violet-950/20', gradFrom: '#7c3aed', gradTo: '#a78bfa',
          halo: 'bg-violet-500', hoverShadow: 'hover:shadow-violet-500/10',
        },
        Icon: HandCoins,
        montoAuto: resultado.asistenciaEconomica,
        detalle: [
          resultado.asistenciaDetalle.tramo,
          ...(resultado.asistenciaDetalle.dias > 0 ? [`${formatNum(resultado.asistenciaDetalle.dias, 2)} días × ${formatRD(resultado.asistenciaDetalle.tarifaDiaria, 2)}/día`] : []),
        ],
      },
      vacaciones: {
        titulo: 'Vacaciones No Gozadas', articulo: 'Art. 177/178 — con AFP/SFS/ISR',
        colores: {
          border: 'border-sky-200 dark:border-sky-800/40', text: 'text-sky-700 dark:text-sky-300',
          panelBg: 'bg-sky-50/70 dark:bg-sky-950/20', gradFrom: '#0284c7', gradTo: '#38bdf8',
          halo: 'bg-sky-500', hoverShadow: 'hover:shadow-sky-500/10',
        },
        Icon: CalendarDays,
        montoAuto: resultado.vacaciones,
        detalle: [
          `Antigüedad ${formatAnosServicio(resultado.anosServicio)} (Art. 177, compuesto por cada año completo a su tasa vigente + fracción del año en curso)${(emp.saldoVacacionesInicial ?? 0) > 0 ? ` + ${emp.saldoVacacionesInicial} días de saldo inicial` : ''}${diasTomados(emp.id) > 0 ? ` − ${diasTomados(emp.id)} días ya disfrutados/vendidos` : ''} = ${resultado.diasVacAcum.toFixed(2)} días`,
          `${resultado.diasVacAcum.toFixed(2)} días × ${formatRD(resultado.tarifaDiariaVac, 2)}/día = ${formatRD(resultado.vacacionesBruto, 2)} bruto`,
          `Bruto ${formatRD(resultado.vacacionesBruto, 2)} − AFP ${formatRD(resultado.afpVacaciones, 2)} − SFS ${formatRD(resultado.sfsVacaciones, 2)} − ISR ${formatRD(resultado.isrVacaciones, 2)}`,
        ],
      },
      regalia: {
        titulo: 'Regalía Proporcional', articulo: 'Art. 219 — Código de Trabajo',
        colores: {
          border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300',
          panelBg: 'bg-emerald-50/70 dark:bg-emerald-950/20', gradFrom: '#059669', gradTo: '#34d399',
          halo: 'bg-emerald-500', hoverShadow: 'hover:shadow-emerald-500/10',
        },
        Icon: Banknote,
        montoAuto: resultado.regalia,
        detalle: [
          `Salario base ÷ 12 × ${resultado.mesesCalendario} mes(es) del año en curso = ${formatRD(resultado.regaliaBruta, 2)}`,
          ...(regaliaPagadaVigente(emp, new Date(fechaTerminacion).getFullYear()) > 0
            ? [`Menos ${formatRD(regaliaPagadaVigente(emp, new Date(fechaTerminacion).getFullYear()), 2)} ya pagados este año (migración o liquidación previa de Regalía Pascual)`]
            : []),
        ],
      },
      diasTrabajados: {
        titulo: 'Días Trabajados Pendientes', articulo: 'Salario ordinario — con AFP/SFS/ISR',
        colores: {
          border: 'border-indigo-200 dark:border-indigo-800/40', text: 'text-indigo-700 dark:text-indigo-300',
          panelBg: 'bg-indigo-50/70 dark:bg-indigo-950/20', gradFrom: '#4338ca', gradTo: '#818cf8',
          halo: 'bg-indigo-500', hoverShadow: 'hover:shadow-indigo-500/10',
        },
        Icon: Clock,
        montoAuto: resultado.salarioDiasTrabajadosNeto,
        detalle: resultado.diasTrabajadosPendientes > 0
          ? [
              `Del ${formatDate(resultado.fechaInicioDiasTrabajados!.toISOString().slice(0, 10))} al ${formatDate(fechaTerminacion)} — ${resultado.diasTrabajadosPendientes} días`,
              `Bruto ${formatRD(resultado.salarioDiasTrabajadosBruto, 2)} − AFP ${formatRD(resultado.afpDiasTrabajados, 2)} − SFS ${formatRD(resultado.sfsDiasTrabajados, 2)} − ISR ${formatRD(resultado.isrDiasTrabajados, 2)}`,
            ]
          : [
              emp.pagoDiasTrabajadosPendiente === 'nomina'
                ? 'El empleado eligió pagar sus días trabajados por nómina — no se incluyen aquí.'
                : 'Sin días pendientes detectados entre el último período pagado y la fecha de salida.',
            ],
      },
    } : null

  function valorFinal(concepto: ConceptoLiquidacion): number {
    if (!conceptoMeta) return 0
    return overrides[concepto]?.monto ?? conceptoMeta[concepto].montoAuto
  }
  const cesantiaFinal = valorFinal('cesantia')
  const preavisoFinal = valorFinal('preaviso')
  const asistenciaFinal = valorFinal('asistenciaEconomica')
  const vacacionesFinal = valorFinal('vacaciones')
  const regaliaFinal = valorFinal('regalia')
  const diasTrabajadosFinal = valorFinal('diasTrabajados')
  const subtotalFinal = cesantiaFinal + preavisoFinal + asistenciaFinal + vacacionesFinal + regaliaFinal + diasTrabajadosFinal
  const totalPrestamosFinal = resultado?.totalPrestamos ?? 0
  const saldoISRFinal = resultado?.saldoISR ?? 0
  const totalFinal = Math.max(0, subtotalFinal + saldoISRFinal - totalPrestamosFinal)

  const desgloseCalculo: DesgloseConceptoLiquidacion[] | null = conceptoMeta
    ? (Object.keys(conceptoMeta) as ConceptoLiquidacion[]).map(c => {
        const meta = conceptoMeta[c]
        const ov = overrides[c]
        return {
          concepto: c, label: meta.titulo, articulo: meta.articulo, detalle: meta.detalle,
          montoAuto: meta.montoAuto, montoFinal: valorFinal(c),
          ajustado: !!ov, motivoAjuste: ov?.motivo,
        }
      })
    : null

  function handleGuardarOverride(concepto: ConceptoLiquidacion, monto: number, motivoAjuste: string) {
    setOverrides(prev => ({ ...prev, [concepto]: { monto, motivo: motivoAjuste } }))
  }
  function handleQuitarOverride(concepto: ConceptoLiquidacion) {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[concepto]
      return next
    })
  }

  // Exporta a Excel el desglose completo (útil como borrador antes de
  // finalizar) — usa los mismos montos finales (ya con ajustes aplicados)
  // que verá la planilla en PDF.
  async function handleExportExcel() {
    if (!emp || !desgloseCalculo || !motivo) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filas: (string | number)[][] = desgloseCalculo.map(d => [
      d.label, d.articulo, d.detalle.join(' · '), d.montoAuto, d.montoFinal, d.ajustado ? `Sí — ${d.motivoAjuste}` : 'No',
    ])
    if (saldoISRFinal > 0) filas.push(['Saldo ISR a Favor', 'Reembolso — ISR retenido de más', '', saldoISRFinal, saldoISRFinal, 'No'])
    if (totalPrestamosFinal > 0) filas.push(['Descuento Préstamos Pendientes', 'Saldo de préstamos/avances activos', '', -totalPrestamosFinal, -totalPrestamosFinal, 'No'])
    await exportarExcel({
      nombreArchivo: `liquidacion-${fullName(emp).replace(/\s+/g, '-')}-${fechaTerminacion}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Liquidación',
        titulo: `Liquidación — ${fullName(emp)}`,
        subtitulo: `${MOTIVO_LABELS[motivo]} · Terminación: ${formatDate(fechaTerminacion)}`,
        encabezados: ['Concepto', 'Base Legal', 'Detalle del Cálculo', 'Monto Calculado', 'Monto Final', '¿Ajustado?'],
        filas,
        totales: ['TOTAL NETO A PAGAR', '', '', '', totalFinal, ''],
        anchos: [26, 24, 46, 16, 16, 26],
      }],
    })
    setToast('Borrador exportado a Excel')
    setTimeout(() => setToast(null), 2500)
  }

  async function handleExportHistorial() {
    if (liquidacionesOrdenadas.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filas = liquidacionesOrdenadas.map(l => {
      const empL = empMap[l.empleadoId]
      return [
        empL ? fullName(empL) : 'Empleado eliminado',
        empL?.cargo ?? '—',
        MOTIVO_LABELS[l.motivo],
        formatDate(l.fechaTerminacion),
        Number(l.anosServicio.toFixed(2)),
        l.cesantia,
        l.preaviso,
        l.asistenciaEconomica,
        l.vacaciones,
        l.regalia,
        l.diasTrabajadosPendientes ?? 0,
        l.salarioDiasTrabajadosNeto ?? 0,
        l.saldoISRReembolsado ?? 0,
        -l.totalPrestamosDescontados,
        l.totalPagado,
        l.metodoPago ? METODO_PAGO_LABELS[l.metodoPago] : '—',
        formatDate(l.fechaRegistro),
      ]
    })
    const suma = (f: (l: (typeof liquidacionesOrdenadas)[number]) => number) =>
      liquidacionesOrdenadas.reduce((s, l) => s + f(l), 0)
    await exportarExcel({
      nombreArchivo: 'liquidaciones-registradas',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Liquidaciones',
        titulo: 'Liquidaciones Registradas',
        subtitulo: `${liquidacionesOrdenadas.length} liquidación(es) · Ley 16-92`,
        encabezados: [
          'Empleado', 'Cargo', 'Motivo', 'Fecha Terminación', 'Años Servicio',
          'Cesantía', 'Preaviso', 'Asist. Económica', 'Vacaciones', 'Regalía',
          'Días Trab. Pend.', 'Días Trab. (neto)', 'Saldo ISR Reembolsado',
          'Desc. Préstamos', 'Total Pagado', 'Método de Pago', 'Fecha Registro',
        ],
        filas,
        totales: [
          `TOTAL — ${liquidacionesOrdenadas.length} liquidación(es)`, '', '', '', '',
          suma(l => l.cesantia), suma(l => l.preaviso), suma(l => l.asistenciaEconomica),
          suma(l => l.vacaciones), suma(l => l.regalia), '',
          suma(l => l.salarioDiasTrabajadosNeto ?? 0), suma(l => l.saldoISRReembolsado ?? 0),
          -suma(l => l.totalPrestamosDescontados), suma(l => l.totalPagado), '', '',
        ],
        anchos: [24, 18, 20, 16, 13, 14, 13, 15, 13, 13, 13, 15, 16, 14, 15, 16, 16],
        columnasEnteras: [10],
      }],
    })
    setToast('Historial de liquidaciones exportado a Excel')
    setTimeout(() => setToast(null), 2500)
  }

  function handleFinalizarLiquidacion() {
    if (!emp || !resultado || !motivo || !desgloseCalculo || !metodoPago) return

    for (const pid of prestamosADescontar) {
      const p = prestamosActivos.find(x => x.id === pid)
      if (!p) continue
      registrarPago(p.id, {
        fecha: new Date().toISOString(),
        montoPagado: p.saldoPendiente,
        esLiquidacion: true,
      })
    }

    for (const s of saldosISRActivos) {
      liquidarSaldoISR(s.id)
    }

    const nuevaLiquidacion = registrar({
      empleadoId: emp.id,
      motivo,
      fechaTerminacion,
      anosServicio: resultado.anosServicio,
      cesantia: cesantiaFinal,
      preaviso: preavisoFinal,
      asistenciaEconomica: asistenciaFinal,
      vacaciones: vacacionesFinal,
      regalia: regaliaFinal,
      totalPrestamosDescontados: totalPrestamosFinal,
      saldoISRReembolsado: saldoISRFinal,
      totalPagado: totalFinal,
      metodoPago,
      ...(referenciaPago.trim() ? { referenciaPago: referenciaPago.trim() } : {}),
      desgloseCalculo,
      ...(motivo === 'renuncia' && fechaNotificacionRenuncia ? { fechaNotificacionRenuncia } : {}),
      ...(resultado.vacacionesBruto > 0 ? {
        vacacionesBruto: resultado.vacacionesBruto,
        afpVacaciones: resultado.afpVacaciones,
        sfsVacaciones: resultado.sfsVacaciones,
        isrVacaciones: resultado.isrVacaciones,
      } : {}),
      ...(diasTrabajadosFinal > 0 || resultado.diasTrabajadosPendientes > 0 ? {
        diasTrabajadosPendientes: resultado.diasTrabajadosPendientes,
        salarioDiasTrabajadosBruto: resultado.salarioDiasTrabajadosBruto,
        afpDiasTrabajados: resultado.afpDiasTrabajados,
        sfsDiasTrabajados: resultado.sfsDiasTrabajados,
        isrDiasTrabajados: resultado.isrDiasTrabajados,
        salarioDiasTrabajadosNeto: diasTrabajadosFinal,
      } : {}),
    })

    update(emp.id, {
      activo: false,
      salidaPendiente: false,
      fechaSalidaPendiente: undefined,
      motivoSalidaPendiente: undefined,
      pagoDiasTrabajadosPendiente: undefined,
    })

    // OJO: no se limpia empleadoId/motivo aquí a propósito — el efecto que
    // reinicia el asistente está atado a [empleadoId], así que vaciarlo en
    // este mismo momento dispararía ese efecto y pisaría el setPaso('exito')
    // de abajo (React ejecuta el efecto después de este render, ganando la
    // carrera). El formulario se limpia recién cuando el usuario confirma
    // que quiere "Registrar Otra Liquidación" desde la pantalla de éxito.
    setUltimaLiquidacion({ liquidacion: nuevaLiquidacion, empleado: emp })
    setConfirmFinalizar(false)
    setPaso('exito')
  }

  function handleRegistrarOtra() {
    setEmpleadoId('')
    setMotivo('')
    setFechaNotificacionRenuncia('')
    setPrestamosADescontar([])
    setUltimaLiquidacion(null)
    setPaso(1)
  }

  const legalNote = motivo ? LEGAL_NOTES[motivo] : null

  const pasoNumero = paso === 'exito' ? 3 : paso
  const puedeAvanzarPaso1 = !!(emp && motivo && fechaTerminacion)

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Liquidación de Empleado"
        subtitle="Cálculo de prestaciones laborales · Ley 16-92"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Indicador de pasos ────────────────────────────────────────── */}
        {(paso !== 1 || emp) && (
          <div className="rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none px-5 py-4">
            <div className="flex items-center gap-2">
              {([1, 2, 3] as const).map((n, i) => {
                const StepIcon = n === 1 ? UserMinus : n === 2 ? Calculator : Wallet
                return (
                  <div key={n} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-2 ${i > 0 ? 'flex-1' : ''}`}>
                      {i > 0 && (
                        <div className="relative h-0.5 flex-1 rounded-full bg-zinc-200 dark:bg-[#252840] overflow-hidden">
                          <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] dark:from-indigo-500 dark:to-indigo-400 transition-all duration-500 ${pasoNumero > i ? 'w-full' : 'w-0'}`} />
                        </div>
                      )}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                        pasoNumero === n
                          ? 'bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] dark:from-indigo-500 dark:to-indigo-400 text-white shadow-md shadow-[#1B2980]/30 scale-105'
                          : pasoNumero > n
                          ? 'bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400 ring-1 ring-inset ring-[#1B2980]/30 dark:ring-indigo-500/30'
                          : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-500'
                      }`}>
                        {pasoNumero > n ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </div>
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${pasoNumero === n ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {n === 1 ? 'Datos de Terminación' : n === 2 ? 'Cálculo de Prestaciones' : 'Confirmación y Pago'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Pendientes por liquidar (solo paso 1) ────────────────────── */}
        {paso === 1 && pendientesLiquidar.length > 0 && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/20 overflow-hidden">
            <div className="px-5 py-3.5 flex items-center gap-2 border-b border-rose-100 dark:border-rose-900/40">
              <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                {pendientesLiquidar.length} {pendientesLiquidar.length === 1 ? 'liquidación pendiente' : 'liquidaciones pendientes'} por calcular
              </p>
            </div>
            <div className="divide-y divide-rose-100 dark:divide-rose-900/40">
              {pendientesLiquidar.map(e => (
                <button
                  key={e.id}
                  onClick={() => setEmpleadoId(e.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-rose-100/50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fullName(e)}</span>
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {e.cargo} · sale el {formatDate(e.fechaSalidaPendiente!)} · {MOTIVO_LIQUIDACION_LABELS[e.motivoSalidaPendiente!]}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-white dark:bg-[#141722] px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/50">
                    Calcular →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════ PASO 1 — Datos de Terminación ══════════ */}
        {paso === 1 && (
          <>
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</label>
                    <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} className={INPUT_CLASS}>
                      <option value="">— Seleccionar empleado —</option>
                      {empleadosActivos.map(e => (
                        <option key={e.id} value={e.id}>{fullName(e)} — {e.cargo}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Motivo de Terminación</label>
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de Terminación</label>
                    <input type="date" value={fechaTerminacion} onChange={e => setFechaTerminacion(e.target.value)} className={INPUT_CLASS} />
                  </div>
                </div>

                {motivo === 'renuncia' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-100 dark:border-[#1d2035] pt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Fecha en que el Empleado Notificó su Renuncia
                      </label>
                      <input type="date" value={fechaNotificacionRenuncia} onChange={e => setFechaNotificacionRenuncia(e.target.value)} className={INPUT_CLASS} />
                    </div>
                    {resultado && resultado.diasPreavisoRequeridos !== null && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Cumplimiento de Preaviso (Art. 76)
                        </label>
                        {resultado.cumplioPreaviso === null ? (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1.5">
                            Captura la fecha de notificación para verificar el cumplimiento —
                            requiere {resultado.diasPreavisoRequeridos} días de anticipación según la antigüedad del empleado.
                          </p>
                        ) : resultado.cumplioPreaviso ? (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Cumplió
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {resultado.diasAnticipacionReal} días de anticipación (mínimo {resultado.diasPreavisoRequeridos})
                              {resultado.diferenciaDiasPreaviso! > 0 && ` · +${resultado.diferenciaDiasPreaviso} días de más`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/50">
                              <XCircle className="h-3.5 w-3.5" /> Incumplió por {Math.abs(resultado.diferenciaDiasPreaviso!)} días
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

            {/* Tarjeta "timeline" — la relación laboral como recorrido, no
                como una simple grilla de datos. Único en este módulo: dado
                que Liquidación trata literalmente del fin de un recorrido
                (ingreso → salida), visualizarlo como línea de tiempo es más
                elocuente que otro grid de estadísticas como en el resto de
                la app. */}
            {emp && (
              <div className="relative rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
                <div className="px-6 py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-[#1B2980] blur-lg opacity-30" />
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-base font-bold text-white shadow-lg shadow-[#1B2980]/30">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{fullName(emp)}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{emp.cargo} · {emp.departamento}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Salario Base</p>
                      <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(emp.salarioBase)}</p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1B2980] dark:bg-indigo-400 ring-4 ring-[#eef0fb] dark:ring-indigo-950/40" />
                      <div className="relative h-1 flex-1 rounded-full bg-gradient-to-r from-[#1B2980] to-rose-400 dark:from-indigo-500 dark:to-rose-500">
                        {resultado && (
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#eef0fb] dark:bg-indigo-950/40 px-3 py-1 text-xs font-bold text-[#1B2980] dark:text-indigo-300 ring-1 ring-inset ring-[#1B2980]/20 dark:ring-indigo-500/30">
                            {formatAnosServicio(resultado.anosServicio)}
                          </span>
                        )}
                      </div>
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-950/30" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{formatDate(emp.fechaIngreso)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Ingreso</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatDate(fechaTerminacion)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Salida</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {legalNote && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">{legalNote.title}</p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">{legalNote.text}</p>
                  </div>
                </div>
              </div>
            )}

            {!emp && (
              <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
                  <UserMinus className="h-7 w-7 text-zinc-400 dark:text-zinc-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Seleccione un empleado para calcular su liquidación</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Cesantía · Preaviso · Vacaciones no gozadas · Regalía proporcional</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setPaso(2)}
                disabled={!puedeAvanzarPaso1}
                className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm`}
              >
                Continuar al Cálculo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ══════════════════ PASO 2 — Cálculo de Prestaciones ═══════════ */}
        {paso === 2 && emp && motivo && resultado && conceptoMeta && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cálculo de Prestaciones — {fullName(emp)}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Cada tarjeta muestra la fórmula aplicada. Puedes ajustar cualquier monto manualmente si corresponde.
                </p>
              </div>
              <button onClick={() => setPaso(1)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </button>
            </div>

            {resultado.salarioOrdinario > emp.salarioBase + 0.01 && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 flex items-start gap-3">
                <Info className="h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0 mt-0.5" />
                <p className="text-xs text-[#151f66] dark:text-indigo-200">
                  Cesantía, Preaviso y Asistencia Económica se calculan sobre{' '}
                  <strong>{formatRD(resultado.salarioOrdinario, 2)}</strong> (salario ordinario — promedio real de los
                  últimos 12 meses de nómina procesada, incluyendo comisiones y horas extra habituales), en vez del
                  salario base de {formatRD(emp.salarioBase, 2)}, según el criterio de "salario ordinario" para prestaciones laborales.
                </p>
              </div>
            )}

            {diasSinCubrirPorNomina && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-5 py-3.5 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Este empleado eligió pagar sus <strong>{diasSinCubrirPorNomina.diasTrabajados} días trabajados</strong> pendientes
                  por nómina, pero todavía no hay ningún período de Nómina que los cubra. Si finalizas la liquidación ahora sin
                  procesarlos antes en Nómina, esos días quedarán sin pagar en el sistema.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(conceptoMeta) as ConceptoLiquidacion[]).map(c => {
                const meta = conceptoMeta[c]
                return (
                  <ConceptoLiquidacionCard
                    key={c}
                    titulo={meta.titulo}
                    articulo={meta.articulo}
                    colores={meta.colores}
                    Icon={meta.Icon}
                    montoAuto={meta.montoAuto}
                    montoFinal={valorFinal(c)}
                    detalle={meta.detalle}
                    override={overrides[c]}
                    onGuardar={(monto, motivoAjuste) => handleGuardarOverride(c, monto, motivoAjuste)}
                    onQuitar={() => handleQuitarOverride(c)}
                  />
                )
              })}

              {resultado.saldoISR > 0 && (
                <div className="group relative rounded-2xl border border-teal-200 dark:border-teal-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none hover:shadow-lg hover:shadow-teal-500/10 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden p-5">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-teal-500 blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'linear-gradient(135deg, #0d9488, #5eead4)' }}>
                        <Banknote className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">Saldo ISR a Favor</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">ISR retenido de más — se reembolsa, no es editable</p>
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">{formatRD(resultado.saldoISR, 2)}</p>
                </div>
              )}
            </div>

            {prestamosActivos.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
                <div className="border-b border-rose-100 dark:border-rose-900/40 px-5 py-4 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Préstamos y Avances Pendientes</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Seleccione los préstamos/avances a descontar del finiquito</p>
                  </div>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {prestamosActivos.map(p => (
                    <label key={p.id} className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-rose-50/40 dark:hover:bg-rose-950/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={prestamosADescontar.includes(p.id)}
                        onChange={e => setPrestamosADescontar(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-[#252840] text-[#1B2980] focus:ring-[#1B2980]/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {p.notas || (p.tipo === 'avance' ? 'Avance de salario' : 'Préstamo')}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Original: {formatRD(p.monto)} · {p.cuotas} cuotas{p.tasaInteres > 0 && ` · ${p.tasaInteres}% mensual`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">{formatRD(p.saldoPendiente, 2)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">saldo pendiente</p>
                      </div>
                    </label>
                  ))}
                </div>
                {prestamosADescontar.length > 0 && (
                  <div className="border-t border-rose-100 dark:border-rose-900/40 px-5 py-3 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
                    <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">Total a descontar del finiquito</span>
                    <span className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">({formatRD(totalPrestamosFinal, 2)})</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-5 py-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Subtotal prestaciones</p>
                <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(totalFinal, 2)}</p>
              </div>
              <button onClick={() => setPaso(3)} className={BTN_PRIMARY}>
                Continuar a Confirmación y Pago <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ══════════════ PASO 3 — Confirmación y Pago ═══════════════════ */}
        {paso === 3 && emp && motivo && resultado && desgloseCalculo && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Confirmación y Pago — {fullName(emp)}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Revisa el resumen, indica el método de pago y confirma para registrar la salida.</p>
              </div>
              <button onClick={() => setPaso(2)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </button>
            </div>

            {/* Resumen — tarjeta navy de marca con look de "recibo": una vez
                confirmado, esto se vuelve un documento de papel real, así
                que el corte perforado entre el total y el desglose es una
                referencia deliberada a eso, no un capricho decorativo. */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#151f66] dark:from-[#151f66] dark:to-[#0d1240] text-white shadow-lg shadow-[#1B2980]/20 overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">{MOTIVO_LABELS[motivo]}</p>
                    <p className="mt-1 text-sm text-indigo-200">Total Neto a Pagar al Empleado</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-white">{formatRD(totalFinal, 2)}</p>
                    <p className="text-xs text-indigo-200 mt-0.5">Pesos Dominicanos</p>
                  </div>
                </div>

                {/* Perforación tipo recibo desprendible */}
                <div className="relative -mx-6 mt-4">
                  <div className="border-t border-dashed border-white/25" />
                  <div className="absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-50 dark:bg-[#0d0f1a]" />
                  <div className="absolute right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-50 dark:bg-[#0d0f1a]" />
                </div>

                <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {desgloseCalculo.map(d => (
                    <div key={d.concepto}>
                      <p className="text-indigo-200 uppercase tracking-wide flex items-center gap-1">
                        {d.label}{d.ajustado && <Pencil className="h-2.5 w-2.5" />}
                      </p>
                      <p className="font-semibold mt-0.5 text-white">{d.montoFinal > 0 ? formatRD(d.montoFinal) : '—'}</p>
                    </div>
                  ))}
                  {saldoISRFinal > 0 && (
                    <div className="col-span-2 md:col-span-3 border-t border-white/15 pt-3">
                      <p className="text-indigo-200 uppercase tracking-wide">Saldo ISR a Favor</p>
                      <p className="font-semibold mt-0.5 text-teal-300">+{formatRD(saldoISRFinal)}</p>
                    </div>
                  )}
                  {totalPrestamosFinal > 0 && (
                    <div className="col-span-2 md:col-span-3 border-t border-white/15 pt-3">
                      <p className="text-indigo-200 uppercase tracking-wide">Desc. Préstamos</p>
                      <p className="font-semibold mt-0.5 text-rose-300">({formatRD(totalPrestamosFinal)})</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Método de pago */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Método de Pago</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Quedará impreso en la planilla de firma</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['cheque', 'efectivo', 'transferencia'] as const).map(m => {
                    const Icon = METODO_PAGO_ICONS[m]
                    const activo = metodoPago === m
                    return (
                      <button
                        key={m}
                        onClick={() => setMetodoPago(m)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          activo
                            ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30 ring-1 ring-[#1B2980] dark:ring-indigo-500'
                            : 'border-zinc-200 dark:border-[#252840] hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activo ? 'bg-[#1B2980] dark:bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-500 dark:text-zinc-400'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-sm font-medium ${activo ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {METODO_PAGO_LABELS[m]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {metodoPago && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {METODO_PAGO_REF_LABEL[metodoPago]}
                    </label>
                    <input
                      type="text" value={referenciaPago} onChange={e => setReferenciaPago(e.target.value)}
                      placeholder={metodoPago === 'cheque' ? 'Ej. 001234' : metodoPago === 'transferencia' ? 'Ej. TRX-88213' : 'Ej. Recibo #45'}
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Confirmación explícita */}
            <label className={`flex items-start gap-3 rounded-xl border px-5 py-4 cursor-pointer transition-colors ${
              confirmoRevision
                ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20'
                : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
            }`}>
              <input
                type="checkbox" checked={confirmoRevision} onChange={e => setConfirmoRevision(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-[#252840] text-emerald-600 focus:ring-emerald-500/30"
              />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  He revisado y confirmo que estos montos son correctos
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Al registrar la salida, el empleado pasará a inactivo en todo el sistema y se generará la planilla de liquidación para firma.
                </p>
              </div>
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <Download className="h-4 w-4" /> Exportar Borrador (Excel)
              </button>
              <button
                onClick={() => setConfirmFinalizar(true)}
                disabled={!metodoPago || !confirmoRevision}
                className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm`}
              >
                <CheckCircle2 className="h-4 w-4" /> Registrar Salida Definitiva
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════ ÉXITO ══════════════════════════════════ */}
        {paso === 'exito' && ultimaLiquidacion && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 px-6 py-8 text-center">
              <div className="relative mx-auto h-16 w-16">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500 blur-lg opacity-40" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30">
                  <PartyPopper className="h-8 w-8 text-white" />
                </div>
              </div>
              <p className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Liquidación registrada exitosamente</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {fullName(ultimaLiquidacion.empleado)} fue marcado(a) como inactivo(a) — total pagado{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">{formatRD(ultimaLiquidacion.liquidacion.totalPagado, 2)}</strong>
              </p>
            </div>
            <div className="px-6 py-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => descargarPlanillaLiquidacionPDF(ultimaLiquidacion.liquidacion, ultimaLiquidacion.empleado, empresa)}
                className={BTN_PRIMARY}
              >
                <Printer className="h-4 w-4" /> Descargar Planilla de Liquidación (PDF)
              </button>
              <button
                onClick={handleRegistrarOtra}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Registrar Otra Liquidación
              </button>
            </div>
            <div className="border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4 text-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                La planilla incluye el desglose completo del cálculo, el método de pago y las líneas de firma para
                empleado y empleador.
              </p>
            </div>
          </div>
        )}

        {/* ── Liquidaciones registradas ─────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Liquidaciones Registradas</h2>
            </div>
            {liquidacionesOrdenadas.length > 0 && (
              <button
                onClick={handleExportHistorial}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Excel
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha Terminación</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Motivo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Pagado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {liquidacionesOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={5}>
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
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaTerminacion)}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {MOTIVO_LABELS[l.motivo]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">{formatRD(l.totalPagado, 2)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {empL && l.desgloseCalculo && (
                          <button
                            onClick={() => descargarPlanillaLiquidacionPDF(l, empL, empresa)}
                            title="Descargar planilla de liquidación (PDF)"
                            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-[#1B2980] dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}
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
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">{formatRD(totalPagadoGeneral, 2)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>

      {/* ── Confirm finalizar dialog ───────────────────────────────────── */}
      {confirmFinalizar && emp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl animate-modal-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿Registrar salida definitiva?</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Esto registrará la liquidación de <span className="font-medium text-zinc-700 dark:text-zinc-300">{fullName(emp)}</span> por
                  {' '}{formatRD(totalFinal, 2)} (pago vía {metodoPago && METODO_PAGO_LABELS[metodoPago]}) y marcará al empleado como
                  inactivo en todo el sistema (nómina, dashboard y reportes). Esta acción no se puede deshacer.
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
              <button onClick={handleFinalizarLiquidacion} className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors">
                Sí, registrar salida
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
