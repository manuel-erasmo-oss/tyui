'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Download, Upload, CheckCircle2, XCircle, FileSpreadsheet,
  ArrowLeft, ArrowRight, PartyPopper, Loader2,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { getCategoriaSRLPorSector } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Empleado } from '@/types'

interface Props {
  onFinish: () => void
}

const ENCABEZADOS = [
  'Cédula',
  'Nombre',
  'Apellido',
  'Cargo',
  'Departamento',
  'Fecha de Ingreso',
  'Salario Base',
  'Vacaciones Pendientes (días)',
  'Regalía Pagada Este Año (RD$)',
  'Salario Histórico de Referencia (RD$)',
] as const

type Accion = 'crear' | 'actualizar'

interface FilaImportacion {
  fila: number // 1-indexed, referido a la fila del archivo (sin encabezado)
  cedula: string
  nombre: string
  apellido: string
  cargo: string
  departamento: string
  fechaIngreso: string
  salarioBase: number | null
  saldoVacacionesInicial: number | null
  regaliaPagadaEsteAnio: number | null
  salarioHistoricoReferencia: number | null
  accion: Accion
  empleadoExistenteId?: string
  error?: string
}

type Paso = 'plantilla' | 'subir' | 'previa' | 'exito'

function celdaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

// Acepta fechas ya parseadas por xlsx (Date), números seriales de Excel, o texto YYYY-MM-DD
function parsearFecha(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    // Excel serial date
    const parsed = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(v) : null
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
    return null
  }
  const str = String(v).trim()
  if (!str) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (match) {
    const d = new Date(str)
    if (!isNaN(d.getTime())) return `${match[1]}-${match[2]}-${match[3]}`
    return null
  }
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return null
}

function parsearNumeroOpcional(v: unknown): { ok: boolean; valor: number | null } {
  if (v === null || v === undefined || v === '') return { ok: true, valor: null }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
  if (isNaN(n)) return { ok: false, valor: null }
  if (n < 0) return { ok: false, valor: null }
  return { ok: true, valor: n }
}

