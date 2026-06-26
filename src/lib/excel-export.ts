'use client'
import * as XLSX from 'xlsx'

export interface ExcelHoja {
  nombre: string          // sheet tab name
  titulo: string          // report title on sheet
  subtitulo?: string      // e.g. "Período: Junio 2026"
  encabezados: string[]
  filas: (string | number | null)[][]
  totales?: (string | number | null)[]   // bold totals row at bottom
  anchos?: number[]                      // column widths in chars
}

export interface OpcionesExcel {
  nombreArchivo: string   // without .xlsx extension
  empresa: string
  rnc?: string
  hojas: ExcelHoja[]
}

export function exportarExcel(opciones: OpcionesExcel): void {
  const wb = XLSX.utils.book_new()

  for (const hoja of opciones.hojas) {
    const wsData: (string | number | null)[][] = []

    // Row 0: company name
    wsData.push([opciones.empresa + (opciones.rnc ? ` | RNC: ${opciones.rnc}` : ''), ...Array(hoja.encabezados.length - 1).fill(null)])
    // Row 1: report title
    wsData.push([hoja.titulo, ...Array(hoja.encabezados.length - 1).fill(null)])
    // Row 2: subtitle or date
    wsData.push([hoja.subtitulo ?? `Generado: ${new Date().toLocaleDateString('es-DO')}`, ...Array(hoja.encabezados.length - 1).fill(null)])
    // Row 3: blank
    wsData.push(Array(hoja.encabezados.length).fill(null))
    // Row 4: headers
    wsData.push(hoja.encabezados)
    // Rows 5+: data
    for (const fila of hoja.filas) wsData.push(fila)
    // Totals row
    if (hoja.totales) wsData.push(hoja.totales)

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = (hoja.anchos ?? hoja.encabezados.map(() => 18)).map(w => ({ wch: w }))

    // Merge company/title rows across all columns
    const lastCol = hoja.encabezados.length - 1
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre.slice(0, 31))
  }

  XLSX.writeFile(wb, `${opciones.nombreArchivo}.xlsx`)
}
