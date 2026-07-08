'use client'

import { useState, useEffect } from 'react'
import {
  ChevronRight,
  Download,
  Lock,
  Unlock,
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
  History,
  ShieldCheck,
  Mail,
  Send,
  Filter,
  FileSpreadsheet,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { ImportadorHorasExcel } from '@/components/nomina/ImportadorHorasExcel'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos, esPeriodoMasReciente, periodoAnterior } from '@/lib/periodos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useLiquidaciones } from '@/lib/liquidaciones-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import { useFeriados } from '@/lib/feriados-context'
import { useAuth } from '@/lib/auth-context'
import {
  enviarComprobante, plantillaComprobanteDeEmpresa, resolverPlantilla, PLACEHOLDERS_COMPROBANTE,
} from '@/lib/comprobante-email'
import type { PlantillaComprobante } from '@/lib/comprobante-email'
import { calcularNomina, calcularNominaQuincenal, cuotaDependienteSFS, aplicarSaldoISRFavor, prorratearMontoFijo } from '@/lib/dominican-labor'
import { formatRD, fullName, formatCedula, formatDate } from '@/lib/utils'
import jsPDF from 'jspdf'
import type {
  Empleado,
  ResultadoNomina,
  PeriodoNomina,
  TipoPeriodo,
  ParametrosNomina,
  ConceptoAjuste,
  AjusteLinea,
  Empresa,
} from '@/types'
import { UMBRAL_ENDEUDAMIENTO_DEFAULT, UMBRAL_VARIACION_BRUTO_DEFAULT } from '@/types'
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
// Nómina en USD — capa de presentación pura, nunca la base del cálculo. El
// motor tributario (dominican-labor.ts) siempre calcula y persiste en RD$;
// esta función solo convierte lo que ya se calculó para mostrarlo en pantalla,
// usando la tasa que la empresa configura manualmente en Configuración (sin
// conexión a ningún servicio de tasas en vivo). El comprobante en PDF, el CSV
// exportado y la plantilla de correo de pago siguen mostrando RD$ siempre —
// son el registro legal/financiero real, no una vista de conveniencia.
function formatMoneda(amountRD: number, empresa: Empresa, mostrarUSD: boolean, decimals = 2): string {
  if (mostrarUSD && empresa.tasaCambioUSD) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(amountRD / empresa.tasaCambioUSD)
  }
  return formatRD(amountRD, decimals)
}

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
    recargo_nocturno: 'Recargo Nocturno',
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
  return concepto === 'horas_extras_35' || concepto === 'horas_extras_100' || concepto === 'recargo_nocturno'
}

// ── calcularConAjustes ────────────────────────────────────────────────────────
// `diasOverride` prorratea el salario base cuando el empleado no trabajó el
// período completo (ver diasSuspensionEnPeriodo) — ambos valores son días
// calendario en la MISMA unidad, así que la razón diasTrabajados/diasLaborablesMes
// es válida tanto para un período mensual como para media quincena.
function calcularConAjustes(
  empleado: Empleado,
  ajustes: AjusteLinea[],
  tipo: TipoPeriodo,
  quincena: 1 | 2,
  diasOverride?: { diasTrabajados: number; diasLaborablesMes: number } | null,
): ResultadoNomina {
  const horasExtras35   = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a) => s + a.valor, 0)
  const horasExtras100  = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
  const horasNocturnas  = ajustes.filter(a => a.concepto === 'recargo_nocturno').reduce((s, a) => s + a.valor, 0)
  const bonificaciones  = ajustes.filter(a => a.concepto === 'bono' || a.concepto === 'otro_ingreso').reduce((s, a) => s + a.valor, 0)
  const comisiones      = ajustes.filter(a => a.concepto === 'comision').reduce((s, a) => s + a.valor, 0)
  const sfsDependientes = ajustes.filter(a => a.concepto === 'dependiente_sfs').reduce((s, a) => s + a.valor, 0)
  const otrosDescuentos = ajustes.filter(a => a.concepto === 'prestamo' || a.concepto === 'otro_descuento').reduce((s, a) => s + a.valor, 0)
  const params: ParametrosNomina = {
    horasExtras35, horasExtras100, horasNocturnas, bonificaciones, comisiones, sfsDependientes, otrosDescuentos,
    ...(diasOverride ? { diasTrabajados: diasOverride.diasTrabajados, diasLaborablesMes: diasOverride.diasLaborablesMes } : {}),
  }
  return tipo === 'quincenal'
    ? calcularNominaQuincenal(empleado, quincena, params)
    : calcularNomina(empleado, params)
}

// ── Prorrateo por suspensión a mitad de período ────────────────────────────────
// Rango de fechas calendario que cubre un período — el mes completo para
// mensual, o la mitad correspondiente (1-15 / 16-fin) para quincenal.
function rangoPeriodo(
  mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { inicio: Date; fin: Date } {
  const diasEnMes = new Date(anio, mes, 0).getDate()
  if (tipo === 'mensual') return { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, diasEnMes) }
  return quincena === 1
    ? { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, 15) }
    : { inicio: new Date(anio, mes - 1, 16), fin: new Date(anio, mes - 1, diasEnMes) }
}

// Si el empleado está suspendido y su fecha de suspensión cae DENTRO (o
// después) del rango de este período, devuelve cuántos días calendario
// trabajó antes de suspenderse, sobre el total de días del período — para
// prorratear su salario en vez de pagarle el período completo o excluirlo
// por completo. `null` si no aplica (no suspendido, o ya estaba suspendido
// desde ANTES de que este período empezara — ese caso se excluye del todo
// en empleadosDelPeriodo, no se prorratea).
function diasSuspensionEnPeriodo(
  empleado: Empleado, mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number } | null {
  if (!empleado.suspendido || !empleado.fechaSuspension) return null
  const { inicio, fin } = rangoPeriodo(mes, anio, tipo, quincena)
  const fechaSuspension = new Date(empleado.fechaSuspension)
  if (fechaSuspension < inicio) return null
  const finEfectivo = fechaSuspension < fin ? fechaSuspension : fin
  const msPorDia = 24 * 3600 * 1000
  const diasTrabajados     = Math.floor((finEfectivo.getTime() - inicio.getTime()) / msPorDia) + 1
  const diasLaborablesMes  = Math.floor((fin.getTime() - inicio.getTime()) / msPorDia) + 1
  return { diasTrabajados, diasLaborablesMes }
}

// Lista de empleados que participan de un período específico: los normales
// (empleadosEnNomina) más cualquier empleado suspendido cuya fecha de
// suspensión cae dentro de este período — porque sí trabajó una parte y le
// corresponde su pago prorrateado, aunque hoy ya esté suspendido. Un
// empleado suspendido desde ANTES de que el período comenzara no se agrega
// (0 días trabajados, correctamente excluido).
function empleadosDelPeriodo(
  todos: Empleado[], normales: Empleado[], mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): Empleado[] {
  const extra = todos.filter(e =>
    e.activo && e.suspendido && !normales.some(n => n.id === e.id) &&
    diasSuspensionEnPeriodo(e, mes, anio, tipo, quincena) !== null
  )
  return extra.length ? [...normales, ...extra] : normales
}

// Envoltorio de conveniencia: calcula la nómina de un empleado para un
// período específico, aplicando automáticamente el prorrateo por suspensión
// si corresponde — evita tener que acordarse de calcular diasSuspensionEnPeriodo
// en cada call-site.
function calcularParaPeriodo(
  empleado: Empleado, ajustes: AjusteLinea[],
  periodo: { mes: number; anio: number; tipo: TipoPeriodo; quincena?: 1 | 2 },
): ResultadoNomina {
  const quincena = periodo.quincena ?? 1
  const dias = diasSuspensionEnPeriodo(empleado, periodo.mes, periodo.anio, periodo.tipo, quincena)
  return calcularConAjustes(empleado, ajustes, periodo.tipo, quincena, dias)
}

