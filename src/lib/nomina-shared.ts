import jsPDF from 'jspdf'
import { formatRD, fullName, formatCedula, formatDate } from '@/lib/utils'
import { calcularNomina, calcularNominaQuincenal, ajustesToParams, getDivisorSalarioDiario, contarDiasLaborables } from '@/lib/dominican-labor'
import type {
  Empleado, Empresa, PeriodoNomina, ResultadoNomina, ParametrosNomina, TipoPeriodo,
  AjusteLinea, DisfruteVacaciones, Licencia, RegistroAumento,
} from '@/types'

// Helpers compartidos entre Cálculo de Nómina (/nomina), Gestión de Envíos
// (/nomina/envios) y su modal de comprobantes — viven fuera de nomina/page.tsx
// porque Next.js no permite exports adicionales en un archivo page.tsx
// ("labelPeriodo is not a valid Page export field").

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function labelPeriodo(p: PeriodoNomina): string {
  if (p.tipo === 'regalia') return `Regalía Pascual ${p.anio}`
  if (p.tipo === 'bonificacion') return `Bonificación Utilidades ${p.anio}`
  const mes = MESES[p.mes - 1]
  if (p.tipo === 'quincenal') {
    return `${p.quincena === 1 ? '1ª' : '2ª'} Quincena · ${mes} ${p.anio}`
  }
  return `${mes} ${p.anio}`
}

// ── Resultado sintético para el período de Regalía Pascual ────────────────────
// El pago de Regalía Pascual es bruto — sin AFP/SFS/ISR, igual tratamiento que
// Vacaciones/Regalía dentro de Liquidación (no es salario cotizable) — así que
// se representa como un ResultadoNomina con todo en cero salvo lo pagado, para
// poder reutilizar tal cual el modal de comprobante, el PDF y el flujo de
// envío por correo que ya existen para la nómina normal.
export function resultadoRegalia(empleadoId: string, monto: number, anosServicio: number): ResultadoNomina {
  return {
    empleadoId,
    salarioBruto: monto, importeHE35: 0, importeHE100: 0, totalHorasExtras: 0, importeNocturno: 0,
    bonificaciones: 0, comisiones: 0, ingresosPersonalizados: 0, totalBruto: monto,
    salarioCotizable: 0,
    afpEmpleado: 0, sfsEmpleado: 0, isrMensual: 0, sfsDependientes: 0, otrosDescuentos: 0,
    aporteVoluntarioAFPEmpleado: 0, vacacionesGoce: 0, vacacionesVendidas: 0, totalDescuentos: 0,
    grossingUpEmpresa: 0,
    saldoISRAplicado: 0,
    salarioNeto: monto,
    afpEmpleador: 0, sfsEmpleador: 0, srlEmpleador: 0, infotepEmpleador: 0,
    aporteVoluntarioAFPEmpresa: 0, totalAportesEmpleador: 0,
    totalCostoEmpleador: monto,
    regaliaPascual: monto, vacacionesMensualesDias: 0, vacacionesMensualesValor: 0,
    anosServicio,
  }
}

// ── Resultado real para el período de Bonificación por Utilidades ────────────
// A diferencia de la Regalía Pascual (100% exenta, resultado sintético en
// cero), la Bonificación por Participación en Utilidades (Art. 223) SÍ es
// salario ordinario a efectos fiscales — lleva AFP/SFS/ISR normales. Se
// calcula tratando el monto bruto (ya con el tope de 45/60 días aplicado en
// /bonificacion) como si fuera el salario del mes, reutilizando el motor
// real de nómina — mismo mecanismo ya usado para "Vacaciones No Gozadas" en
// Liquidación y "Vacaciones (Goce)/Vendidas" en Nómina.
export function resultadoBonificacion(empleado: Empleado, montoBruto: number): ResultadoNomina {
  return calcularNomina({ ...empleado, salarioBase: montoBruto })
}

