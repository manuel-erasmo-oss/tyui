'use client'
import ExcelJS from 'exceljs'

export interface ExcelHoja {
  nombre: string          // sheet tab name
  titulo: string          // report title on sheet
  subtitulo?: string      // e.g. "Período: Junio 2026"
  encabezados: string[]
  filas: (string | number | null)[][]
  totales?: (string | number | null)[]   // bold totals row at bottom
  anchos?: number[]                      // column widths in chars
  // Índices (0-based) de columnas numéricas que deben mostrarse como enteros
  // sin decimales (conteos, días, cuotas) en vez del formato de moneda por
  // defecto (#,##0.00) que se aplica automáticamente a cualquier celda numérica.
  columnasEnteras?: number[]
}

export interface OpcionesExcel {
  nombreArchivo: string   // without .xlsx extension
  empresa: string
  rnc?: string
  hojas: ExcelHoja[]
}

// Paleta — mismos tokens de marca que el resto de la app (ver CLAUDE.md:
// Brand navy #1B2980). ARGB requiere el canal alfa (FF = opaco).
const NAVY       = 'FF1B2980'
const NAVY_DARK  = 'FF151F66'
const BRAND_LIGHT = 'FFEEF0FB'
const ZEBRA      = 'FFF7F8FC'
const BORDER     = 'FFD4D4D8'
const TEXTO_GRIS = 'FF71717A'
const TEXTO_OSCURO = 'FF18181B'

function bordeFino() {
  const estilo = { style: 'thin' as const, color: { argb: BORDER } }
  return { top: estilo, left: estilo, bottom: estilo, right: estilo }
}

// Genera un único libro de Excel con estilo (encabezado con color de marca,
// bordes, franjas alternas, formato de moneda automático en columnas
// numéricas, fila congelada y autofiltro) y dispara la descarga en el
// navegador. Firma pública sin cambios respecto a la versión anterior
// (basada en SheetJS) — los ~15 call-sites existentes en Reportería siguen
// funcionando sin modificaciones.
export async function exportarExcel(opciones: OpcionesExcel): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cielo Cloud'
  wb.created = new Date()

  for (const hoja of opciones.hojas) {
    const numCols = Math.max(hoja.encabezados.length, 1)
    const ws = wb.addWorksheet(hoja.nombre.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    })
    ws.columns = (hoja.anchos ?? hoja.encabezados.map(() => 18)).map(w => ({ width: w }))

    // Fila 1 — empresa
    const filaEmpresa = ws.addRow([opciones.empresa + (opciones.rnc ? ` | RNC: ${opciones.rnc}` : '')])
    ws.mergeCells(1, 1, 1, numCols)
    filaEmpresa.font = { bold: true, size: 11, color: { argb: NAVY } }
    filaEmpresa.height = 18

    // Fila 2 — título del reporte
    const filaTitulo = ws.addRow([hoja.titulo])
    ws.mergeCells(2, 1, 2, numCols)
    filaTitulo.font = { bold: true, size: 15, color: { argb: TEXTO_OSCURO } }
    filaTitulo.height = 24

    // Fila 3 — subtítulo o fecha de generación
    const filaSub = ws.addRow([hoja.subtitulo ?? `Generado: ${new Date().toLocaleDateString('es-DO')}`])
    ws.mergeCells(3, 1, 3, numCols)
    filaSub.font = { italic: true, size: 10, color: { argb: TEXTO_GRIS } }

    // Fila 4 — en blanco
    ws.addRow([])

    // Fila 5 — encabezados de columna
    const filaHead = ws.addRow(hoja.encabezados)
    filaHead.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = bordeFino()
    })
    filaHead.height = 26

    // Filas de datos
    const enteras = new Set(hoja.columnasEnteras ?? [])
    hoja.filas.forEach((filaDatos, i) => {
      const row = ws.addRow(filaDatos)
      const esZebra = i % 2 === 1
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = bordeFino()
        if (esZebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
        if (typeof cell.value === 'number') {
          cell.numFmt = enteras.has(colNumber - 1) ? '#,##0' : '#,##0.00'
          cell.alignment = { horizontal: 'right' }
        } else {
          cell.alignment = { horizontal: 'left', wrapText: false }
        }
      })
    })

    // Fila de totales — negrita, fondo brand-light, filo superior doble navy
    if (hoja.totales) {
      const row = ws.addRow(hoja.totales)
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { bold: true, color: { argb: NAVY_DARK } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } }
        cell.border = { ...bordeFino(), top: { style: 'double', color: { argb: NAVY } } }
        if (typeof cell.value === 'number') {
          cell.numFmt = enteras.has(colNumber - 1) ? '#,##0' : '#,##0.00'
          cell.alignment = { horizontal: 'right' }
        }
      })
    }

    // Autofiltro sobre el encabezado — solo si hay datos que filtrar
    if (hoja.filas.length > 0) {
      ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: numCols } }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${opciones.nombreArchivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