// ── Comprobante PDF ───────────────────────────────────────────────────────────
function descargarComprobantePDF(
  empleado: Empleado,
  nomina: ResultadoNomina,
  label: string,
  empresa: Empresa,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const NR = 27, NG = 41, NB = 128

  // Header bar
  doc.setFillColor(NR, NG, NB)
  doc.rect(0, 0, W, 26, 'F')

  let tX = 14
  if (empresa.logo) {
    try {
      const fmt = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, fmt, 14, 4, 18, 18)
      tX = 36
    } catch {}
  }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.nombre || 'Empresa', tX, 11)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`RNC: ${empresa.rnc || '—'}  ·  ${empresa.ciudad || 'República Dominicana'}`, tX, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('COMPROBANTE DE NÓMINA', W - 14, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(label, W - 14, 17, { align: 'right' })
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-DO')}`, W - 14, 22, { align: 'right' })

  // Employee info
  let y = 36
  doc.setTextColor(NR, NG, NB)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(fullName(empleado), 14, y)
  y += 5.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`${empleado.cargo}  ·  ${empleado.departamento}  ·  Cédula: ${formatCedula(empleado.cedula)}`, 14, y)
  y += 4.5
  doc.text(`Ingreso: ${formatDate(empleado.fechaIngreso)}  ·  Salario base: ${formatRD(empleado.salarioBase, 0)}`, 14, y)
  y += 6
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y, W - 14, y)
  y += 7

  // Two columns
  const colW = (W - 32) / 2
  const c2 = 14 + colW + 4

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 185, 129)
  doc.text('DEVENGOS', 14, y)
  doc.setTextColor(220, 38, 38)
  doc.text('DESCUENTOS', c2, y)
  y += 5

  const devengos = [
    { label: 'Salario Básico', v: nomina.salarioBruto },
    ...(nomina.importeHE35   > 0 ? [{ label: 'H.E. 35% Recargo',  v: nomina.importeHE35 }]   : []),
    ...(nomina.importeHE100  > 0 ? [{ label: 'H.E. 100% Recargo', v: nomina.importeHE100 }]  : []),
    ...(nomina.importeNocturno > 0 ? [{ label: 'Recargo Nocturno (15%)', v: nomina.importeNocturno }] : []),
    ...(nomina.bonificaciones > 0 ? [{ label: 'Bonificaciones',    v: nomina.bonificaciones }] : []),
    ...(nomina.comisiones     > 0 ? [{ label: 'Comisiones',        v: nomina.comisiones }]     : []),
  ]
  const descuentos = [
    { label: 'AFP Empleado (2.87%)', v: nomina.afpEmpleado },
    { label: 'SFS Empleado (3.04%)', v: nomina.sfsEmpleado },
    ...(nomina.isrMensual      > 0 ? [{ label: 'ISR Retención',       v: nomina.isrMensual }]      : []),
    ...(nomina.sfsDependientes > 0 ? [{ label: 'SFS Dep. Adicionales',v: nomina.sfsDependientes }] : []),
    ...(nomina.otrosDescuentos > 0 ? [{ label: 'Otros Descuentos',    v: nomina.otrosDescuentos }] : []),
    ...(nomina.aporteVoluntarioAFPEmpleado > 0 ? [{ label: 'Aporte Voluntario AFP', v: nomina.aporteVoluntarioAFPEmpleado }] : []),
  ]

  const rH = 5.2
  const rows = Math.max(devengos.length, descuentos.length)
  for (let i = 0; i < rows; i++) {
    const ry = y + i * rH
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    if (devengos[i]) {
      doc.text(devengos[i].label, 14, ry)
      doc.setTextColor(40, 40, 40)
      doc.setFont('helvetica', 'bold')
      doc.text(formatRD(devengos[i].v), 14 + colW, ry, { align: 'right' })
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    if (descuentos[i]) {
      doc.text(descuentos[i].label, c2, ry)
      doc.setTextColor(40, 40, 40)
      doc.setFont('helvetica', 'bold')
      doc.text(`(${formatRD(descuentos[i].v)})`, W - 14, ry, { align: 'right' })
    }
  }

  y += rows * rH + 2
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, 14 + colW, y)
  doc.line(c2, y, W - 14, y)
  y += 4

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 185, 129)
  doc.text('Total Bruto', 14, y)
  doc.text(formatRD(nomina.totalBruto), 14 + colW, y, { align: 'right' })
  doc.setTextColor(220, 38, 38)
  doc.text('Total Descuentos', c2, y)
  doc.text(`(${formatRD(nomina.totalDescuentos)})`, W - 14, y, { align: 'right' })

  // Neto box
  y += 9
  doc.setFillColor(NR, NG, NB)
  doc.roundedRect(14, y, W - 28, 15, 2.5, 2.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('SALARIO NETO A PAGAR', 22, y + 5.5)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(formatRD(nomina.salarioNeto, 0), W - 22, y + 10, { align: 'right' })

  // Aportes empresa
  y += 21
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('APORTES EMPRESA (TSS)', 14, y)
  y += 4.5
  const aportes = [
    { label: 'AFP Empleador (7.10%)', v: nomina.afpEmpleador },
    { label: 'SFS Empleador (7.09%)', v: nomina.sfsEmpleador },
    { label: 'SRL Empleador',         v: nomina.srlEmpleador },
    { label: 'Infotep (1.00%)',       v: nomina.infotepEmpleador },
    ...(nomina.aporteVoluntarioAFPEmpresa > 0 ? [{ label: 'Aporte Voluntario AFP', v: nomina.aporteVoluntarioAFPEmpresa }] : []),
    ...(nomina.grossingUpEmpresa           > 0 ? [{ label: 'Grossing-up (ISR/TSS empleado)', v: nomina.grossingUpEmpresa }] : []),
  ]
  aportes.forEach(a => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    doc.text(a.label, 14, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(formatRD(a.v), W - 14, y, { align: 'right' })
    y += 4.5
  })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('Costo Total Empresa', 14, y)
  doc.text(formatRD(nomina.totalCostoEmpleador), W - 14, y, { align: 'right' })

  // Footer
  y += 9
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y, W - 14, y)
  y += 5
  if (nomina.saldoISRAplicado > 0) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(16, 150, 100)
    doc.text(`Crédito ISR a favor aplicado: -${formatRD(nomina.saldoISRAplicado)}`, 14, y)
    y += 4
  }
  if ((empleado.ingresoOtroEmpleadorMensual ?? 0) > 0) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`ISR consolidado con ingreso de otro empleador (${formatRD(empleado.ingresoOtroEmpleadorMensual!, 0)}/mes)`, 14, y)
    y += 4
  }

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(170, 170, 170)
  doc.text(`Regalía/período: ${formatRD(nomina.regaliaPascual, 0)}`, 14, y)
  doc.text(`Vacaciones: ${nomina.vacacionesMensualesDias.toFixed(2)} días`, 90, y)
  doc.text('Ley 16-92  ·  Ley 87-01  ·  Ley 11-92', W - 14, y, { align: 'right' })

  doc.save(`comprobante-${empleado.cedula}-${label.replace(/\s+/g, '-')}.pdf`)
}