// ── Comprobante PDF ───────────────────────────────────────────────────────────
export function descargarComprobantePDF(
  empleado: Empleado,
  nomina: ResultadoNomina,
  label: string,
  empresa: Empresa,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const NR = 27, NG = 41, NB = 128
  const LINE_GRAY: [number, number, number] = [228, 228, 231]

  // Header bar — navy con un filo más claro para dar profundidad de marca
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
    } catch {}
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
  doc.text('COMPROBANTE DE NÓMINA', W - 14, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(210, 214, 240)
  doc.text(label, W - 14, 18, { align: 'right' })
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-DO')}`, W - 14, 23, { align: 'right' })

  // Employee info — tarjeta con fondo tenue en vez de texto suelto
  let y = 36
  doc.setFillColor(250, 250, 251)
  doc.setDrawColor(...LINE_GRAY)
  doc.roundedRect(14, y, W - 28, 22, 2, 2, 'FD')
  y += 8
  doc.setTextColor(NR, NG, NB)
  doc.setFontSize(12.5)
  doc.setFont('helvetica', 'bold')
  doc.text(fullName(empleado), 20, y)
  y += 5.5
  doc.setFontSize(7.8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110, 110, 116)
  doc.text(`${empleado.cargo}  ·  ${empleado.departamento}  ·  Cédula: ${formatCedula(empleado.cedula)}`, 20, y)
  y += 4.5
  doc.text(`Ingreso: ${formatDate(empleado.fechaIngreso)}  ·  Salario base: ${formatRD(empleado.salarioBase)}`, 20, y)
  y += 10

  // Two columns
  const colW = (W - 32) / 2
  const c2 = 14 + colW + 4

  const chip = (rgb: [number, number, number], text: string, x: number) => {
    doc.setFillColor(...rgb)
    doc.roundedRect(x, y - 3.2, 2.4, 2.4, 0.6, 0.6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...rgb)
    doc.text(text, x + 4, y)
  }
  chip([16, 185, 129], 'DEVENGOS', 14)
  chip([220, 38, 38], 'DESCUENTOS', c2)
  y += 5

  const devengos = [
    { label: 'Salario Básico', v: nomina.salarioBruto },
    ...(nomina.importeHE35   > 0 ? [{ label: 'H.E. 35% Recargo',  v: nomina.importeHE35 }]   : []),
    ...(nomina.importeHE100  > 0 ? [{ label: 'H.E. 100% Recargo', v: nomina.importeHE100 }]  : []),
    ...(nomina.importeNocturno > 0 ? [{ label: 'Recargo Nocturno (15%)', v: nomina.importeNocturno }] : []),
    ...(nomina.bonificaciones > 0 ? [{ label: 'Bonificaciones',    v: nomina.bonificaciones }] : []),
    ...(nomina.comisiones     > 0 ? [{ label: 'Comisiones',        v: nomina.comisiones }]     : []),
    ...(nomina.vacacionesGoce > 0 ? [{ label: 'Vacaciones (Goce)', v: nomina.vacacionesGoce }] : []),
    ...(nomina.vacacionesVendidas > 0 ? [{ label: 'Vacaciones Vendidas', v: nomina.vacacionesVendidas }] : []),
    ...(nomina.ingresosPersonalizados > 0 ? [{ label: 'Otros Ingresos', v: nomina.ingresosPersonalizados }] : []),
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
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 251)
      doc.rect(12, ry - 3.7, W - 24, rH, 'F')
    }
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
  doc.setDrawColor(...LINE_GRAY)
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

  // Neto box — con un filo superior más claro para dar sensación de volumen
  y += 9
  doc.setFillColor(NR, NG, NB)
  doc.roundedRect(14, y, W - 28, 15, 2.5, 2.5, 'F')
  doc.setFillColor(47, 63, 168)
  doc.roundedRect(14, y, W - 28, 4, 2.5, 2.5, 'F')
  doc.setFillColor(NR, NG, NB)
  doc.rect(14, y + 3, W - 28, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('SALARIO NETO A PAGAR', 22, y + 5.5)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(formatRD(nomina.salarioNeto), W - 22, y + 10, { align: 'right' })

  // Aportes empresa — tarjeta tenue para agruparlo como bloque propio
  y += 21
  const aportes = [
    { label: 'AFP Empleador (7.10%)', v: nomina.afpEmpleador },
    { label: 'SFS Empleador (7.09%)', v: nomina.sfsEmpleador },
    { label: 'SRL Empleador',         v: nomina.srlEmpleador },
    { label: 'Infotep (1.00%)',       v: nomina.infotepEmpleador },
    ...(nomina.aporteVoluntarioAFPEmpresa > 0 ? [{ label: 'Aporte Voluntario AFP', v: nomina.aporteVoluntarioAFPEmpresa }] : []),
    ...(nomina.grossingUpEmpresa           > 0 ? [{ label: 'Grossing-up (ISR/TSS empleado)', v: nomina.grossingUpEmpresa }] : []),
  ]
  const cardH = 9 + aportes.length * 4.5 + 4
  doc.setFillColor(247, 248, 252)
  doc.setDrawColor(...LINE_GRAY)
  doc.roundedRect(14, y, W - 28, cardH, 2, 2, 'FD')
  y += 6.5
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('APORTES EMPRESA (TSS)', 20, y)
  y += 5
  aportes.forEach(a => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    doc.text(a.label, 20, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(formatRD(a.v), W - 20, y, { align: 'right' })
    y += 4.5
  })
  doc.setDrawColor(...LINE_GRAY)
  doc.line(20, y - 1.5, W - 20, y - 1.5)
  y += 2.5
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NR, NG, NB)
  doc.text('Costo Total Empresa', 20, y)
  doc.text(formatRD(nomina.totalCostoEmpleador), W - 20, y, { align: 'right' })

  // Footer
  y += 9
  doc.setDrawColor(...LINE_GRAY)
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
    doc.text(`ISR consolidado con ingreso de otro empleador (${formatRD(empleado.ingresoOtroEmpleadorMensual!)}/mes)`, 14, y)
    y += 4
  }

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(170, 170, 170)
  doc.text(`Regalía/período: ${formatRD(nomina.regaliaPascual)}`, 14, y)
  doc.text(`Vacaciones: ${nomina.vacacionesMensualesDias.toFixed(2)} días`, 90, y)
  doc.text('Ley 16-92  ·  Ley 87-01  ·  Ley 11-92', W - 14, y, { align: 'right' })

  // Pie de página fijo — marca + fecha de generación, siempre al fondo
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
  doc.text(`Generado el ${new Date().toLocaleDateString('es-DO')} — documento de uso interno`, W - 14, pageH - 8, { align: 'right' })

  doc.save(`comprobante-${empleado.cedula}-${label.replace(/\s+/g, '-')}.pdf`)
}

