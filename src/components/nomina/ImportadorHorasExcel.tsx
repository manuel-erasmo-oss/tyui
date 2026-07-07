'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Download, Upload, CheckCircle2, XCircle, FileSpreadsheet,
  ArrowLeft, ArrowRight, PartyPopper, Loader2, Check, X, Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { fullName, formatCedula } from '@/lib/utils'
import type { AjusteLinea, ConceptoAjuste, Empleado } from '@/types'

interface Props {
  // Todos los empleados del sistema — se usa para distinguir "cédula no
  // encontrada" de "empleado encontrado pero no elegible en este período".
  empleados: Empleado[]
  // Empleados activos e incluidos en el período de nómina actualmente abierto
  // (empleadosEnNomina) — los únicos válidos como destino de un ajuste.
  empleadosElegibles: Empleado[]
  // Ajustes YA existentes del período, por empleado — se ANEXAN, nunca se
  // reemplazan (actualizarAjustes de usePeriodos() sobrescribe el array
  // completo, así que la anexión debe resolverse aquí, antes de llamar a esa
  // función en el componente que nos invoca).
  ajustesPorEmpleado: Record<string, AjusteLinea[]>
  onConfirmar: (nuevosAjustesPorEmpleado: Record<string, AjusteLinea[]>, totalAgregados: number) => void
  onClose: () => void
}

const ENCABEZADOS = ['Cédula', 'Concepto', 'Horas', 'Descripción'] as const

const CONCEPTOS_VALIDOS: { label: string; value: ConceptoAjuste }[] = [
  { label: 'H.E. 35%',         value: 'horas_extras_35' },
  { label: 'H.E. 100%',        value: 'horas_extras_100' },
  { label: 'Recargo Nocturno', value: 'recargo_nocturno' },
]

function labelConceptoHoras(c: ConceptoAjuste): string {
  return CONCEPTOS_VALIDOS.find(x => x.value === c)?.label ?? c
}

// Acepta la etiqueta amigable ("H.E. 35%"), el valor exacto de ConceptoAjuste
// ("horas_extras_35") o variantes comunes de escritura (mayúsculas, con/sin
// puntos, "35%" a secas, etc.)
function normalizarConcepto(v: unknown): ConceptoAjuste | null {
  const str = String(v ?? '').trim().toLowerCase()
  if (!str) return null
  const directo = CONCEPTOS_VALIDOS.find(c => c.label.toLowerCase() === str || c.value === str)
  if (directo) return directo.value
  const compacto = str.replace(/[.\s]/g, '')
  if (compacto === 'he35%' || compacto === 'he35' || compacto === '35%' || compacto === '35') return 'horas_extras_35'
  if (compacto === 'he100%' || compacto === 'he100' || compacto === '100%' || compacto === '100') return 'horas_extras_100'
  if (compacto.includes('nocturno')) return 'recargo_nocturno'
  return null
}

function celdaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

// Muchas cédulas dominicanas empiezan en "00…" — si Excel interpretó la
// columna como número (típico al escribir dígitos puros sin formatear la
// celda como Texto), esos ceros a la izquierda se pierden al guardar el
// archivo. Comparamos primero exacto y, si falla, comparamos ignorando
// ceros a la izquierda en ambos lados antes de descartar la fila.
function cedulasCoinciden(cedulaArchivo: string, cedulaEmpleado: string): boolean {
  const a = cedulaArchivo.replace(/\D/g, '')
  const b = cedulaEmpleado.replace(/\D/g, '')
  if (a === b) return true
  const aSinCeros = a.replace(/^0+/, '')
  const bSinCeros = b.replace(/^0+/, '')
  return aSinCeros !== '' && aSinCeros === bSinCeros
}

