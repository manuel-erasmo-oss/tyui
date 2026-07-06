'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Download, Upload, CheckCircle2, XCircle, FileSpreadsheet,
  ArrowLeft, ArrowRight, PartyPopper, Loader2, Check,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useAumentos } from '@/lib/aumentos-context'
import { useAuth } from '@/lib/auth-context'
import { formatRD, fullName } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

interface Props {
  onFinish: () => void
}

// Cada fila debe llenar EXACTAMENTE UNA de las dos columnas de ajuste — nunca
// ambas, nunca ninguna. "Nuevo Salario" fija el salario final directo;
// "% de Aumento" lo calcula sobre el salario actual del empleado.
const ENCABEZADOS = ['Cédula', 'Nuevo Salario (RD$)', '% de Aumento', 'Motivo'] as const

interface FilaImportacion {
  fila: number // 1-indexed, referido a la fila del archivo (sin encabezado)
  cedula: string
  nombreEmpleado?: string
  empleadoId?: string
  salarioAnterior?: number
  salarioNuevo?: number
  tipoAjuste?: 'porcentaje' | 'fijo'
  valorAjuste?: number
  motivo: string
  error?: string
}

type Paso = 'plantilla' | 'subir' | 'previa' | 'exito'

const PASOS: { key: Exclude<Paso, 'exito'>; label: string }[] = [
  { key: 'plantilla', label: 'Plantilla' },
  { key: 'subir', label: 'Subir archivo' },
  { key: 'previa', label: 'Confirmar' },
]

