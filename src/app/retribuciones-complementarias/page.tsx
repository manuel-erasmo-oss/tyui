'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { useRetribuciones } from '@/lib/retribuciones-context'
import { usePrestamos } from '@/lib/prestamos-context'
import {
  TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES, fechaLimiteIR17,
  CONCEPTO_RETRIB_VEHICULO, CONCEPTO_RETRIB_VIVIENDA, CONCEPTO_RETRIB_DIFERENCIAL_INTERES,
  porcentajeUsoPersonalVehiculoSugerido, resolverBaseGravableRetribuciones,
  calcularDiferencialesInteresPrestamos,
} from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName, parseFechaLocal, hoyLocalISO } from '@/lib/utils'
import type { RetribucionComplementaria } from '@/types'
import Link from 'next/link'
import {
  Landmark, Percent, CalendarClock, Plus, Trash2, Info, Download,
  ChevronLeft, ChevronRight, CheckCircle2, Undo2, History, Users, FileDown,
  HandCoins,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Mismo navy y estilo autoTable ya usado en src/app/reportes/page.tsx — se
// duplica localmente (en vez de importar) porque Next.js no permite exports
// adicionales desde un archivo page.tsx (ver nomina-shared.ts para el
// mismo problema resuelto de otra forma, extrayendo a un lib compartido —
// aquí no se justifica un lib nuevo porque solo este módulo lo usa).
const NAVY: [number, number, number] = [27, 41, 128]

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Categorías genéricas de beneficios en especie más comunes en la práctica dominicana
// (El "Diferencial de Interés (Art. 318)" no aparece aquí: solo se genera
// desde la detección automática de préstamos, nunca a mano.)
const CATEGORIAS_RETRIBUCION = [
  CONCEPTO_RETRIB_VEHICULO,
  CONCEPTO_RETRIB_VIVIENDA,
  'Colegios / Educación',
  'Otros beneficios en especie',
] as const

const fmtTasa = (t: number) => t.toLocaleString('es-DO', { maximumFractionDigits: 4 })

const num = (v: string) =>{ const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0 }

// Texto corto del desglose de una línea — compartido entre tabla, Excel y PDF.
function textoDesglose(l: RetribucionComplementaria, info?: { reduccionVehiculo: boolean; excedenteVehiculo: boolean }): string {
  if (l.prestamoId) return 'Diferencial de interés de préstamo (Art. 318)'
  if (l.concepto === CONCEPTO_RETRIB_VEHICULO && typeof l.vehiculoValorMensual === 'number') {
    const prop = l.vehiculoPropiedadDe === 'empleado' ? 'del empleado' : 'de la empresa'
    const ofi = l.vehiculoEsEmpleadoDeOficina ? 'empleado de oficina' : 'empleado no de oficina'
    if (info?.excedenteVehiculo) {
      return `Valor ${formatRD(l.vehiculoValorMensual)} × 100% — vehículo adicional (solo el menos costoso recibe el %)`
    }
    return `Valor ${formatRD(l.vehiculoValorMensual)} × ${l.vehiculoPorcentajeAplicado ?? '—'}% uso personal · vehículo ${prop}, ${ofi}`
  }
  if (l.viviendaDepreciacionAlquiler != null || l.viviendaMantenimiento != null || l.viviendaServicios != null) {
    return `Depreciación/alquiler ${formatRD(l.viviendaDepreciacionAlquiler ?? 0)} + mantenimiento ${formatRD(l.viviendaMantenimiento ?? 0)} + servicios ${formatRD(l.viviendaServicios ?? 0)}`
  }
  return ''
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

const hoy = new Date()

export default function RetribucionesComplementariasPage() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa } = useEmpresa()
  const { retribuciones, agregar, eliminar, marcarDeclarado, desmarcarDeclarado } = useRetribuciones()
  const { prestamos } = usePrestamos()

  const [mesSel, setMesSel] = useState(hoy.getMonth() + 1)
  const [anioSel, setAnioSel] = useState(hoy.getFullYear())

  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [concepto, setConcepto] = useState<string>(CATEGORIAS_RETRIBUCION[0])
  const [valorMensual, setValorMensual] = useState<string>('')
  // Desglose de Vivienda
  const [vivDep, setVivDep] = useState('')
  const [vivMant, setVivMant] = useState('')
  const [vivServ, setVivServ] = useState('')
  // Desglose de Vehículo
  const [vehValor, setVehValor] = useState('')
  const [vehOficina, setVehOficina] = useState(false)
  const [vehPropiedad, setVehPropiedad] = useState<'empresa' | 'empleado'>('empresa')
  const [vehPct, setVehPct] = useState(String(porcentajeUsoPersonalVehiculoSugerido(false, 'empresa')))
  const [toast, setToast] = useState<string | null>(null)
  const [mostrarDetector, setMostrarDetector] = useState(false)

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  function cambiarMes(delta: number) {
    let m = mesSel + delta
    let a = anioSel
    if (m > 12) { m = 1; a += 1 }
    if (m < 1) { m = 12; a -= 1 }
    setMesSel(m)
    setAnioSel(a)
  }

  const esVivienda = concepto === CONCEPTO_RETRIB_VIVIENDA
  const esVehiculo = concepto === CONCEPTO_RETRIB_VEHICULO
  const vehPctSugerido = porcentajeUsoPersonalVehiculoSugerido(vehOficina, vehPropiedad)

  // Al cambiar los factores de la matriz se re-sugiere el %; el usuario puede
  // sobrescribirlo a mano después (queda guardado como vehiculoPorcentajeAplicado).
  function cambiarFactoresVehiculo(oficina: boolean, propiedad: 'empresa' | 'empleado') {
    setVehOficina(oficina)
    setVehPropiedad(propiedad)
    setVehPct(String(porcentajeUsoPersonalVehiculoSugerido(oficina, propiedad)))
  }

  const totalVivienda = num(vivDep) + num(vivMant) + num(vivServ)
  const vehPctNum = Math.min(100, Math.max(0, parseFloat(vehPct) || 0))

  // Vista previa del vehículo con la regla del menos costoso aplicada contra
  // los vehículos ya registrados de ese mismo empleado/mes.
  const previewVehiculo = useMemo(() => {
    if (!esVehiculo || num(vehValor) <= 0) return null
    const hipotetica: RetribucionComplementaria = {
      id: '~preview', mes: mesSel, anio: anioSel, concepto: CONCEPTO_RETRIB_VEHICULO, valorMensual: 0,
      empleadoId: empleadoId || undefined, vehiculoValorMensual: num(vehValor),
      vehiculoEsEmpleadoDeOficina: vehOficina, vehiculoPropiedadDe: vehPropiedad, vehiculoPorcentajeAplicado: vehPctNum,
    }
    const delMes = retribuciones.filter(r => r.mes === mesSel && r.anio === anioSel)
    const resueltas = resolverBaseGravableRetribuciones([...delMes, hipotetica])
    const otrosVehiculosEmpresa = empleadoId && vehPropiedad === 'empresa'
      ? delMes.filter(r => r.empleadoId === empleadoId && r.concepto === CONCEPTO_RETRIB_VEHICULO
          && typeof r.vehiculoValorMensual === 'number' && r.vehiculoPropiedadDe === 'empresa').length
      : 0
    return { ...resueltas.get('~preview')!, otrosVehiculosEmpresa }
  }, [esVehiculo, vehValor, vehOficina, vehPropiedad, vehPctNum, empleadoId, mesSel, anioSel, retribuciones])

  const puedeAgregar = esVivienda ? totalVivienda > 0 : esVehiculo ? num(vehValor) > 0 : num(valorMensual) > 0

  function limpiarFormulario() {
    setValorMensual(''); setVivDep(''); setVivMant(''); setVivServ(''); setVehValor('')
  }

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeAgregar) return
    const emp = empleadoId || undefined
    if (esVivienda) {
      agregar(mesSel, anioSel, concepto, totalVivienda, emp, undefined, {
        viviendaDepreciacionAlquiler: num(vivDep),
        viviendaMantenimiento: num(vivMant),
        viviendaServicios: num(vivServ),
      })
    } else if (esVehiculo) {
      // valorMensual guardado = base al momento de crear (referencia); la base
      // efectiva siempre se re-resuelve con la regla del vehículo menos costoso.
      agregar(mesSel, anioSel, concepto, previewVehiculo?.base ?? 0, emp, undefined, {
        vehiculoValorMensual: num(vehValor),
        vehiculoEsEmpleadoDeOficina: vehOficina,
        vehiculoPropiedadDe: vehPropiedad,
        vehiculoPorcentajeAplicado: vehPctNum,
      })
    } else {
      agregar(mesSel, anioSel, concepto, num(valorMensual), emp)
    }
    limpiarFormulario()
  }

  // ── Diferenciales de interés de préstamos (Art. 318) ──────────────────────
  const tasaReferencia = empresa.tasaInteresReferenciaPrestamos
  const diferenciales = useMemo(() => {
    // Solo préstamos ya otorgados al cierre del mes en vista. Usa el saldo
    // pendiente ACTUAL (no hay snapshot del saldo de cada mes histórico).
    const finMes = new Date(anioSel, mesSel, 0)
    const vigentes = prestamos.filter(p => !p.fechaOtorgamiento || parseFechaLocal(p.fechaOtorgamiento) <= finMes)
    return calcularDiferencialesInteresPrestamos(vigentes, tasaReferencia)
  }, [prestamos, tasaReferencia, mesSel, anioSel])

  const prestamosYaAgregados = useMemo(
    () => new Set(retribuciones.filter(r => r.mes === mesSel && r.anio === anioSel && r.prestamoId).map(r => r.prestamoId!)),
    [retribuciones, mesSel, anioSel]
  )
  const diferencialesPendientes = diferenciales.filter(d => !prestamosYaAgregados.has(d.prestamoId))

  function agregarDiferencial(d: (typeof diferenciales)[number]) {
    if (prestamosYaAgregados.has(d.prestamoId)) return
    agregar(
      mesSel, anioSel, CONCEPTO_RETRIB_DIFERENCIAL_INTERES, d.diferencialMensual, d.empleadoId,
      `Préstamo ${d.prestamoId} — saldo ${formatRD(d.saldoPendiente)} a ${fmtTasa(d.tasaMensualPrestamo)}% mensual (${fmtTasa(d.tasaAnualPrestamo)}% anual) vs. referencia ${fmtTasa(d.tasaReferenciaAnual)}% anual`,
      { prestamoId: d.prestamoId },
    )
  }

  function agregarTodosDiferenciales() {
    diferencialesPendientes.forEach(agregarDiferencial)
    if (diferencialesPendientes.length > 0) {
      setToast(`${diferencialesPendientes.length} diferencial(es) de interés agregado(s) — ${MESES[mesSel - 1]} ${anioSel}`)
    }
  }

  function handleEliminar(id: string) {
    eliminar(id)
  }

  const lineasDelMes = useMemo(
    () => retribuciones.filter(r => r.mes === mesSel && r.anio === anioSel).sort((a, b) => a.id.localeCompare(b.id)),
    [retribuciones, mesSel, anioSel]
  )

  // Base gravable efectiva de TODAS las líneas (desglose vivienda/vehículo +
  // regla del vehículo menos costoso) — la regla agrupa por empleado/mes, así
  // que resolver sobre el conjunto completo da el mismo resultado por mes.
  const bases = useMemo(() => resolverBaseGravableRetribuciones(retribuciones), [retribuciones])
  const baseDe = (l: RetribucionComplementaria) => bases.get(l.id)?.base ?? l.valorMensual

  const totalMensual = lineasDelMes.reduce((s, l) => s + baseDe(l), 0)
  const impuestoMensual = totalMensual * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES
  const impuestoAnualizado = impuestoMensual * 12

  const declarado = lineasDelMes.length > 0 && lineasDelMes.every(l => l.declarada)
  const fechaDeclaracionMes = declarado ? lineasDelMes[0]?.fechaDeclaracion : undefined
  const limiteIR17 = fechaLimiteIR17(mesSel, anioSel)
  const diasRestantes = Math.ceil((limiteIR17.getTime() - hoy.getTime()) / (1000 * 3600 * 24))

  function handleMarcarDeclarado() {
    marcarDeclarado(mesSel, anioSel, hoyLocalISO())
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
      g.total += bases.get(r.id)?.base ?? r.valorMensual
      if (!r.declarada) g.declarada = false
      else if (!g.fecha) g.fecha = r.fechaDeclaracion
      grupos.set(key, g)
    }
    return Array.from(grupos.values()).sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))
  }, [retribuciones, bases])

  // ── Acumulado por empleado — histórico completo (todos los meses), no solo
  // el mes en vista. Permite a RRHH ver de un vistazo quién ha recibido más
  // beneficios en especie a lo largo del tiempo, sin tener que revisar mes
  // por mes. Las líneas sin empleado asignado se agrupan aparte, al final.
  const acumuladoPorEmpleado = useMemo(() => {
    const grupos = new Map<string, { empleadoId?: string; total: number; meses: Set<string>; conceptos: number }>()
    for (const r of retribuciones) {
      const key = r.empleadoId ?? '__general__'
      const g = grupos.get(key) ?? { empleadoId: r.empleadoId, total: 0, meses: new Set<string>(), conceptos: 0 }
      g.total += bases.get(r.id)?.base ?? r.valorMensual
      g.meses.add(`${r.anio}-${r.mes}`)
      g.conceptos += 1
      grupos.set(key, g)
    }
    return Array.from(grupos.values())
      .map(g => ({ ...g, meses: g.meses.size }))
      .sort((a, b) => b.total - a.total)
  }, [retribuciones, bases])

  async function handleExportarExcel() {
    if (retribuciones.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    // Columnas de desglose: celdas vacías (null) cuando no aplican a la línea,
    // así las líneas planas (Colegios/Otros/legado) conservan el mismo formato.
    const filasDetalle = lineasDelMes.map(l => {
      const info = bases.get(l.id)
      const esVeh = l.concepto === CONCEPTO_RETRIB_VEHICULO && typeof l.vehiculoValorMensual === 'number'
      return [
        l.concepto,
        l.empleadoId && empMap[l.empleadoId] ? fullName(empMap[l.empleadoId]) : 'General / sin asignar',
        l.viviendaDepreciacionAlquiler ?? null,
        l.viviendaMantenimiento ?? null,
        l.viviendaServicios ?? null,
        esVeh ? l.vehiculoValorMensual! : null,
        esVeh ? (info?.excedenteVehiculo ? 100 : (l.vehiculoPorcentajeAplicado ?? null)) : null,
        baseDe(l),
        baseDe(l) * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES,
        textoDesglose(l, info),
      ]
    })
    const filasHistorial = historialMeses.map(g => [
      `${MESES[g.mes - 1]} ${g.anio}`,
      g.total,
      g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES,
      g.declarada ? `Declarado${g.fecha ? ` (${formatDate(g.fecha)})` : ''}` : 'Pendiente',
    ])
    const filasAcumulado = acumuladoPorEmpleado.map(g => [
      g.empleadoId && empMap[g.empleadoId] ? fullName(empMap[g.empleadoId]) : 'General / sin asignar',
      g.meses,
      g.conceptos,
      g.total,
      g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES,
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
          encabezados: [
            'Concepto', 'Empleado', 'Vivienda: Depreciación / Alquiler', 'Vivienda: Mantenimiento', 'Vivienda: Servicios',
            'Vehículo: Valor Mensual', 'Vehículo: % Uso Personal', 'Base Gravable (RD$)', 'Impuesto Sustitutivo 27%', 'Detalle del Cálculo',
          ],
          filas: filasDetalle,
          totales: [`TOTAL — ${lineasDelMes.length} concepto(s)`, '', null, null, null, null, null, totalMensual, impuestoMensual, ''],
          anchos: [30, 26, 18, 16, 14, 16, 14, 20, 22, 60],
        },
        {
          nombre: 'Historial Mensual',
          titulo: 'Historial de Declaraciones IR-17',
          subtitulo: 'Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII',
          encabezados: ['Mes', 'Valor Total (RD$)', 'Impuesto Sustitutivo 27%', 'Estado'],
          filas: filasHistorial,
          anchos: [20, 20, 22, 26],
        },
        {
          nombre: 'Acumulado por Empleado',
          titulo: 'Acumulado Histórico por Empleado',
          subtitulo: 'Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII',
          encabezados: ['Empleado', 'Meses', 'Conceptos', 'Total Histórico (RD$)', 'Impuesto Sustitutivo Total'],
          filas: filasAcumulado,
          anchos: [28, 10, 12, 22, 24],
          columnasEnteras: [1, 2],
        },
      ],
    })
    setToast('Retribuciones complementarias exportadas a Excel')
  }

  // Documento de soporte de la declaración IR-17 del mes en vista — mismo
  // estilo autoTable/NAVY ya usado en los reportes de Reportería. A
  // diferencia del Excel (que exporta también el histórico completo por
  // empleado), el PDF se centra en lo que hace falta para la declaración de
  // ESTE mes: detalle + estado + historial, como constancia de soporte.
  function handleExportarPDF() {
    if (lineasDelMes.length === 0) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210

    doc.setFillColor(...NAVY)
    doc.rect(0, 0, pageW, 22, 'F')
    let textX = 14
    if (empresa.logo) {
      try {
        const fmt = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(empresa.logo, fmt, 14, 3, 16, 16)
        textX = 34
      } catch { /* logo corrupto o formato no soportado — se omite */ }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(empresa.nombre || 'Empresa', textX, 10)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`RNC: ${empresa.rnc || '—'}`, textX, 16)

    doc.setTextColor(...NAVY)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Retribuciones Complementarias', 14, 31)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`${MESES[mesSel - 1]} ${anioSel} — Impuesto Sustitutivo 27% (Formulario IR-17)`, 14, 37)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-DO')}`, pageW - 14, 31, { align: 'right' })

    autoTable(doc, {
      startY: 44,
      head: [['Concepto', 'Empleado', 'Base Gravable', 'Impuesto Sustitutivo 27%']],
      // El desglose (vivienda/vehículo/préstamo) va como segunda línea del
      // concepto, para no romper el formato en líneas sin desglose.
      body: lineasDelMes.map(l => {
        const desglose = textoDesglose(l, bases.get(l.id))
        return [
          desglose ? `${l.concepto}\n${desglose}` : l.concepto,
          l.empleadoId && empMap[l.empleadoId] ? fullName(empMap[l.empleadoId]) : 'General / sin asignar',
          formatRD(baseDe(l)),
          formatRD(baseDe(l) * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES),
        ]
      }),
      foot: [[`TOTAL — ${lineasDelMes.length} concepto(s)`, '', formatRD(totalMensual), formatRD(impuestoMensual)]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 82 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })

    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } }
    let y = (docTyped.lastAutoTable?.finalY ?? 44) + 10

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text('Estado de Declaración IR-17', 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(
      declarado
        ? `Declarado${fechaDeclaracionMes ? ` — ${formatDate(fechaDeclaracionMes)}` : ''}`
        : `Pendiente — límite ${formatDate(limiteIR17.toISOString())} (${diasRestantes < 0 ? `vencido hace ${Math.abs(diasRestantes)} día(s)` : `${diasRestantes} día(s) restantes`})`,
      14, y + 6,
    )
    y += 16

    if (historialMeses.length > 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...NAVY)
      doc.text('Historial de Declaraciones IR-17', 14, y)
      autoTable(doc, {
        startY: y + 3,
        head: [['Mes', 'Valor Total', 'Impuesto (27%)', 'Estado']],
        body: historialMeses.map(g => [
          `${MESES[g.mes - 1]} ${g.anio}`,
          formatRD(g.total),
          formatRD(g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES),
          g.declarada ? `Declarado${g.fecha ? ` (${formatDate(g.fecha)})` : ''}` : 'Pendiente',
        ]),
        theme: 'plain',
        headStyles: { fillColor: [255, 255, 255], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })
    }

    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.4)
    doc.line(14, pageH - 12, pageW - 14, pageH - 12)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text('Cielo Cloud · Nómina', 14, pageH - 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(170, 170, 170)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-DO')}`, pageW - 14, pageH - 8, { align: 'right' })

    doc.save(`retribuciones-complementarias-${anioSel}-${String(mesSel).padStart(2, '0')}.pdf`)
    setToast('PDF generado')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Retribuciones Complementarias"
        subtitle="Impuesto Sustitutivo 27% · Formulario IR-17 · Guía DGII"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportarPDF}
              disabled={lineasDelMes.length === 0}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={lineasDelMes.length === 0 ? `Sin retribuciones en ${MESES[mesSel - 1]} ${anioSel}` : undefined}
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </button>
            <button
              onClick={handleExportarExcel}
              disabled={retribuciones.length === 0}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
          </div>
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
              {!esVivienda && !esVehiculo && (
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
              )}

              {/* ── Desglose de Vivienda: suma de gastos reales imputados ── */}
              {esVivienda && (
                <div className="w-full rounded-lg border border-zinc-100 dark:border-[#1d2035] bg-zinc-50/60 dark:bg-[#1a1d2e]/60 p-4 space-y-3">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    La base gravable de la vivienda es la <strong>suma de los gastos reales imputados</strong> (Guía DGII No.14).
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {([
                      ['vivDep', 'Depreciación / Alquiler', vivDep, setVivDep],
                      ['vivMant', 'Mantenimiento', vivMant, setVivMant],
                      ['vivServ', 'Servicios', vivServ, setVivServ],
                    ] as const).map(([id, label, val, set]) => (
                      <div key={id} className="space-y-1.5">
                        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</label>
                        <input id={id} type="number" min="0" value={val} onChange={e => set(e.target.value)} placeholder="0.00" className={INPUT_CLASS} />
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total mensual</span>
                      <p data-testid="vivienda-total" className="rounded-lg bg-[#eef0fb] dark:bg-indigo-950/30 px-3 py-2 text-sm font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">
                        {formatRD(totalVivienda)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Desglose de Vehículo: valor × % de uso personal presunto ── */}
              {esVehiculo && (
                <div className="w-full rounded-lg border border-zinc-100 dark:border-[#1d2035] bg-zinc-50/60 dark:bg-[#1a1d2e]/60 p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <label htmlFor="vehValor" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor mensual del vehículo</label>
                      <input id="vehValor" type="number" min="0" value={vehValor} onChange={e => setVehValor(e.target.value)} placeholder="0.00" className={INPUT_CLASS} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="vehOficina" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">¿Empleado de oficina?</label>
                      <select id="vehOficina" value={vehOficina ? 'si' : 'no'} onChange={e => cambiarFactoresVehiculo(e.target.value === 'si', vehPropiedad)} className={INPUT_CLASS}>
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="vehPropiedad" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Propiedad del vehículo</label>
                      <select id="vehPropiedad" value={vehPropiedad} onChange={e => cambiarFactoresVehiculo(vehOficina, e.target.value as 'empresa' | 'empleado')} className={INPUT_CLASS}>
                        <option value="empresa">De la empresa</option>
                        <option value="empleado">Del empleado</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="vehPct" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        % uso personal <span className="normal-case font-normal">(sugerido {vehPctSugerido}%)</span>
                      </label>
                      <input id="vehPct" type="number" min="0" max="100" step="0.5" value={vehPct} onChange={e => setVehPct(e.target.value)} className={INPUT_CLASS} />
                    </div>
                  </div>
                  {previewVehiculo && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Base gravable:</span>
                      <span data-testid="vehiculo-preview" className="font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">
                        {formatRD(previewVehiculo.base)}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {previewVehiculo.excedenteVehiculo
                          ? '(100% — este empleado ya tiene un vehículo de la empresa menos costoso este mes)'
                          : `(${formatRD(num(vehValor))} × ${vehPctNum}%)`}
                      </span>
                      {previewVehiculo.otrosVehiculosEmpresa > 0 && !previewVehiculo.excedenteVehiculo && (
                        <span className="text-amber-600 dark:text-amber-400">
                          Este vehículo pasará a ser el menos costoso — el anterior se gravará al 100%.
                        </span>
                      )}
                    </div>
                  )}
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>Matriz de % sugerida — interpretación propia de Cielo Cloud, pendiente de confirmar con tu asesor
                      fiscal</strong> (no es la tabla oficial completa de la Guía DGII): 40% si el vehículo es de la empresa y el
                      empleado no es de oficina; 20% en cualquier otro caso. Ajusta el % a mano si tu contador indica otro. Si un
                      mismo empleado tiene varios vehículos de la empresa en el mes, solo el menos costoso recibe el %; los demás
                      se gravan al 100%.
                    </span>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!puedeAgregar}
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

        {/* ── Detector de diferenciales de interés (Art. 318) ─────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40">
                <HandCoins className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Préstamos a tasa preferencial (Art. 318)</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {tasaReferencia
                    ? `El interés no cobrado frente a la tasa de referencia (${tasaReferencia}% anual) es una retribución complementaria gravable.`
                    : 'Configura la tasa de referencia en Configuración → Reglas de Negocio primero.'}
                </p>
              </div>
            </div>
            {tasaReferencia ? (
              <button
                onClick={() => setMostrarDetector(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-[#1B2980]/30 dark:border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-[#1B2980] dark:text-indigo-300 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 transition-colors"
              >
                <HandCoins className="h-3.5 w-3.5" />
                {mostrarDetector ? 'Ocultar' : 'Detectar diferenciales de préstamos (Art. 318)'}
              </button>
            ) : (
              <Link
                href="/configuracion"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Ir a Configuración
              </Link>
            )}
          </div>

          {tasaReferencia && mostrarDetector && (
            <div className="border-t border-zinc-100 dark:border-[#1d2035]">
              {diferenciales.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Ningún préstamo activo está por debajo de la tasa de referencia en {MESES[mesSel - 1]} {anioSel}.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Saldo Pendiente</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tasa Préstamo</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Referencia</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Diferencial Mensual</th>
                          <th className="px-4 py-2.5 w-32" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                        {diferenciales.map(d => {
                          const emp = empMap[d.empleadoId]
                          const yaAgregado = prestamosYaAgregados.has(d.prestamoId)
                          return (
                            <tr key={d.prestamoId} data-testid={`diferencial-${d.prestamoId}`}>
                              <td className="px-5 py-3">
                                <p className="font-medium text-[#1B2980] dark:text-indigo-400">{emp ? fullName(emp) : d.empleadoId}</p>
                                {emp?.cedula && <p className="text-xs text-zinc-400">{emp.cedula}</p>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(d.saldoPendiente)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                                {fmtTasa(d.tasaMensualPrestamo)}% mens. <span className="text-zinc-400">({fmtTasa(d.tasaAnualPrestamo)}% anual)</span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{d.tasaReferenciaAnual}% anual</td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">{formatRD(d.diferencialMensual)}</td>
                              <td className="px-4 py-3 text-right">
                                {yaAgregado ? (
                                  <Badge variant="success">Ya agregada</Badge>
                                ) : (
                                  <button
                                    onClick={() => { agregarDiferencial(d); setToast('Diferencial de interés agregado') }}
                                    className="rounded-lg bg-[#1B2980] px-3 py-1 text-xs font-semibold text-white hover:bg-[#151f66] transition-colors"
                                  >
                                    Agregar
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-5 py-3">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-xl">
                      Diferencial = saldo pendiente × (referencia anual − tasa del préstamo × 12) ÷ 100 ÷ 12. La tasa de los
                      préstamos se registra mensual y se anualiza de forma nominal. Usa el saldo pendiente actual. Los avances de
                      salario no se evalúan (adelanto de un solo período, no una línea de crédito).
                    </p>
                    <button
                      onClick={agregarTodosDiferenciales}
                      disabled={diferencialesPendientes.length === 0}
                      className="rounded-lg bg-[#1B2980] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Agregar todas ({diferencialesPendientes.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Base Gravable</th>
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
                  const info = bases.get(l.id)
                  const desglose = textoDesglose(l, info)
                  return (
                    <tr key={l.id} data-testid={`linea-${l.id}`} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#1B2980] dark:text-indigo-400">{l.concepto}</p>
                          {l.prestamoId && <Badge variant="info">Art. 318</Badge>}
                          {info?.excedenteVehiculo && <Badge variant="warning">Vehículo adicional · 100%</Badge>}
                        </div>
                        {desglose && !l.prestamoId && (
                          <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{desglose}</p>
                        )}
                        {l.prestamoId && l.notas && (
                          <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{l.notas}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {emp ? fullName(emp) : <span className="text-zinc-300 dark:text-zinc-600">General / sin asignar</span>}
                      </td>
                      <td data-testid="base-gravable" className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(baseDe(l))}
                      </td>
                      <td data-testid="impuesto-linea" className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(baseDe(l) * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES)}
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

        {/* ── Acumulado por empleado ───────────────────────────────────── */}
        {acumuladoPorEmpleado.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-400" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Acumulado por Empleado</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Histórico completo — quién ha recibido beneficios en especie y cuánto, sin importar el mes
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Meses</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Conceptos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Histórico</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Impuesto Sustitutivo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {acumuladoPorEmpleado.map(g => {
                    const emp = g.empleadoId ? empMap[g.empleadoId] : undefined
                    return (
                      <tr key={g.empleadoId ?? '__general__'} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                        <td className="px-5 py-3.5">
                          {emp
                            ? <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(emp)}</p>
                            : <span className="text-zinc-400 dark:text-zinc-500">General / sin asignar</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-zinc-500 dark:text-zinc-400">{g.meses}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-zinc-500 dark:text-zinc-400">{g.conceptos}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-600 dark:text-zinc-400">
                          {formatRD(g.total)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                          {formatRD(g.total * TASA_IMPUESTO_SUSTITUTIVO_RETRIBUCIONES)}
                        </td>
                      </tr>
                    )
                  })}
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