function parsearHoras(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
  if (isNaN(n)) return null
  return n
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

interface FilaHoras {
  fila: number // 1-indexed, referido a la fila del archivo (sin encabezado)
  cedulaRaw: string
  conceptoRaw: string
  descripcion: string
  concepto: ConceptoAjuste | null
  horas: number | null
  empleado?: Empleado
  error?: string
}

export function ImportadorHorasExcel({ empleados, empleadosElegibles, ajustesPorEmpleado, onConfirmar, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>('plantilla')
  const [filas, setFilas] = useState<FilaHoras[]>([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [importados, setImportados] = useState<{ ajustes: number; empleados: number }>({ ajustes: 0, empleados: 0 })

  function descargarPlantilla() {
    const wb = XLSX.utils.book_new()
    const wsData: (string | number)[][] = [
      [...ENCABEZADOS],
      ['000-0000000-0 (ejemplo — bórrame)', 'H.E. 35%', 5, 'Turno extendido lunes'],
      ['000-0000001-1 (ejemplo — bórrame)', 'H.E. 100%', 8, 'Feriado nacional'],
      ['000-0000000-0 (ejemplo — bórrame)', 'Recargo Nocturno', 20, ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [26, 18, 10, 30].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Horas Trabajadas')
    XLSX.writeFile(wb, 'plantilla-horas-trabajadas-cielo-cloud.xlsx')
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
        const wb = XLSX.read(data, { type: 'binary', cellDates: true })
        const primeraHoja = wb.SheetNames[0]
        if (!primeraHoja) throw new Error('El archivo no tiene hojas')
        const ws = wb.Sheets[primeraHoja]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })

        // Encuentra la fila de encabezados (la primera fila) y toma el resto como datos
        const dataRows = rows.slice(1)

        const parsed: FilaHoras[] = []
        dataRows.forEach((row, idx) => {
          const cedulaRaw    = celdaTexto(row[0])
          const conceptoRaw  = celdaTexto(row[1])
          const horasRaw     = row[2]
          const descripcion  = celdaTexto(row[3])

          const filaCompletamenteVacia =
            !cedulaRaw && !conceptoRaw && celdaTexto(horasRaw) === '' && !descripcion
          if (filaCompletamenteVacia) return

          const numFila = idx + 2 // +1 por header, +1 por 1-index

          const empleadoEncontrado = cedulaRaw
            ? empleados.find(e => cedulasCoinciden(cedulaRaw, e.cedula))
            : undefined
          const esElegible = empleadoEncontrado
            ? empleadosElegibles.some(e => e.id === empleadoEncontrado.id)
            : false

          const concepto = normalizarConcepto(conceptoRaw)
          const horas = parsearHoras(horasRaw)

          let error: string | undefined
          if (!cedulaRaw) {
            error = 'Cédula requerida'
          } else if (!empleadoEncontrado) {
            error = 'Cédula no corresponde a ningún empleado registrado'
          } else if (!esElegible) {
            error = empleadoEncontrado.activo === false
              ? 'Empleado inactivo — no se puede cargar en este período'
              : empleadoEncontrado.suspendido
                ? 'Empleado suspendido — no cobra nómina mientras dure la suspensión'
                : 'Empleado no incluido en el período de nómina actualmente abierto'
          }

          if (!error && !conceptoRaw) {
            error = 'Concepto requerido'
          } else if (!error && concepto === null) {
            error = 'Concepto inválido — use H.E. 35%, H.E. 100% o Recargo Nocturno'
          }

          if (!error && (horas === null || isNaN(horas))) {
            error = 'Horas requerido y debe ser un número'
          } else if (!error && horas !== null && horas <= 0) {
            error = 'Horas debe ser mayor a 0'
          }

          parsed.push({
            fila: numFila,
            cedulaRaw,
            conceptoRaw,
            descripcion,
            concepto,
            horas,
            empleado: empleadoEncontrado,
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

  const filasValidas   = filas.filter(f => !f.error)
  const filasConError  = filas.filter(f => f.error)

  function confirmarImportacion() {
    // Clona los ajustes ya existentes de cada empleado afectado y les ANEXA
    // las nuevas líneas — nunca reemplaza lo que ya había en el período
    // (préstamos, dependientes SFS, ajustes cargados a mano, etc.)
    const nuevosAjustesPorEmpleado: Record<string, AjusteLinea[]> = {}
    filasValidas.forEach((f, i) => {
      const empId = f.empleado!.id
      if (!nuevosAjustesPorEmpleado[empId]) {
        nuevosAjustesPorEmpleado[empId] = [...(ajustesPorEmpleado[empId] ?? [])]
      }
      const nuevaLinea: AjusteLinea = {
        id: `imp-horas-${Date.now().toString(36)}-${i}`,
        tipo: 'ingreso',
        concepto: f.concepto!,
        descripcion: f.descripcion || `Importado de Excel — fila ${f.fila}`,
        valor: f.horas!,
      }
      nuevosAjustesPorEmpleado[empId] = [...nuevosAjustesPorEmpleado[empId], nuevaLinea]
    })

    const totalEmpleados = Object.keys(nuevosAjustesPorEmpleado).length
    setImportados({ ajustes: filasValidas.length, empleados: totalEmpleados })
    onConfirmar(nuevosAjustesPorEmpleado, filasValidas.length)
    setPaso('exito')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)] space-y-6 animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-[#1B2980] dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Importar Horas Trabajadas</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Paso indicator */}
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
                  Contiene las columnas exactas que necesitamos, con filas de ejemplo. Bórralas antes de
                  llenar los datos reales. Cada fila carga horas extra o recargo nocturno a un empleado
                  específico dentro de este período — la cédula debe corresponder a un empleado activo
                  incluido en él.
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
                  Aceptamos .xlsx, .xls o .csv. Antes de aplicar ningún cambio te mostraremos una vista
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
                onClick={onClose}
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Se agregarán</p>
                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{filasValidas.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-[#252840]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-2.5 font-medium">Fila</th>
                    <th className="px-4 py-2.5 font-medium">Empleado</th>
                    <th className="px-4 py-2.5 font-medium">Concepto</th>
                    <th className="px-4 py-2.5 font-medium">Horas</th>
                    <th className="px-4 py-2.5 font-medium">Descripción</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-[#1a1d2e]">
                  {filas.map(f => (
                    <tr key={f.fila}>
                      <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{f.fila}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">
                          {f.empleado ? fullName(f.empleado) : (f.cedulaRaw || '—')}
                        </p>
                        {f.empleado && (
                          <p className="text-[11px] text-zinc-400">{formatCedula(f.empleado.cedula)}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {f.concepto ? (
                          <Badge variant="default">{labelConceptoHoras(f.concepto)}</Badge>
                        ) : (
                          <span className="text-zinc-400">{f.conceptoRaw || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 tabular-nums">{f.horas !== null ? f.horas : '—'}</td>
                      <td className="px-4 py-2.5 text-zinc-500 max-w-[16rem] truncate">{f.descripcion || '—'}</td>
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
                  onClick={onClose}
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
                  Confirmar Importación
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
              Se agregaron {importados.ajustes} ajuste{importados.ajustes === 1 ? '' : 's'} de horas a{' '}
              {importados.empleados} empleado{importados.empleados === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
              Las horas quedaron anexadas a los ajustes que ya tenía cada empleado en este período —
              ningún préstamo, dependiente SFS u otro ajuste previo se vio afectado.
            </p>
            <button
              onClick={onClose}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-[#1B2980]/25 transition-all"
            >
              Volver a Nómina
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