// ── Motor de "cálculo para un período específico" ─────────────────────────
// Extraído de nomina/page.tsx (mismo motivo que el resto de este archivo:
// Next.js no permite exports adicionales desde un page.tsx) — antes vivía
// SOLO ahí, y EnvioComprobantesModal.tsx usaba un motor "plano"
// (calcularConPeriodo, sin ninguno de los 5 mecanismos de abajo) como
// fallback para períodos cerrados sin snapshot histórico — el comprobante
// que se descargaba/enviaba podía no coincidir con lo que Cálculo de Nómina
// reportaba como pagado. Ahora ambos comparten exactamente esta misma
// implementación, sin divergencia posible.

// ── calcularConAjustes ────────────────────────────────────────────────────────
// `diasOverride` prorratea el salario base cuando el empleado no trabajó el
// período completo (ver diasSuspensionEnPeriodo) — ambos valores son días
// calendario en la MISMA unidad, así que la razón diasTrabajados/diasLaborablesMes
// es válida tanto para un período mensual como para media quincena. Reusa
// ajustesToParams (dominican-labor.ts) en vez de repetir el bucketing de
// conceptos inline — así el catálogo de conceptos personalizados (y
// cualquier concepto nuevo a futuro) solo necesita mantenerse en un lugar.
export function calcularConAjustes(
  empleado: Empleado,
  ajustes: AjusteLinea[],
  tipo: TipoPeriodo,
  quincena: 1 | 2,
  diasOverride?: { diasTrabajados: number; diasLaborablesMes: number } | null,
  vacacionesGoce?: number,
  vacacionesVendidas?: number,
): ResultadoNomina {
  const params: ParametrosNomina = {
    ...ajustesToParams(ajustes),
    ...(diasOverride ? { diasTrabajados: diasOverride.diasTrabajados, diasLaborablesMes: diasOverride.diasLaborablesMes } : {}),
    ...(vacacionesGoce ? { vacacionesGoce } : {}),
    ...(vacacionesVendidas ? { vacacionesVendidas } : {}),
  }
  return tipo === 'quincenal'
    ? calcularNominaQuincenal(empleado, quincena, params)
    : calcularNomina(empleado, params)
}