function PasoIndicador({ actual }: { actual: Paso }) {
  const idx = PASOS.findIndex(p => p.key === actual)
  return (
    <div className="flex items-center">
      {PASOS.map((p, i) => (
        <div key={p.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < idx
                  ? 'bg-emerald-500 text-white'
                  : i === idx
                    ? 'bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-md shadow-[#1B2980]/30'
                    : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-600'
              }`}
            >
              {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap ${i === idx ? 'text-[#1B2980] dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {p.label}
            </span>
          </div>
          {i < PASOS.length - 1 && (
            <div className={`mx-2 mb-4 h-px w-10 sm:w-16 ${i < idx ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-[#252840]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function celdaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function parsearNumeroOpcional(v: unknown): { ok: boolean; valor: number | null } {
  if (v === null || v === undefined || v === '') return { ok: true, valor: null }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
  if (isNaN(n)) return { ok: false, valor: null }
  return { ok: true, valor: n }
}

export function ImportadorAumentosExcel({ onFinish }: Props) {
  const { empleadosActivos } = useEmpleados()
  const { solicitar, getPendientes } = useAumentos()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>('plantilla')
  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [enviados, setEnviados] = useState(0)

  function descargarPlantilla() {
    const wb = XLSX.utils.book_new()
    const wsData: (string | number | null)[][] = [
      [...ENCABEZADOS],
      ['000-0000000-0 (ejemplo — bórrame)', 40000, '', 'Ajuste anual por desempeño'],
      ['000-0000001-1 (ejemplo — bórrame)', '', 8, 'Revisión de mercado — puesto de Ventas'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [20, 18, 16, 32].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Aumentos')
    XLSX.writeFile(wb, 'plantilla-aumentos-cielo-cloud.xlsx')
  }

  function resetArchivo() {
    setFilas([])
    setArchivoNombre('')
    setErrorArchivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorArchivo(null)
    setArchivoNombre(file.name)
    setProcesando(true)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) throw new Error('No se pudo leer el archivo')
        const wb = XLSX.read(data, { type: 'binary' })
        const primeraHoja = wb.SheetNames[0]
        if (!primeraHoja) throw new Error('El archivo no tiene hojas')
        const ws = wb.Sheets[primeraHoja]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
        const dataRows = rows.slice(1)

        const pendientesActuales = getPendientes()
        const parsed: FilaImportacion[] = []

        dataRows.forEach((row, idx) => {
          const cedulaRaw = celdaTexto(row[0])
          const salarioRaw = row[1]
          const pctRaw = row[2]
          const motivoRaw = celdaTexto(row[3])

          const filaCompletamenteVacia =
            !cedulaRaw && celdaTexto(salarioRaw) === '' && celdaTexto(pctRaw) === '' && !motivoRaw
          if (filaCompletamenteVacia) return

          const numFila = idx + 2 // +1 por header, +1 por 1-index
          const salario = parsearNumeroOpcional(salarioRaw)
          const pct = parsearNumeroOpcional(pctRaw)

          let error: string | undefined
          let empleadoId: string | undefined
          let nombreEmpleado: string | undefined
          let salarioAnterior: number | undefined
          let salarioNuevo: number | undefined
          let tipoAjuste: 'porcentaje' | 'fijo' | undefined
          let valorAjuste: number | undefined

          const existente = cedulaRaw
            ? empleadosActivos.find(e => e.cedula.trim().toLowerCase() === cedulaRaw.toLowerCase())
            : undefined

          if (!cedulaRaw) {
            error = 'Cédula requerida'
          } else if (!existente) {
            error = 'No se encontró un empleado activo con esta cédula'
          } else if (!salario.ok || !pct.ok) {
            error = 'Nuevo Salario / % de Aumento debe ser un número'
          } else if (salario.valor === null && pct.valor === null) {
            error = 'Debe llenar Nuevo Salario o % de Aumento'
          } else if (salario.valor !== null && pct.valor !== null) {
            error = 'Solo debe llenar una columna: Nuevo Salario o % de Aumento'
          } else if (!motivoRaw) {
            error = 'Motivo requerido'
          } else if (pendientesActuales.some(p => p.empleadoId === existente.id)) {
            error = 'Ya existe una solicitud pendiente de aprobación para este empleado'
          } else {
            empleadoId = existente.id
            nombreEmpleado = fullName(existente)
            salarioAnterior = existente.salarioBase
            if (salario.valor !== null) {
              if (salario.valor <= existente.salarioBase) {
                error = `El nuevo salario debe ser mayor al actual (${formatRD(existente.salarioBase, 0)})`
              } else {
                tipoAjuste = 'fijo'
                salarioNuevo = Math.round(salario.valor)
                valorAjuste = Math.round(salario.valor - existente.salarioBase)
              }
            } else if (pct.valor !== null) {
              if (pct.valor <= 0) {
                error = 'El % de Aumento debe ser mayor a 0'
              } else {
                tipoAjuste = 'porcentaje'
                valorAjuste = pct.valor
                salarioNuevo = Math.round(existente.salarioBase * (1 + pct.valor / 100))
              }
            }
          }

          parsed.push({
            fila: numFila,
            cedula: cedulaRaw,
            nombreEmpleado,
            empleadoId,
            salarioAnterior,
            salarioNuevo,
            tipoAjuste,
            valorAjuste,
            motivo: motivoRaw,
            error,
          })
        })

        setFilas(parsed)
        setPaso('previa')
      } catch {
        setErrorArchivo('No se pudo leer el archivo. Verifica que sea un .xlsx, .xls o .csv válido.')
      } finally {
        setProcesando(false)
      }
    }
    reader.onerror = () => {
      setErrorArchivo('No se pudo leer el archivo.')
      setProcesando(false)
    }
    reader.readAsBinaryString(file)
  }

  const filasValidas = filas.filter(f => !f.error)
  const filasConError = filas.filter(f => f.error)

  function confirmarImportacion() {
    for (const f of filasValidas) {
      if (!f.empleadoId || !f.salarioAnterior || !f.salarioNuevo || !f.tipoAjuste || f.valorAjuste === undefined) continue
      solicitar({
        empleadoId: f.empleadoId,
        salarioAnterior: f.salarioAnterior,
        salarioNuevo: f.salarioNuevo,
        tipoAjuste: f.tipoAjuste,
        valorAjuste: f.valorAjuste,
        motivo: f.motivo,
        solicitadoPor: user?.email ?? undefined,
        origen: 'importacion_excel',
      })
    }
    setEnviados(filasValidas.length)
    setPaso('exito')
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)] space-y-6">

      {paso !== 'exito' && (
        <div className="flex justify-center border-b border-zinc-100 dark:border-[#1d2035] pb-6">
          <PasoIndicador actual={paso} />
        </div>
      )}

      {/* PASO 1: Descargar plantilla */}
      {paso === 'plantilla' && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-lg" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Descarga la plantilla Excel</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                Llena por cédula solo UNA de las dos columnas de ajuste: &quot;Nuevo Salario (RD$)&quot;
                para fijar el salario final directo, o &quot;% de Aumento&quot; para calcularlo sobre el
                salario actual del empleado. El Motivo es obligatorio. Cada fila válida queda registrada
                como una solicitud <strong>pendiente de aprobación</strong> — ningún salario cambia todavía.
              </p>
            </div>
          </div>

          <button
            onClick={descargarPlantilla}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-[#1B2980]/25 transition-all"
          >
            <Download className="h-4 w-4" />
            Descargar Plantilla Excel
          </button>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPaso('subir')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
            >
              Ya tengo mi archivo listo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Subir archivo */}
      {paso === 'subir' && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-lg dark:bg-indigo-500/25" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
                <Upload className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Sube tu archivo lleno</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                Aceptamos .xlsx, .xls o .csv. Antes de enviar ninguna solicitud te mostraremos una vista
                previa fila por fila para que confirmes.
              </p>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-[#252840] px-6 py-10 text-center cursor-pointer hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleArchivo}
            />
            {procesando ? (
              <Loader2 className="h-6 w-6 text-[#1B2980] dark:text-indigo-400 animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-zinc-400" />
            )}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {archivoNombre || 'Haz clic para seleccionar un archivo, o arrástralo aquí'}
            </p>
            <p className="text-xs text-zinc-400">.xlsx, .xls o .csv</p>
          </label>

          {errorArchivo && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs px-3 py-2">
              <XCircle className="h-4 w-4 shrink-0" />
              {errorArchivo}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setPaso('plantilla')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </button>
            <button
              onClick={onFinish}
              className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Vista previa y confirmación */}
      {paso === 'previa' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-[#1d2035] rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-zinc-50/60 dark:bg-[#1a1d2e]/40 overflow-hidden">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Filas válidas</p>
              <p className="mt-1 text-xl font-bold text-[#1B2980] dark:text-indigo-400 tabular-nums">{filasValidas.length}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Con errores</p>
              <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{filasConError.length}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Se enviarán a aprobación</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{filasValidas.length}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-[#252840]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Fila</th>
                  <th className="px-4 py-2.5 font-medium">Empleado</th>
                  <th className="px-4 py-2.5 font-medium">Ajuste</th>
                  <th className="px-4 py-2.5 font-medium text-right">Salario Actual</th>
                  <th className="px-4 py-2.5 font-medium text-right">Salario Nuevo</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#1a1d2e]">
                {filas.map(f => (
                  <tr key={f.fila}>
                    <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{f.fila}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[#1B2980] dark:text-indigo-400">
                        {f.nombreEmpleado ?? (f.cedula || '—')}
                      </p>
                      {f.nombreEmpleado && <p className="text-[11px] text-zinc-400">{f.cedula}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.tipoAjuste ? (
                        <Badge variant="info">
                          {f.tipoAjuste === 'porcentaje' ? `+${f.valorAjuste}%` : `+${formatRD(f.valorAjuste ?? 0, 0)}`}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-500 tabular-nums">
                      {f.salarioAnterior !== undefined ? formatRD(f.salarioAnterior, 0) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#151f66] dark:text-indigo-300 tabular-nums">
                      {f.salarioNuevo !== undefined ? formatRD(f.salarioNuevo, 0) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.error ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                          <XCircle className="h-3.5 w-3.5 shrink-0" /> {f.error}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-zinc-400">
                      No se encontraron filas con datos en el archivo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => { resetArchivo(); setPaso('subir') }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Subir otro archivo
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onFinish}
                className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={filasValidas.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-[#1B2980]/25 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                Enviar a Aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Éxito */}
      {paso === 'exito' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
              <PartyPopper className="h-7 w-7" />
            </div>
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
            Se enviaron {enviados} solicitud{enviados === 1 ? '' : 'es'} de aumento a aprobación
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            Ningún salario ha cambiado todavía — revisa y aprueba cada solicitud en
            &quot;Aumentos Pendientes de Aprobación&quot; para que se apliquen a nómina.
          </p>
          <button
            onClick={() => { resetArchivo(); onFinish() }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-[#1B2980]/25 transition-all"
          >
            Volver
          </button>
        </div>
      )}
    </div>
  )
}