// ── Detalle modal ─────────────────────────────────────────────────────────────
function DetalleNomina({
  empleado,
  nomina,
  periodoLabel,
  mostrarUSD,
  onClose,
}: {
  empleado: Empleado
  nomina: ResultadoNomina
  periodoLabel: string
  mostrarUSD: boolean
  onClose: () => void
}) {
  const { empresa } = useEmpresa()
  const fmt = (amount: number, decimals = 2) => formatMoneda(amount, empresa, mostrarUSD, decimals)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-xl bg-zinc-950 dark:bg-[#080a12] px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            {empresa.logo && (
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white flex items-center justify-center">
                <img src={empresa.logo} alt={empresa.nombre} className="h-full w-full object-contain p-1" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Comprobante · {periodoLabel}
              </p>
              <p className="mt-1 text-lg font-bold">{fullName(empleado)}</p>
              <p className="text-sm text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
            </div>
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
                { label: 'Recargo Nocturno (15%)', value: nomina.importeNocturno, hide: nomina.importeNocturno === 0 },
                { label: 'Bonificaciones',       value: nomina.bonificaciones, hide: nomina.bonificaciones === 0 },
                { label: 'Comisiones',           value: nomina.comisiones,     hide: nomina.comisiones === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{fmt(row.value)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Bruto</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(nomina.totalBruto)}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">Descuentos</p>
            <div className="space-y-2">
              {[
                { label: 'AFP Empleado (2.87%)',     value: nomina.afpEmpleado },
                { label: 'SFS Empleado (3.04%)',     value: nomina.sfsEmpleado },
                { label: 'ISR Retención',             value: nomina.isrMensual,        hide: nomina.isrMensual === 0 },
                { label: 'SFS Dep. Adicionales',      value: nomina.sfsDependientes,   hide: nomina.sfsDependientes === 0 },
                { label: 'Otros Descuentos',          value: nomina.otrosDescuentos,   hide: nomina.otrosDescuentos === 0 },
                { label: 'Aporte Voluntario AFP',      value: nomina.aporteVoluntarioAFPEmpleado, hide: nomina.aporteVoluntarioAFPEmpleado === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-rose-700 dark:text-rose-400">({fmt(row.value)})</span>
                </div>
              ))}
              {nomina.isrMensual === 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  ISR: anticipo de quincena (se liquida en 2ª quincena)
                </p>
              )}
              {nomina.saldoISRAplicado > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic">
                  Incluye crédito ISR a favor aplicado: -{fmt(nomina.saldoISRAplicado)}
                </p>
              )}
              {(empleado.ingresoOtroEmpleadorMensual ?? 0) > 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  ISR consolidado con ingreso de otro empleador ({fmt(empleado.ingresoOtroEmpleadorMensual!, 0)}/mes)
                  — esta empresa solo retiene su porción proporcional
                </p>
              )}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Descuentos</span>
                <span className="text-rose-700 dark:text-rose-400 tabular-nums">({fmt(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] p-6 rounded-b-xl">
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide">Salario Neto a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">{fmt(nomina.salarioNeto, 0)}</p>
            {nomina.grossingUpEmpresa > 0 && (
              <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                Incluye reembolso de grossing-up: +{fmt(nomina.grossingUpEmpresa)}
              </p>
            )}
          </div>
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4 space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide mb-2">Aportes Empresa (TSS)</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">AFP Empleador (7.10%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SFS Empleador (7.09%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SRL Empleador</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.srlEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">Infotep (1.00%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.infotepEmpleador)}</span>
            </div>
            {nomina.aporteVoluntarioAFPEmpresa > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Aporte Voluntario AFP (empresa)</span>
                <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.aporteVoluntarioAFPEmpresa)}</span>
              </div>
            )}
            {nomina.grossingUpEmpresa > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Grossing-up (ISR/TSS empleado)</span>
                <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.grossingUpEmpresa)}</span>
              </div>
            )}
            <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-1.5 flex justify-between text-xs font-bold">
              <span className="dark:text-zinc-200">Costo Total Empresa</span>
              <span className="text-amber-700 dark:text-amber-400 tabular-nums">{fmt(nomina.totalCostoEmpleador)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Regalía/período: <strong className="text-zinc-800 dark:text-zinc-200">{fmt(nomina.regaliaPascual, 0)}</strong></span>
            <span>Vacaciones: <strong className="text-zinc-800 dark:text-zinc-200">{nomina.vacacionesMensualesDias.toFixed(2)} días</strong></span>
          </div>
          <button
            onClick={() => descargarComprobantePDF(empleado, nomina, periodoLabel, empresa)}
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-4 py-2 text-xs font-semibold text-white transition-colors shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NominaPage() {
  const { empleados, empleadosEnNomina } = useEmpleados()
  const { periodos, generar, cerrar, eliminar, actualizarAjustes, actualizarTotales, marcarProcesados, reabrir, marcarPagada } = usePeriodos()
  const { empresa } = useEmpresa()
  const { getPrestamosActivos, registrarPago, registrarOmisionCuota } = usePrestamos()
  const { liquidaciones } = useLiquidaciones()
  const { saldos: saldosISR, getSaldosActivos, getMontoAplicadoEnPeriodo, aplicar: aplicarSaldoISR } = useSaldoISR()
  const { getFeriados } = useFeriados()
  const { user } = useAuth()

  // Aplica el saldo ISR a favor sobre un resultado ya calculado. Si el
  // empleado ya fue procesado en este período, usa el monto histórico
  // realmente aplicado (fijo, no cambia aunque el saldoPendiente actual sí);
  // si aún no se procesa, muestra una vista previa en vivo contra el saldo
  // disponible ahora mismo (se "congela" recién al procesar).
  function conSaldoISR(empleado: Empleado, base: ResultadoNomina, periodo: PeriodoNomina): ResultadoNomina {
    const yaProcesado = periodo.empleadosProcesados?.includes(empleado.id) ?? false
    const monto = yaProcesado
      ? getMontoAplicadoEnPeriodo(empleado.id, periodo.id)
      : (getSaldosActivos(empleado.id)[0]?.saldoPendiente ?? 0)
    return aplicarSaldoISRFavor(base, monto, empleado.grossingUpPct).resultado
  }

  // Fuente única de verdad para "cuánto se le pagó/se le va a pagar a este
  // empleado en este período": si ya existe un snapshot congelado (empleado
  // ya procesado), lo usa tal cual — es el registro fidedigno de lo
  // realmente calculado en ese momento, inmune a cambios posteriores del
  // Empleado (aumento salarial, etc.). Si aún no se procesa, calcula una
  // vista previa en vivo (con el prorrateo por suspensión si aplica).
  function resultadoDePeriodo(empleado: Empleado, ajustes: AjusteLinea[], periodo: PeriodoNomina): ResultadoNomina {
    const snapshot = periodo.resultadosPorEmpleado?.[empleado.id]
    if (snapshot) return snapshot
    return conSaldoISR(empleado, calcularParaPeriodo(empleado, ajustes, periodo), periodo)
  }

  // View state
  const [periodoAbierto, setPeriodoAbierto] = useState<string | null>(null)

  // Nómina en USD — toggle de presentación en pantalla, solo disponible si la
  // empresa configuró una tasa de cambio manual. No afecta ningún cálculo,
  // el PDF de comprobante, el CSV exportado ni la plantilla de correo.
  const [mostrarUSD, setMostrarUSD] = useState(false)
  const fmt = (amount: number, decimals = 2) => formatMoneda(amount, empresa, mostrarUSD, decimals)

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

  // Filtros de selección múltiple — solo cubre datos que realmente existen hoy
  // en el modelo (departamento, fecha de ingreso); no hay campo de "fecha de
  // último cambio salarial" en el sistema, así que no se ofrece ese filtro.
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const [filtroIngresoDesde, setFiltroIngresoDesde] = useState('')
  const [filtroIngresoHasta, setFiltroIngresoHasta] = useState('')

  // Auditoría pre-cierre: ids en espera de confirmación antes de completar
  // el período (pasar de en_proceso a procesada)
  const [auditoriaIds, setAuditoriaIds] = useState<string[] | null>(null)

  // Envío de comprobantes de pago por correo — se abre justo después de
  // marcar un período como pagado (o manualmente después, vía "Comprobantes")
  const [envioPeriodoId, setEnvioPeriodoId] = useState<string | null>(null)
  const [plantillaComprobante, setPlantillaComprobante] = useState<PlantillaComprobante>(plantillaComprobanteDeEmpresa(empresa))
  const [enviadosComprobante, setEnviadosComprobante] = useState<Set<string>>(new Set())

  // Importador de horas trabajadas (Excel/CSV) — solo tiene sentido con el
  // período en_proceso, ya que anexa AjusteLinea nuevas a los empleados.
  const [importarHorasAbierto, setImportarHorasAbierto] = useState(false)

  // Modal + toast
  const [detalleModal, setDetalleModal] = useState<{ emp: Empleado; nom: ResultadoNomina } | null>(null)
  const [toast, setToast]               = useState<string | null>(null)

  useEffect(() => {
    if (empresa.modalidadNomina) setNuevoTipo(empresa.modalidadNomina)
  }, [empresa.modalidadNomina])

  const periodoActual = periodos.find(p => p.id === periodoAbierto) ?? null
  const periodoActualLabel = periodoActual ? labelPeriodo(periodoActual) : ''

  // Empleados que participan del período abierto — incluye, además de los
  // normales, a cualquier suspendido a mitad de ESTE período (ver
  // empleadosDelPeriodo). Sustituye a empleadosEnNomina en todo lo que sea
  // específico del período actualmente abierto.
  const empleadosPeriodo = periodoActual
    ? empleadosDelPeriodo(empleados, empleadosEnNomina, periodoActual.mes, periodoActual.anio, periodoActual.tipo, periodoActual.quincena ?? 1)
    : empleadosEnNomina

  // If the open period was deleted, reset to list view without calling setState during render
  useEffect(() => {
    if (periodoAbierto && !periodos.find(p => p.id === periodoAbierto)) {
      setPeriodoAbierto(null)
    }
  }, [periodoAbierto, periodos])

  // Recalcula y persiste PeriodoNomina.totales cada vez que cambian sus
  // ajustes, la lista de procesados, o cualquier crédito de Saldo ISR.
  // Sin esto, totales queda congelado con el valor calculado al CREAR el
  // período (ver calcularTotalesRapido más abajo, usado solo en
  // handleCrearPeriodo) y nunca refleja ajustes agregados después ni
  // créditos ISR aplicados — un desajuste silencioso que se propaga a las
  // cards de la lista de períodos, el Dashboard y toda Reportería, que leen
  // periodo.totales directamente en vez de recalcular en vivo.
  //
  // Solo mientras en_proceso: un período procesada/cerrada es un registro
  // histórico — recalcular con datos EN VIVO de empleadosEnNomina lo dejaría
  // vulnerable a que un cambio salarial posterior (aumento, etc.) infle
  // retroactivamente el bruto/neto de un mes ya cerrado y pagado, aunque ese
  // monto nunca se pagó realmente. Al reabrir (desposteo) el estado vuelve a
  // en_proceso y el recálculo en vivo se reanuda correctamente.
  useEffect(() => {
    if (!periodoActual || periodoActual.estado !== 'en_proceso') return
    const ajustesPorEmp = periodoActual.ajustesPorEmpleado ?? {}
    const rs = empleadosPeriodo.map(e =>
      conSaldoISR(e, calcularParaPeriodo(e, ajustesPorEmp[e.id] ?? [], periodoActual), periodoActual)
    )
    const round = (n: number) => Math.round(n * 100) / 100
    const nuevos = {
      bruto:      round(rs.reduce((s, r) => s + r.totalBruto, 0)),
      descuentos: round(rs.reduce((s, r) => s + r.totalDescuentos, 0)),
      neto:       round(rs.reduce((s, r) => s + r.salarioNeto, 0)),
      aportes:    round(rs.reduce((s, r) => s + r.totalAportesEmpleador, 0)),
      isr:        round(rs.reduce((s, r) => s + r.isrMensual, 0)),
      costoTotal: round(rs.reduce((s, r) => s + r.totalCostoEmpleador, 0)),
    }
    const actuales = periodoActual.totales
    const cambiaron = (Object.keys(nuevos) as (keyof typeof nuevos)[]).some(k => nuevos[k] !== actuales[k])
    if (cambiaron) actualizarTotales(periodoActual.id, nuevos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoActual?.id, periodoActual?.ajustesPorEmpleado, periodoActual?.empleadosProcesados, periodoActual?.estado, empleadosPeriodo, saldosISR])

  function calcularTotalesRapido(ajustesPorEmp: Record<string, AjusteLinea[]> = {}) {
    const empleadosNuevoPeriodo = empleadosDelPeriodo(empleados, empleadosEnNomina, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena)
    const rs = empleadosNuevoPeriodo.map(e =>
      calcularParaPeriodo(e, ajustesPorEmp[e.id] ?? [], { mes: nuevoMes, anio: nuevoAnio, tipo: nuevoTipo, quincena: nuevaQuincena })
    )
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

    const empleadosNuevoPeriodo = empleadosDelPeriodo(empleados, empleadosEnNomina, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena)

    // Pre-load active loan installments as deductions per employee
    const ajustesIniciales: Record<string, AjusteLinea[]> = {}
    for (const emp of empleadosNuevoPeriodo) {
      const loans = getPrestamosActivos(emp.id)
      if (loans.length > 0) {
        ajustesIniciales[emp.id] = loans.map(p => {
          const etiqueta = p.tipo === 'avance' ? 'Avance de salario' : 'Préstamo'
          return {
            id: `loan-${p.id}`,
            tipo: 'deduccion' as const,
            concepto: 'prestamo' as const,
            descripcion: p.notas ? `${etiqueta} — ${p.notas}` : etiqueta,
            valor: p.cuotaBase,
            prestamoId: p.id,
          }
        })
      }
    }
    for (const emp of empleadosNuevoPeriodo) {
      const deps = emp.dependientes ?? []
      if (deps.length > 0) {
        const cuotaMensualDep = cuotaDependienteSFS()
        const depAjustes = deps.map(d => ({
          id: `dep-${d.id}-${Date.now().toString(36)}`,
          tipo: 'deduccion' as const,
          concepto: 'dependiente_sfs' as const,
          descripcion: `SFS Dep. — ${d.nombre} ${d.apellido}`,
          valor: prorratearMontoFijo(cuotaMensualDep, nuevoTipo),
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
      totalEmpleados:     empleadosNuevoPeriodo.length,
      totales:            calcularTotalesRapido(ajustesIniciales),
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
    const rows = empleadosPeriodo.map(e => {
      const r = resultadoDePeriodo(e, ajustesPorEmp[e.id] ?? [], periodoActual)
      return [
        fullName(e), e.cargo, e.departamento,
        r.totalBruto.toFixed(2), r.afpEmpleado.toFixed(2), r.sfsEmpleado.toFixed(2),
        r.isrMensual.toFixed(2), r.sfsDependientes.toFixed(2), r.totalDescuentos.toFixed(2),
        r.salarioNeto.toFixed(2), r.afpEmpleador.toFixed(2), r.sfsEmpleador.toFixed(2),
        r.srlEmpleador.toFixed(2), r.infotepEmpleador.toFixed(2), r.totalCostoEmpleador.toFixed(2),
      ]
    })
    const slug = periodoActualLabel.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    exportarCSV(
      `nomina-${slug}.csv`,
      ['Empleado','Cargo','Departamento','S. Bruto','AFP Emp','SFS Emp','ISR','SFS Dep.','Total Desc.','S. Neto','AFP Empr','SFS Empr','SRL','Infotep','Costo Total'],
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

  // Congela el resultado final de un empleado al momento de procesarlo:
  // consume el crédito ISR más antiguo disponible (side effect sobre el
  // contexto de saldos) y devuelve el ResultadoNomina resultante — este
  // resultado es exactamente lo que se guarda como snapshot histórico
  // inmutable en PeriodoNomina.resultadosPorEmpleado (ver marcarProcesados),
  // así que a partir de aquí el número queda fijo para siempre, sin importar
  // qué cambie después en el Empleado.
  function congelarYCalcular(empId: string, ajustes: AjusteLinea[]): ResultadoNomina | null {
    if (!periodoActual) return null
    const emp = empleadosPeriodo.find(e => e.id === empId)
    if (!emp) return null
    const base = calcularParaPeriodo(emp, ajustes, periodoActual)
    const saldo = getSaldosActivos(emp.id)[0]
    const { resultado, montoAplicado } = aplicarSaldoISRFavor(base, saldo?.saldoPendiente ?? 0, emp.grossingUpPct)
    if (saldo && montoAplicado > 0) {
      aplicarSaldoISR(saldo.id, periodoActual.id, periodoActualLabel, montoAplicado)
    }
    return resultado
  }

  // Reglas de manejo de insuficiencia de fondos: si el neto de un empleado no
  // alcanza para cubrir la(s) cuota(s) de préstamo/avance de este período, se
  // omiten esas cuotas en vez de dejar un neto negativo — es el único
  // descuento que se puede diferir sin implicar un problema de cumplimiento
  // legal (a diferencia de AFP/SFS/ISR, que son obligatorios). Si el neto
  // sigue negativo incluso sin las cuotas de préstamo, no se toca nada más
  // aquí — ese caso ya lo señala la auditoría pre-cierre existente. Devuelve
  // los ajustes FINALES a usar (para que el llamador no dependa del estado
  // de contexto, que todavía no se actualizó dentro de este mismo ciclo de
  // evento) y el nombre del empleado si se omitió alguna cuota.
  function manejarInsuficienciaFondos(empId: string): { ajustesFinales: AjusteLinea[]; omitido: string | null } {
    const ajustes = getAjustes(empId)
    if (!periodoActual) return { ajustesFinales: ajustes, omitido: null }
    const emp = empleadosPeriodo.find(e => e.id === empId)
    if (!emp) return { ajustesFinales: ajustes, omitido: null }
    const resultado = conSaldoISR(emp, calcularParaPeriodo(emp, ajustes, periodoActual), periodoActual)
    if (resultado.salarioNeto >= 0) return { ajustesFinales: ajustes, omitido: null }

    const ajustesPrestamo = ajustes.filter(a => a.concepto === 'prestamo' && a.prestamoId)
    if (ajustesPrestamo.length === 0) return { ajustesFinales: ajustes, omitido: null }

    const ajustesSinPrestamo = ajustes.filter(a => !(a.concepto === 'prestamo' && a.prestamoId))
    const resultadoSinPrestamo = conSaldoISR(emp, calcularParaPeriodo(emp, ajustesSinPrestamo, periodoActual), periodoActual)
    if (resultadoSinPrestamo.salarioNeto < 0) return { ajustesFinales: ajustes, omitido: null } // no es solo el préstamo — se deja para la auditoría

    actualizarAjustes(periodoActual.id, empId, ajustesSinPrestamo)
    ajustesPrestamo.forEach(a => { if (a.prestamoId) registrarOmisionCuota(a.prestamoId) })
    return { ajustesFinales: ajustesSinPrestamo, omitido: fullName(emp) }
  }

  function handleProcesarEmpleado(empId: string) {
    if (!periodoActual) return
    const procesadosActuales = new Set(periodoActual.empleadosProcesados ?? [])
    const pendientes = empleadosPeriodo.filter(e => !procesadosActuales.has(e.id))
    if (pendientes.length > 0 && pendientes.every(e => e.id === empId)) {
      setAuditoriaIds([empId])
      return
    }
    const { ajustesFinales, omitido } = manejarInsuficienciaFondos(empId)
    const resultado = congelarYCalcular(empId, ajustesFinales)
    if (resultado) marcarProcesados(periodoActual.id, { [empId]: resultado })
    setSelectedEmps(prev => { const s = new Set(prev); s.delete(empId); return s })
    setToast(omitido ? `Cuota de préstamo omitida para ${omitido} — el neto no alcanzaba` : 'Empleado procesado')
  }

  function confirmarAuditoria() {
    if (!periodoActual || !auditoriaIds) return
    const resultados: Record<string, ResultadoNomina> = {}
    const omitidos: string[] = []
    for (const id of auditoriaIds) {
      const { ajustesFinales, omitido } = manejarInsuficienciaFondos(id)
      if (omitido) omitidos.push(omitido)
      const r = congelarYCalcular(id, ajustesFinales)
      if (r) resultados[id] = r
    }
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    setToast(omitidos.length > 0
      ? `Todos los empleados procesados — cuota de préstamo omitida para: ${omitidos.join(', ')}`
      : 'Todos los empleados procesados')
    setAuditoriaIds(null)
  }

  function handleProcesarSeleccionados() {
    if (!periodoActual) return
    const ids = selectedEmps.size > 0
      ? [...selectedEmps]
      : empleadosPeriodo.map(e => e.id)
    // Si esta acción completaría el período (pasaría de en_proceso a
    // procesada), se intercepta con la auditoría pre-cierre en vez de
    // procesar directamente.
    const procesadosActuales = new Set(periodoActual.empleadosProcesados ?? [])
    const pendientes = empleadosPeriodo.filter(e => !procesadosActuales.has(e.id))
    if (pendientes.length > 0 && pendientes.every(e => ids.includes(e.id))) {
      setAuditoriaIds(ids)
      return
    }
    const resultados: Record<string, ResultadoNomina> = {}
    const omitidos: string[] = []
    for (const id of ids) {
      const { ajustesFinales, omitido } = manejarInsuficienciaFondos(id)
      if (omitido) omitidos.push(omitido)
      const r = congelarYCalcular(id, ajustesFinales)
      if (r) resultados[id] = r
    }
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    if (omitidos.length > 0) {
      setToast(`Cuota de préstamo omitida para: ${omitidos.join(', ')}`)
    } else {
      setToast(selectedEmps.size > 0 ? `${ids.length} empleado(s) procesado(s)` : 'Todos los empleados procesados')
    }
  }

  function toggleSeleccionEmp(empId: string) {
    setSelectedEmps(prev => {
      const s = new Set(prev)
      if (s.has(empId)) s.delete(empId); else s.add(empId)
      return s
    })
  }

  function toggleSeleccionTodos() {
    const noProcessados = empleadosPeriodo
      .filter(e => !(periodoActual?.empleadosProcesados ?? []).includes(e.id))
      .map(e => e.id)
    if (selectedEmps.size === noProcessados.length && noProcessados.length > 0) {
      setSelectedEmps(new Set())
    } else {
      setSelectedEmps(new Set(noProcessados))
    }
  }

  function seleccionarPorCriterio() {
    const noProcessados = empleadosPeriodo.filter(e => !(periodoActual?.empleadosProcesados ?? []).includes(e.id))
    const coincidencias = noProcessados.filter(e => {
      if (filtroDepto !== 'todos' && e.departamento !== filtroDepto) return false
      if (filtroIngresoDesde && e.fechaIngreso < filtroIngresoDesde) return false
      if (filtroIngresoHasta && e.fechaIngreso > filtroIngresoHasta) return false
      return true
    })
    setSelectedEmps(new Set(coincidencias.map(e => e.id)))
  }

  const anios = [nuevoAnio - 1, nuevoAnio, nuevoAnio + 1]
  const conceptosIngreso: ConceptoAjuste[]   = ['horas_extras_35', 'horas_extras_100', 'recargo_nocturno', 'comision', 'bono', 'otro_ingreso']
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
                  disabled={empleadosEnNomina.length === 0}
                  className="self-end flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Crear Período
                </button>
              </div>

              {empleadosEnNomina.length === 0 && (
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
                    <div className="flex items-center gap-1.5">
                      {(p.bitacoraDesposteos?.length ?? 0) > 0 && (
                        <span
                          title={p.bitacoraDesposteos!.map(b =>
                            `Reabierto el ${formatDate(b.fecha.slice(0, 10))} por ${b.usuarioEmail} (estaba ${b.estadoAnterior})`
                          ).join('\n')}
                        >
                          <History className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        </span>
                      )}
                      {p.estado === 'cerrada' ? (
                        <Badge variant="neutral"><Lock className="mr-1 h-3 w-3" />Cerrada</Badge>
                      ) : p.estado === 'procesada' ? (
                        <Badge variant="success">Procesada</Badge>
                      ) : (
                        <Badge variant="warning">En Proceso</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 px-5 py-4 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Neto Total</span>
                      <span className="text-lg font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">
                        {fmt(p.totales.neto, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Costo Empresa</span>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                        {fmt(p.totales.costoTotal, 0)}
                      </span>
                    </div>
                    {p.estado === 'cerrada' && (
                      p.pagada ? (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Wallet className="h-3.5 w-3.5" />
                            Pagada el {formatDate(p.fechaPago!)}
                          </div>
                          <button
                            onClick={() => {
                              setEnvioPeriodoId(p.id)
                              setPlantillaComprobante(plantillaComprobanteDeEmpresa(empresa))
                              setEnviadosComprobante(new Set())
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" /> Comprobantes
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const hoy = new Date().toISOString().slice(0, 10)
                            if (!confirm(`¿Confirmar que "${labelPeriodo(p)}" ya fue pagado (transferencia ACH enviada) el ${formatDate(hoy)}?`)) return
                            marcarPagada(p.id, hoy)
                            setEnvioPeriodoId(p.id)
                            setPlantillaComprobante(plantillaComprobanteDeEmpresa(empresa))
                            setEnviadosComprobante(new Set())
                          }}
                          className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Marcar como pagada
                        </button>
                      )
                    )}
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
                    {p.estado !== 'en_proceso' && esPeriodoMasReciente(p, periodos) && (
                      <button
                        onClick={() => {
                          if (!confirm(
                            `¿Reabrir "${labelPeriodo(p)}"? Los empleados procesados volverán a marcarse como pendientes y deberás reprocesarlos. Esta acción queda registrada con tu usuario y fecha.`
                          )) return
                          const ok = reabrir(p.id, user?.email ?? 'desconocido')
                          setToast(ok ? 'Período reabierto — vuelve a En Proceso' : 'No se pudo reabrir el período')
                        }}
                        title="Reabrir período (desposteo)"
                        className="rounded-lg border border-amber-200 dark:border-amber-800/50 p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <Unlock className="h-4 w-4" />
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

        {envioPeriodoId && (() => {
          const periodoEnvio = periodos.find(p => p.id === envioPeriodoId)
          if (!periodoEnvio) return null
          const periodoEnvioLabel = labelPeriodo(periodoEnvio)
          const concepto = periodoEnvio.tipo === 'quincenal'
            ? `Nómina Quincenal (${periodoEnvio.quincena}ª quincena)`
            : 'Nómina Mensual'
          const ajustesEnvio = periodoEnvio.ajustesPorEmpleado ?? {}
          const empleadosEnvio = empleadosDelPeriodo(empleados, empleadosEnNomina, periodoEnvio.mes, periodoEnvio.anio, periodoEnvio.tipo, periodoEnvio.quincena ?? 1)

          const filas = empleadosEnvio.map(e => ({
            empleado: e,
            resultado: resultadoDePeriodo(e, ajustesEnvio[e.id] ?? [], periodoEnvio),
          }))

          const fechaPagoTexto = periodoEnvio.fechaPago ? formatDate(periodoEnvio.fechaPago) : ''

          // Intenta abrir la ventana de correo para un empleado; devuelve si se logró.
          // No asume éxito: el navegador puede bloquear la ventana (ver enviarComprobante).
          function intentarEnviar(emp: Empleado, resultado: ResultadoNomina): boolean {
            if (!emp.email) return false
            const { asunto, cuerpo } = resolverPlantilla(plantillaComprobante, {
              '{nombre}':    fullName(emp),
              '{periodo}':   periodoEnvioLabel,
              '{concepto}':  concepto,
              '{neto}':      formatRD(resultado.salarioNeto),
              '{fechaPago}': fechaPagoTexto,
              '{empresa}':   empresa.nombre || 'la empresa',
            })
            const abierto = enviarComprobante({ destinatarioEmail: emp.email, destinatarioNombre: fullName(emp), asunto, cuerpo })
            if (abierto) setEnviadosComprobante(prev => new Set(prev).add(emp.id))
            return abierto
          }

          function handleEnviar(emp: Empleado, resultado: ResultadoNomina) {
            if (!intentarEnviar(emp, resultado)) {
              setToast(`El navegador bloqueó la ventana de correo para ${fullName(emp)} — permite ventanas emergentes o envíalo individualmente`)
            }
          }

          function handleEnviarTodos() {
            const pendientes = filas.filter(f => f.empleado.email && !enviadosComprobante.has(f.empleado.id))
            const bloqueados = pendientes.filter(({ empleado: emp, resultado }) => !intentarEnviar(emp, resultado)).length
            if (bloqueados > 0) {
              setToast(`Tu navegador bloqueó ${bloqueados} de ${pendientes.length} ventanas — envíalas individualmente o permite ventanas emergentes para este sitio`)
            }
          }

          const pendientesEnvio = filas.filter(f => f.empleado.email && !enviadosComprobante.has(f.empleado.id)).length
          const sinCorreo = filas.filter(f => !f.empleado.email).length

          return (
            <>
              <div
                className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
                onClick={() => setEnvioPeriodoId(null)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Enviar Comprobantes de Pago — {periodoEnvioLabel}
                      </h2>
                    </div>
                    <button onClick={() => setEnvioPeriodoId(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-[11px] text-amber-800 dark:text-amber-300">
                      Cielo Cloud no tiene servidor de correo propio todavía: cada "Enviar" abre tu propio
                      cliente de correo con el mensaje listo. Descarga el PDF de cada empleado y adjúntalo
                      antes de dar clic en enviar desde tu correo.
                    </div>

                    {/* Plantilla editable */}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Asunto</label>
                        <input
                          className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none"
                          value={plantillaComprobante.asunto}
                          onChange={e => setPlantillaComprobante(prev => ({ ...prev, asunto: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Cuerpo del correo</label>
                        <textarea
                          className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-xs font-mono focus:border-[#1B2980] focus:outline-none"
                          rows={7}
                          value={plantillaComprobante.cuerpo}
                          onChange={e => setPlantillaComprobante(prev => ({ ...prev, cuerpo: e.target.value }))}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        Variables disponibles (se reemplazan por cada empleado):{' '}
                        {PLACEHOLDERS_COMPROBANTE.map(p => p.token).join(', ')}
                      </p>
                    </div>

                    {/* Lista de empleados */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {pendientesEnvio > 0 ? `${pendientesEnvio} pendiente${pendientesEnvio === 1 ? '' : 's'}` : 'Todos enviados'}
                        {sinCorreo > 0 && ` · ${sinCorreo} sin correo registrado`}
                      </p>
                      <button
                        onClick={handleEnviarTodos}
                        disabled={pendientesEnvio === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar a Todos ({pendientesEnvio})
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                            <th className="px-3 py-2 font-medium">Empleado</th>
                            <th className="px-3 py-2 font-medium">Correo</th>
                            <th className="px-3 py-2 font-medium text-right">Neto</th>
                            <th className="px-3 py-2 font-medium text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-[#1d2035]">
                          {filas.map(({ empleado: emp, resultado }) => (
                            <tr key={emp.id}>
                              <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{fullName(emp)}</td>
                              <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                                {emp.email || <span className="text-rose-500 dark:text-rose-400">Sin correo registrado</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                                {formatRD(resultado.salarioNeto)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => descargarComprobantePDF(emp, resultado, periodoEnvioLabel, empresa)}
                                    title="Descargar PDF"
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] transition-colors"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleEnviar(emp, resultado)}
                                    disabled={!emp.email}
                                    title={emp.email ? 'Enviar por correo' : 'Empleado sin correo registrado'}
                                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                                      enviadosComprobante.has(emp.id)
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-[#1B2980] hover:bg-[#151f66] text-white disabled:opacity-40 disabled:cursor-not-allowed'
                                    }`}
                                  >
                                    {enviadosComprobante.has(emp.id) ? (
                                      <><CheckCircle2 className="h-3.5 w-3.5" /> Abierto</>
                                    ) : (
                                      <><Send className="h-3.5 w-3.5" /> Enviar</>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                    <button
                      onClick={() => setEnvioPeriodoId(null)}
                      className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-4 py-2 text-sm font-semibold text-white transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>
    )
  }

  // ── VISTA: DETALLE ────────────────────────────────────────────────────────────
  if (!periodoActual) {
    return null
  }

  const ajustesPorEmp  = periodoActual.ajustesPorEmpleado ?? {}
  const quincenaActual: 1 | 2 = periodoActual.quincena ?? 1
  const esEnProceso    = periodoActual.estado === 'en_proceso'
  const esProcesada    = periodoActual.estado === 'procesada'
  const procesados     = new Set(periodoActual.empleadosProcesados ?? [])
  const noProcessados  = empleadosPeriodo.filter(e => !procesados.has(e.id))
  const todosSeleccionados = noProcessados.length > 0 && noProcessados.every(e => selectedEmps.has(e.id))

  const nominas = empleadosPeriodo.map(e => ({
    empleado: e,
    resultado: resultadoDePeriodo(e, ajustesPorEmp[e.id] ?? [], periodoActual),
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
            {esEnProceso && (
              <button
                onClick={() => setImportarHorasAbierto(true)}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                title="Cargar horas extra/recargo nocturno masivamente desde un archivo Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Importar Horas
              </button>
            )}
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            {empresa.tasaCambioUSD && (
              <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]" title="Solo cambia lo que se muestra en pantalla — el PDF, el CSV y el correo siguen en RD$">
                {(['RD$', 'USD'] as const).map(moneda => (
                  <button
                    key={moneda}
                    onClick={() => setMostrarUSD(moneda === 'USD')}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      (moneda === 'USD') === mostrarUSD
                        ? 'bg-[#1B2980] text-white'
                        : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                    }`}
                  >
                    {moneda}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Bruto"
            value={fmt(totales.bruto, 0)}
            sub="Suma devengados"
            icon={Wallet}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Total Neto"
            value={fmt(totales.neto, 0)}
            sub="A transferir empleados"
            icon={BarChart3}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Aportes TSS Empresa"
            value={fmt(totales.aportes, 0)}
            sub="AFP + SFS + SRL + Infotep"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="ISR Retenido"
            value={fmt(totales.isr, 0)}
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
            <div className="flex items-center gap-3">
              {esEnProceso && (
                <button
                  onClick={() => setMostrarFiltros(v => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    mostrarFiltros
                      ? 'border-[#1B2980]/30 bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50'
                      : 'border-zinc-200 dark:border-[#252840] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Info className="h-3.5 w-3.5" />
                {esEnProceso
                  ? `${procesados.size}/${empleadosPeriodo.length} empleados procesados`
                  : esProcesada
                    ? 'Período procesado — solo lectura'
                    : 'Período cerrado — solo lectura'}
              </div>
            </div>
          </div>
          {esEnProceso && mostrarFiltros && (
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Departamento</label>
                <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none">
                  <option value="todos">Todos</option>
                  {Array.from(new Set(empleadosPeriodo.map(e => e.departamento))).sort().map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ingreso Desde</label>
                <input type="date" value={filtroIngresoDesde} onChange={e => setFiltroIngresoDesde(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ingreso Hasta</label>
                <input type="date" value={filtroIngresoHasta} onChange={e => setFiltroIngresoHasta(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
              </div>
              <button
                onClick={seleccionarPorCriterio}
                className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Seleccionar Coincidencias
              </button>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 basis-full">
                Reemplaza la selección actual por los empleados pendientes que coincidan con estos criterios.
                No existe un campo de "fecha de último cambio salarial" en el sistema hoy, por eso no se ofrece ese filtro.
              </p>
            </div>
          )}
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
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dep. SFS</th>
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
                  const colSpanTotal = esEnProceso ? 10 : 9

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
                                {isHorasConcepto(a.concepto) ? `${a.valor}h` : fmt(a.valor, 0)}
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
                          {fmt(resultado.totalBruto, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {fmt(resultado.afpEmpleado + resultado.sfsEmpleado, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.isrMensual === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : fmt(resultado.isrMensual, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.sfsDependientes === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : fmt(resultado.sfsDependientes, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                          {fmt(resultado.salarioNeto, 0)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {fmt(resultado.totalCostoEmpleador, 0)}
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
                              {newTipo === 'deduccion' && newConcepto === 'otro_descuento' && (
                                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                  Si es un descuento por ausencia/inasistencia, no lo cargues aquí —
                                  reduce los "Días Trabajados" del empleado al crear el período. Un
                                  descuento por ausencia registrado como "Otro Desc." se resta del
                                  neto después de calcular el ISR, en vez de reducir la base gravable
                                  antes, lo cual sobreestima el ISR retenido.
                                </p>
                              )}
                              {newTipo === 'ingreso' && (newConcepto === 'horas_extras_35' || newConcepto === 'horas_extras_100') && empleado.regimenIntermitente && (
                                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                  Este empleado está en régimen de trabajo intermitente (Resolución 04-93) —
                                  su jornada ordinaria llega hasta 10h/día y 60h/semana. Solo cuenta como
                                  hora extra lo que exceda esos umbrales, no los de la jornada ordinaria
                                  (8h/día, 44h/semana).
                                </p>
                              )}
                              {newTipo === 'ingreso' && (newConcepto === 'horas_extras_35' || newConcepto === 'horas_extras_100') && (() => {
                                const feriadosMes = getFeriados(periodoActual!.anio).filter(f => new Date(f.fecha + 'T00:00:00').getMonth() + 1 === periodoActual!.mes)
                                if (feriadosMes.length === 0) return null
                                return (
                                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                    Feriados de {MESES[periodoActual!.mes - 1]} (calendario de Configuración → Nómina):{' '}
                                    {feriadosMes.map(f => `${formatDate(f.fecha)} (${f.nombre})`).join(', ')}.
                                    {newConcepto === 'horas_extras_35'
                                      ? ' Si las horas que vas a cargar corresponden a uno de estos días, regístralas como H.E. 100% en vez de H.E. 35% (Art. 203).'
                                      : ' Confirma que las horas correspondan efectivamente a uno de estos días feriados.'}
                                  </p>
                                )
                              })()}
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
                    TOTALES — {empleadosPeriodo.length} empleados
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">{fmt(totales.bruto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {fmt(nominas.reduce((s, n) => s + n.resultado.afpEmpleado + n.resultado.sfsEmpleado, 0), 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{fmt(totales.isr, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">{fmt(totales.neto, 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{fmt(totales.costoTotal, 0)}</td>
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
              <p>AFP 2.87% emp / 7.10% empr (tope RD$464,460) · SFS 3.04% emp / 7.09% empr (tope RD$232,230) · SRL 1.10%–1.30% empr según categoría (tope RD$92,892) · Infotep 1.00% empr</p>
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
            mostrarUSD={mostrarUSD}
            onClose={() => setDetalleModal(null)}
          />
        </>
      )}

      {importarHorasAbierto && esEnProceso && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <ImportadorHorasExcel
            empleados={empleados}
            empleadosElegibles={empleadosPeriodo}
            ajustesPorEmpleado={ajustesPorEmp}
            onConfirmar={(nuevosAjustesPorEmpleado, totalAgregados) => {
              Object.entries(nuevosAjustesPorEmpleado).forEach(([empId, ajustes]) => {
                actualizarAjustes(periodoActual.id, empId, ajustes)
              })
              const totalEmpleados = Object.keys(nuevosAjustesPorEmpleado).length
              setToast(`Se agregaron ${totalAgregados} ajuste(s) de horas a ${totalEmpleados} empleado(s)`)
            }}
            onClose={() => setImportarHorasAbierto(false)}
          />
        </>
      )}

      {auditoriaIds && (() => {
        const anterior = periodoAnterior(periodoActual, periodos)
        const UMBRAL_VARIACION = empresa.umbralVariacionBrutoPct ?? UMBRAL_VARIACION_BRUTO_DEFAULT
        const UMBRAL_DESCUENTO = empresa.umbralEndeudamientoPct ?? UMBRAL_ENDEUDAMIENTO_DEFAULT

        const filas = empleadosPeriodo
          .filter(e => auditoriaIds.includes(e.id))
          .map(e => {
            const actual = nominas.find(n => n.empleado.id === e.id)!.resultado
            let variacionBrutoPct: number | null = null
            if (anterior) {
              const ajustesAnt = anterior.ajustesPorEmpleado?.[e.id]
              if (ajustesAnt !== undefined) {
                const prev = resultadoDePeriodo(e, ajustesAnt, anterior)
                if (prev.totalBruto > 0) {
                  variacionBrutoPct = ((actual.totalBruto - prev.totalBruto) / prev.totalBruto) * 100
                }
              }
            }
            const fi = new Date(e.fechaIngreso)
            const esNuevo = fi.getFullYear() === periodoActual.anio && (fi.getMonth() + 1) === periodoActual.mes
            const descuentoDiscrecional = (ajustesPorEmp[e.id] ?? [])
              .filter(a => a.concepto === 'prestamo' || a.concepto === 'otro_descuento')
              .reduce((s, a) => s + a.valor, 0)
            const descuentoDiscrecionalPct = actual.totalBruto > 0 ? (descuentoDiscrecional / actual.totalBruto) * 100 : 0
            return {
              empleado: e,
              neto: actual.salarioNeto,
              variacionBrutoPct,
              netoNegativo: actual.salarioNeto < 0,
              descuentoDiscrecionalPct,
              esNuevo,
            }
          })

        const filasConAlerta = filas.filter(f =>
          f.netoNegativo ||
          (f.variacionBrutoPct !== null && Math.abs(f.variacionBrutoPct) > UMBRAL_VARIACION) ||
          f.descuentoDiscrecionalPct > UMBRAL_DESCUENTO ||
          f.esNuevo
        )

        const salientes = anterior
          ? liquidaciones.filter(l => {
              const ft = new Date(l.fechaTerminacion)
              const enAnterior = ft.getFullYear() === anterior.anio && (ft.getMonth() + 1) === anterior.mes
              const enActual   = ft.getFullYear() === periodoActual.anio && (ft.getMonth() + 1) === periodoActual.mes
              return enAnterior || enActual
            })
          : []

        const sinAlertas = filasConAlerta.length === 0 && salientes.length === 0

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
              onClick={() => setAuditoriaIds(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Auditoría pre-cierre</h2>
                  </div>
                  <button onClick={() => setAuditoriaIds(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Esta acción completará el período — pasará de <strong>En Proceso</strong> a{' '}
                    <strong>Procesada</strong>. Revisa antes de continuar
                    {anterior ? ` (comparado con ${labelPeriodo(anterior)})` : ''}.
                  </p>

                  {sinAlertas ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      No se detectaron variaciones ni empleados fuera de lo esperado.
                    </div>
                  ) : (
                    <>
                      {filasConAlerta.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                                <th className="px-3 py-2 font-medium">Empleado</th>
                                <th className="px-3 py-2 font-medium text-right">Neto</th>
                                <th className="px-3 py-2 font-medium">Alerta</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-[#1d2035]">
                              {filasConAlerta.map(f => (
                                <tr key={f.empleado.id}>
                                  <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{fullName(f.empleado)}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${f.netoNegativo ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                    {fmt(f.neto, 0)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {f.netoNegativo && <Badge variant="danger">Neto negativo</Badge>}
                                      {f.variacionBrutoPct !== null && Math.abs(f.variacionBrutoPct) > UMBRAL_VARIACION && (
                                        <Badge variant="warning">
                                          {f.variacionBrutoPct > 0 ? '+' : ''}{f.variacionBrutoPct.toFixed(0)}% bruto
                                        </Badge>
                                      )}
                                      {f.descuentoDiscrecionalPct > UMBRAL_DESCUENTO && (
                                        <Badge variant="warning">Descuentos {f.descuentoDiscrecionalPct.toFixed(0)}% del bruto</Badge>
                                      )}
                                      {f.esNuevo && <Badge variant="info">Nuevo este mes</Badge>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {salientes.length > 0 && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
                          <p className="mb-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            Empleados desvinculados recientemente
                          </p>
                          <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                            {salientes.map(l => {
                              const emp = empleados.find(e => e.id === l.empleadoId)
                              return (
                                <li key={l.id}>
                                  {emp ? fullName(emp) : 'Empleado'} — liquidado el {formatDate(l.fechaTerminacion)}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                    El umbral de descuentos discrecionales (préstamos/otros) es una regla de negocio interna
                    de Cielo Cloud, no un límite establecido por el Código de Trabajo — revísalo con criterio propio.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                  <button
                    onClick={() => setAuditoriaIds(null)}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAuditoria}
                    className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-4 py-2 text-sm font-semibold text-white transition-colors"
                  >
                    Continuar y procesar
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