// ── Prorrateo por suspensión a mitad de período ────────────────────────────────
// Rango de fechas calendario que cubre un período — el mes completo para
// mensual, o la mitad correspondiente (1-15 / 16-fin) para quincenal.
export function rangoPeriodo(
  mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { inicio: Date; fin: Date } {
  const diasEnMes = new Date(anio, mes, 0).getDate()
  if (tipo === 'mensual') return { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, diasEnMes) }
  return quincena === 1
    ? { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, 15) }
    : { inicio: new Date(anio, mes - 1, 16), fin: new Date(anio, mes - 1, diasEnMes) }
}

// Si una fecha de corte (suspensión o salida pendiente) cae DENTRO (o
// después) del rango de este período, devuelve cuántos días calendario
// trabajó antes de esa fecha, sobre el total de días del período — para
// prorratear el salario en vez de pagar el período completo o excluirlo por
// completo. `null` si la fecha de corte cae ANTES de que el período
// empezara — ese caso se excluye del todo en empleadosDelPeriodo, no se
// prorratea.
function diasCorteEnPeriodo(
  fechaCorte: Date, mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number } | null {
  const { inicio, fin } = rangoPeriodo(mes, anio, tipo, quincena)
  if (fechaCorte < inicio) return null
  const finEfectivo = fechaCorte < fin ? fechaCorte : fin
  const msPorDia = 24 * 3600 * 1000
  const diasTrabajados     = Math.floor((finEfectivo.getTime() - inicio.getTime()) / msPorDia) + 1
  const diasLaborablesMes  = Math.floor((fin.getTime() - inicio.getTime()) / msPorDia) + 1
  return { diasTrabajados, diasLaborablesMes }
}

export function diasSuspensionEnPeriodo(
  empleado: Empleado, mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number } | null {
  if (!empleado.suspendido || !empleado.fechaSuspension) return null
  return diasCorteEnPeriodo(new Date(empleado.fechaSuspension), mes, anio, tipo, quincena)
}

// Igual que diasSuspensionEnPeriodo, pero para un empleado marcado con
// salida pendiente que eligió pagar sus días trabajados "por nómina" en vez
// de junto con la liquidación (Empleado.pagoDiasTrabajadosPendiente).
export function diasSalidaEnPeriodo(
  empleado: Empleado, mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number } | null {
  if (!empleado.salidaPendiente || empleado.pagoDiasTrabajadosPendiente !== 'nomina' || !empleado.fechaSalidaPendiente) return null
  return diasCorteEnPeriodo(new Date(empleado.fechaSalidaPendiente), mes, anio, tipo, quincena)
}

