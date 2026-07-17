import jsPDF from 'jspdf'
import { formatRD, fullName, formatCedula, formatDate } from '@/lib/utils'
import type { Empleado, Empresa, PeriodoNomina, ResultadoNomina } from '@/types'

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