export function ImportadorExcel({ onFinish }: Props) {
  const { empleados, add, update } = useEmpleados()
  const { empresa } = useEmpresa()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>('plantilla')
  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [importados, setImportados] = useState(0)

  function descargarPlantilla() {
    const wb = XLSX.utils.book_new()
    const wsData: (string | number | null)[][] = [
      [...ENCABEZADOS],
      [
        '000-0000000-0 (ejemplo — bórrame)', 'Juana', 'Pérez', 'Analista de Contabilidad', 'Contabilidad',
        '2019-03-15', 35000, 14, 0, 32000,
      ],
      [
        '000-0000001-1 (ejemplo — bórrame)', 'Carlos', 'Ramírez', 'Supervisor de Bodega', 'Almacén',
        '2022-08-01', 28000, 7, 5000, '',
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [16, 16, 16, 24, 18, 16, 14, 16, 20, 22].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Saldos Iniciales')
    XLSX.writeFile(wb, 'plantilla-carga-inicial-cielo-cloud.xlsx')
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

        // Encuentra la fila de encabezados (la primera fila no vacía) y toma el resto como datos
        const dataRows = rows.slice(1)

        const parsed: FilaImportacion[] = []
        dataRows.forEach((row, idx) => {
          const cedulaRaw = celdaTexto(row[0])
          const nombreRaw = celdaTexto(row[1])
          const apellidoRaw = celdaTexto(row[2])
          const cargoRaw = celdaTexto(row[3])
          const departamentoRaw = celdaTexto(row[4])
          const fechaRaw = row[5]
          const salarioRaw = row[6]
          const vacacionesRaw = row[7]
          const regaliaRaw = row[8]
          const salarioHistRaw = row[9]

          const filaCompletamenteVacia =
            !cedulaRaw && !nombreRaw && !apellidoRaw && !cargoRaw && !departamentoRaw &&
            celdaTexto(fechaRaw) === '' && celdaTexto(salarioRaw) === '' &&
            celdaTexto(vacacionesRaw) === '' && celdaTexto(regaliaRaw) === '' && celdaTexto(salarioHistRaw) === ''
          if (filaCompletamenteVacia) return

          const numFila = idx + 2 // +1 por header, +1 por 1-index
          const existente = cedulaRaw
            ? empleados.find(emp => emp.cedula.trim().toLowerCase() === cedulaRaw.toLowerCase())
            : undefined
          const accion: Accion = existente ? 'actualizar' : 'crear'

          const fechaIngreso = parsearFecha(fechaRaw)
          const salarioNum = salarioRaw === '' || salarioRaw === null || salarioRaw === undefined
            ? null
            : (typeof salarioRaw === 'number' ? salarioRaw : Number(String(salarioRaw).replace(/[, ]/g, '')))
          const vac = parsearNumeroOpcional(vacacionesRaw)
          const reg = parsearNumeroOpcional(regaliaRaw)
          const histRef = parsearNumeroOpcional(salarioHistRaw)

          let error: string | undefined

          if (!cedulaRaw) {
            error = 'Cédula requerida'
          } else if (accion === 'crear') {
            if (!nombreRaw) error = 'Nombre requerido para crear un empleado nuevo'
            else if (!apellidoRaw) error = 'Apellido requerido para crear un empleado nuevo'
            else if (!cargoRaw) error = 'Cargo requerido para crear un empleado nuevo'
            else if (!departamentoRaw) error = 'Departamento requerido para crear un empleado nuevo'
            else if (!fechaIngreso) error = 'Fecha de Ingreso inválida (use YYYY-MM-DD)'
            else if (salarioNum === null || isNaN(salarioNum) || salarioNum <= 0) error = 'Salario Base debe ser mayor a 0'
          }

          if (!error && !vac.ok) error = 'Vacaciones Pendientes debe ser un número mayor o igual a 0'
          if (!error && !reg.ok) error = 'Regalía Pagada debe ser un número mayor o igual a 0'
          if (!error && !histRef.ok) error = 'Salario Histórico de Referencia debe ser un número mayor o igual a 0'

          parsed.push({
            fila: numFila,
            cedula: cedulaRaw,
            nombre: nombreRaw,
            apellido: apellidoRaw,
            cargo: cargoRaw,
            departamento: departamentoRaw,
            fechaIngreso: fechaIngreso ?? '',
            salarioBase: salarioNum !== null && !isNaN(salarioNum) ? salarioNum : null,
            saldoVacacionesInicial: vac.valor,
            regaliaPagadaEsteAnio: reg.valor,
            salarioHistoricoReferencia: histRef.valor,
            accion,
            empleadoExistenteId: existente?.id,
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
      if (f.accion === 'actualizar' && f.empleadoExistenteId) {
        const cambios: Partial<Empleado> = { saldosInicialesRevisado: true }
        if (f.saldoVacacionesInicial !== null) cambios.saldoVacacionesInicial = f.saldoVacacionesInicial
        if (f.regaliaPagadaEsteAnio !== null) cambios.regaliaPagadaEsteAnio = f.regaliaPagadaEsteAnio
        if (f.salarioHistoricoReferencia !== null) cambios.salarioHistoricoReferencia = f.salarioHistoricoReferencia
        update(f.empleadoExistenteId, cambios)
      } else {
        const nuevo: Omit<Empleado, 'id'> = {
          nombre: f.nombre.trim(),
          apellido: f.apellido.trim(),
          cedula: f.cedula.trim(),
          tipoDocumento: 'cedula',
          cargo: f.cargo.trim(),
          departamento: f.departamento.trim(),
          fechaIngreso: f.fechaIngreso,
          salarioBase: f.salarioBase ?? 0,
          tipoContrato: 'fijo',
          activo: true,
          categoriaRiesgo: getCategoriaSRLPorSector(empresa.sectorEmpresa),
          saldoVacacionesInicial: f.saldoVacacionesInicial ?? undefined,
          regaliaPagadaEsteAnio: f.regaliaPagadaEsteAnio ?? undefined,
          salarioHistoricoReferencia: f.salarioHistoricoReferencia ?? undefined,
          saldosInicialesRevisado: true,
        }
        add(nuevo)
      }
    }
    setImportados(filasValidas.length)
    setPaso('exito')
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 space-y-5">

      {/* Paso indicator */}
      {paso !== 'exito' && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          {(['plantilla', 'subir', 'previa'] as Paso[]).map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
              <span className={paso === p ? 'font-semibold text-[#1B2980] dark:text-indigo-400' : ''}>
                {i + 1}. {p === 'plantilla' ? 'Descargar plantilla' : p === 'subir' ? 'Subir archivo' : 'Vista previa'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PASO 1: Descargar plantilla */}
      {paso === 'plantilla' && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Descarga la plantilla Excel</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                Contiene las columnas exactas que necesitamos, con 2 filas de ejemplo. Bórralas antes de
                llenar los datos reales de tus empleados. Si la cédula de una fila ya existe en el
                sistema, solo se actualizarán sus saldos iniciales — si no existe, se creará un empleado
                nuevo con los datos de esa fila.
              </p>
            </div>
          </div>

          <button
            onClick={descargarPlantilla}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B2980] hover:bg-[#151f66] text-white text-sm font-medium px-4 py-2.5 transition-colors"
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sube tu archivo lleno</p>
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
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#eef0fb] dark:bg-indigo-950/30 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Filas válidas</p>
              <p className="text-lg font-semibold text-[#1B2980] dark:text-indigo-400 tabular-nums">{filasValidas.length}</p>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Con errores</p>
              <p className="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{filasConError.length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Se importarán</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{filasValidas.length} empleados</p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {filasValidas.length} fila{filasValidas.length === 1 ? '' : 's'} válida{filasValidas.length === 1 ? '' : 's'}, {filasConError.length} con error{filasConError.length === 1 ? '' : 'es'}, se importarán {filasValidas.length} empleados.
          </p>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-[#252840]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Fila</th>
                  <th className="px-4 py-2.5 font-medium">Empleado</th>
                  <th className="px-4 py-2.5 font-medium">Acción</th>
                  <th className="px-4 py-2.5 font-medium">Vacaciones</th>
                  <th className="px-4 py-2.5 font-medium">Regalía Pagada</th>
                  <th className="px-4 py-2.5 font-medium">Salario Histórico</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#1a1d2e]">
                {filas.map(f => (
                  <tr key={f.fila}>
                    <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{f.fila}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[#1B2980] dark:text-indigo-400">
                        {f.nombre || f.apellido ? `${f.nombre} ${f.apellido}`.trim() : (f.cedula || '—')}
                      </p>
                      {(f.nombre || f.apellido) && f.cedula && (
                        <p className="text-[11px] text-zinc-400">{f.cedula}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={f.accion === 'crear' ? 'info' : 'default'}>
                        {f.accion === 'crear' ? 'Crear empleado nuevo' : 'Actualizar saldos'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 tabular-nums">{f.saldoVacacionesInicial ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500 tabular-nums">{f.regaliaPagadaEsteAnio !== null ? formatRD(f.regaliaPagadaEsteAnio) : '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500 tabular-nums">{f.salarioHistoricoReferencia !== null ? formatRD(f.salarioHistoricoReferencia) : '—'}</td>
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
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-zinc-400">
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 transition-colors"
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <PartyPopper className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Se importaron/actualizaron {importados} empleado{importados === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            Los saldos iniciales ya quedaron guardados. Puedes revisarlos en la ficha de cada empleado.
          </p>
          <button
            onClick={() => { resetArchivo(); onFinish() }}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#1B2980] hover:bg-[#151f66] text-white text-sm font-medium px-4 py-2.5 transition-colors"
          >
            Volver
          </button>
        </div>
      )}
    </div>
  )
}