// ── Goce de vacaciones dentro de un período ────────────────────────────────
// A diferencia de suspensión/salida (un solo punto de corte, desde ahí en
// adelante), un Disfrute de Vacaciones es un RANGO que puede caer en medio
// del período. Se calculan por separado: (1) los días CALENDARIO de
// vacación dentro del rango del período, para reducir los días trabajados
// normales (mismo mecanismo de diasCorteEnPeriodo — consistente con cómo ya
// se prorratea por suspensión); y (2) los días LABORABLES (excl. domingo)
// tomados dentro de ese mismo rango, para valorar el goce a pagar (tarifa
// diaria × días — la misma convención ya usada en /vacaciones y en
// Liquidación para "Vacaciones No Gozadas", no la fracción calendario).
//
// Un registro de tipo 'venta' (venta de vacaciones) NO reduce días
// trabajados — el empleado sigue trabajando normal, solo cambia días de
// descanso futuro por dinero ahora — así que su solape con el período se
// evalúa igual (fechaInicio === fechaFin, una sola fecha efectiva) pero solo
// aporta a `vacacionesVendidas`, nunca a `diasVacCalendario`.
//
// Si el período es quincenal, ambos montos se PRE-DOBLAN antes de
// devolverlos: calcularNominaQuincenal divide TODO el bruto entre 2 —
// incluidas bonificaciones/comisiones, ver CLAUDE.md "Quincenal" — así que
// duplicarlo aquí hace que, tras esa división automática, el resultado sea
// el monto real correspondiente a esta quincena específica (mismo truco
// implícito que ya "sobrevive" el prorrateo de días vía diasCorteEnPeriodo).
export function diasVacacionEnPeriodo(
  empleado: Empleado, disfrutes: DisfruteVacaciones[], mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number; vacacionesGoce: number; vacacionesVendidas: number } | null {
  const { inicio, fin } = rangoPeriodo(mes, anio, tipo, quincena)
  const msPorDia = 24 * 3600 * 1000
  const propios = disfrutes.filter(d => d.empleadoId === empleado.id)
  const tarifaDiaria = empleado.salarioBase / getDivisorSalarioDiario(empleado)

  let diasVacCalendario = 0
  let goceRealDisfrute  = 0
  let goceRealVenta     = 0
  for (const d of propios) {
    const dInicio = new Date(d.fechaInicio)
    const dFin    = new Date(d.fechaFin)
    const solapInicio = dInicio < inicio ? inicio : dInicio
    const solapFin    = dFin > fin ? fin : dFin
    if (solapInicio > solapFin) continue
    if (d.tipo === 'venta') {
      goceRealVenta += d.diasLaborables * tarifaDiaria
    } else {
      diasVacCalendario += Math.floor((solapFin.getTime() - solapInicio.getTime()) / msPorDia) + 1
      goceRealDisfrute   += contarDiasLaborables(solapInicio, solapFin) * tarifaDiaria
    }
  }
  if (diasVacCalendario === 0 && goceRealVenta === 0) return null

  const diasLaborablesMes = Math.floor((fin.getTime() - inicio.getTime()) / msPorDia) + 1
  const diasTrabajados    = Math.max(0, diasLaborablesMes - diasVacCalendario)
  const factor = tipo === 'quincenal' ? 2 : 1
  return {
    diasTrabajados, diasLaborablesMes,
    vacacionesGoce:     goceRealDisfrute * factor,
    vacacionesVendidas: goceRealVenta * factor,
  }
}

// ── Licencia sin sueldo dentro de un período ────────────────────────────────
// Solo enfermedad_comun/accidente_laboral SIN disfrute de sueldo reducen los
// días trabajados. El resto de las licencias (matrimonial/fallecimiento/
// alumbramiento, maternidad, y enfermedad/accidente CON disfrute de sueldo)
// NO se tocan aquí — en esos casos el salario del empleado sigue corriendo
// sin interrupción por ley o por decisión de la empresa, así que el sueldo
// mensual normal (sin prorratear) ya cubre esos días correctamente, igual
// que ya sucede hoy sin ningún cambio.
//
// Cuando NO hay disfrute de sueldo, la empresa no paga nada por esos días
// (el subsidio de SISALRIL/ARL se paga directo al empleado, fuera de
// nómina) — sin este prorrateo, el empleado recibiría su sueldo completo
// por nómina Y el subsidio de TSS por los mismos días de ausencia, un doble
// pago silencioso. Mismo mecanismo de solape/clamp que diasVacacionEnPeriodo,
// pero sin monto que calcular — solo reduce diasTrabajados, igual que
// diasCorteEnPeriodo hace para suspensión.
export function diasLicenciaSinSueldoEnPeriodo(
  empleado: Empleado, licencias: Licencia[], mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): { diasTrabajados: number; diasLaborablesMes: number } | null {
  const { inicio, fin } = rangoPeriodo(mes, anio, tipo, quincena)
  const msPorDia = 24 * 3600 * 1000
  const propias = licencias.filter(l =>
    l.empleadoId === empleado.id &&
    (l.tipo === 'enfermedad_comun' || l.tipo === 'accidente_laboral') &&
    !l.disfruteSueldo
  )

  let diasLicenciaCalendario = 0
  for (const l of propias) {
    const lInicio = new Date(l.fechaInicio)
    const lFin    = new Date(l.fechaFin)
    const solapInicio = lInicio < inicio ? inicio : lInicio
    const solapFin    = lFin > fin ? fin : lFin
    if (solapInicio > solapFin) continue
    diasLicenciaCalendario += Math.floor((solapFin.getTime() - solapInicio.getTime()) / msPorDia) + 1
  }
  if (diasLicenciaCalendario === 0) return null

  const diasLaborablesMes = Math.floor((fin.getTime() - inicio.getTime()) / msPorDia) + 1
  const diasTrabajados    = Math.max(0, diasLaborablesMes - diasLicenciaCalendario)
  return { diasTrabajados, diasLaborablesMes }
}

// ── Reajuste salarial a mitad de período ────────────────────────────────────
// Cuando un aumento ya APLICADO tiene fechaEfectiva dentro del rango del
// período, el empleado no debería cobrar el salario nuevo completo desde el
// día 1 del período — parte corresponde al salario anterior, parte al
// nuevo. En vez de sumar dos llamadas independientes a calcularNomina (lo
// que rompería los topes cotizables de TSS y los tramos de ISR, calculados
// sobre el total real del mes, no sobre dos sub-cálculos por separado), se
// computa un salario PONDERADO por días — el mismo total que el empleado
// gana en el mes — y se usa como si fuera su salarioBase completo para ese
// período. Mismo mecanismo ya usado para Vacaciones/Bonificación (tratar un
// monto calculado como si fuera el salario base vía calcularNomina({
// ...empleado, salarioBase: monto })).
//
// Solo aplica a períodos aún en_proceso — un período ya cerrado es un
// registro histórico inmutable (mismo principio que el resto del sistema),
// así que un aumento aplicado después de cerrar un período no lo corrige
// retroactivamente solo; para eso existe "Reabrir" (desposteo).
//
// Soporta más de un reajuste dentro del mismo período (caso raro pero
// posible) — construye segmentos consecutivos, cada uno al salario vigente
// en ese tramo, ordenados por fechaEfectiva.
export function salarioEfectivoEnPeriodo(
  empleadoId: string, aumentos: RegistroAumento[],
  mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): number | null {
  const { inicio, fin } = rangoPeriodo(mes, anio, tipo, quincena)
  const msPorDia = 24 * 3600 * 1000
  const aplicados = aumentos
    .filter(a => a.empleadoId === empleadoId && a.estado === 'aplicado' && a.fechaEfectiva)
    .map(a => ({ ...a, fechaEfectivaDate: new Date(a.fechaEfectiva!) }))
    .sort((a, b) => a.fechaEfectivaDate.getTime() - b.fechaEfectivaDate.getTime())
  if (aplicados.length === 0) return null

  const relevantes = aplicados.filter(a => a.fechaEfectivaDate >= inicio && a.fechaEfectivaDate <= fin)

  if (relevantes.length > 0) {
    const diasLaborablesMes = Math.floor((fin.getTime() - inicio.getTime()) / msPorDia) + 1
    let cursor = inicio
    let totalPonderado = 0
    for (const r of relevantes) {
      const finTramo = new Date(r.fechaEfectivaDate.getTime() - msPorDia)
      if (finTramo >= cursor) {
        const dias = Math.floor((finTramo.getTime() - cursor.getTime()) / msPorDia) + 1
        totalPonderado += dias * r.salarioAnterior
      }
      cursor = r.fechaEfectivaDate
    }
    const diasFinal = Math.floor((fin.getTime() - cursor.getTime()) / msPorDia) + 1
    totalPonderado += diasFinal * relevantes[relevantes.length - 1].salarioNuevo

    return Math.round((totalPonderado / diasLaborablesMes) * 100) / 100
  }

  // Ningún aumento cae DENTRO de este período específico — pero eso no
  // significa que el salario en vivo del empleado (Empleado.salarioBase)
  // sea el correcto para ESTE período. Dos casos reales donde no lo es:
  // (a) período RETROACTIVO (creado para un mes pasado, hasta 10 años
  //     atrás) anterior a uno o más aumentos ya aplicados desde entonces —
  //     el salario en vivo ya refleja aumentos que en ese mes histórico
  //     todavía no existían; (b) un aumento se "Aplica a Nómina" con
  //     fechaEfectiva FUTURA — aplicar() ya sobrescribe el salario en vivo
  //     de inmediato (es el valor que debe regir de ahora en adelante),
  //     pero cualquier período anterior a esa fecha efectiva no debería
  //     cobrar el salario nuevo todavía. En ambos casos, se reconstruye el
  //     salario vigente AL FINAL de este período recorriendo la línea de
  //     tiempo de aumentos aplicados — si el período completo antecede al
  //     primer aumento conocido, se usa el salarioAnterior de ese aumento;
  //     si cae entre dos aumentos (o después del último), se usa el
  //     salarioNuevo del aumento más reciente cuya fechaEfectiva ya pasó.
  let vigente: number | null = null
  for (const a of aplicados) {
    if (a.fechaEfectivaDate <= fin) vigente = a.salarioNuevo
    else if (vigente === null) vigente = a.salarioAnterior
  }
  return vigente
}

// Envoltorio de conveniencia: calcula la nómina de un empleado para un
// período específico, aplicando automáticamente el prorrateo por suspensión,
// salida pendiente, licencia sin sueldo, o el salario ponderado por un
// reajuste a mitad de período, si corresponde — evita tener que acordarse
// de calcular cada mecanismo en cada call-site. Usada tanto por Cálculo de
// Nómina (nomina/page.tsx) como por Gestión de Envíos / el modal de
// comprobantes (EnvioComprobantesModal.tsx) — una sola fuente de verdad.
export function calcularParaPeriodo(
  empleado: Empleado, ajustes: AjusteLinea[],
  periodo: { mes: number; anio: number; tipo: TipoPeriodo; quincena?: 1 | 2 },
  disfrutes: DisfruteVacaciones[] = [],
  licencias: Licencia[] = [],
  aumentos: RegistroAumento[] = [],
): ResultadoNomina {
  const quincena = periodo.quincena ?? 1
  const salarioEfectivo = salarioEfectivoEnPeriodo(empleado.id, aumentos, periodo.mes, periodo.anio, periodo.tipo, quincena)
  const empleadoCalculo = salarioEfectivo !== null ? { ...empleado, salarioBase: salarioEfectivo } : empleado

  const dias = diasSuspensionEnPeriodo(empleadoCalculo, periodo.mes, periodo.anio, periodo.tipo, quincena)
    ?? diasSalidaEnPeriodo(empleadoCalculo, periodo.mes, periodo.anio, periodo.tipo, quincena)
    ?? diasLicenciaSinSueldoEnPeriodo(empleadoCalculo, licencias, periodo.mes, periodo.anio, periodo.tipo, quincena)
  // Suspensión/salida/licencia sin sueldo tienen prioridad sobre vacaciones
  // — un empleado no debería tener a la vez un disfrute de vacaciones
  // vigente en la práctica; si ambos existieran por error de captura, se
  // respeta el prorrateo por suspensión/salida/licencia (ya excluye al
  // empleado de nómina normal) y se ignora el disfrute para ese período. El
  // salario ponderado por reajuste, en cambio, SÍ compone con cualquiera de
  // los otros mecanismos (se aplica primero, como base, antes de cualquier
  // prorrateo de días encima).
  if (dias) return calcularConAjustes(empleadoCalculo, ajustes, periodo.tipo, quincena, dias)
  const vac = diasVacacionEnPeriodo(empleadoCalculo, disfrutes, periodo.mes, periodo.anio, periodo.tipo, quincena)
  return calcularConAjustes(
    empleadoCalculo, ajustes, periodo.tipo, quincena,
    vac ? { diasTrabajados: vac.diasTrabajados, diasLaborablesMes: vac.diasLaborablesMes } : null,
    vac?.vacacionesGoce,
    vac?.vacacionesVendidas,
  )
}
