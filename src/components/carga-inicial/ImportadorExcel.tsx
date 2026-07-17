'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Download, Upload, CheckCircle2, XCircle, FileSpreadsheet,
  ArrowLeft, ArrowRight, PartyPopper, Loader2, Check,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import { getCategoriaSRLPorSector } from '@/lib/dominican-labor'
import { DOC_TIPOS, PAISES, BANCOS, TIPO_CONTRATO_OPTIONS } from '@/lib/empleado-form'
import { formatRD } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Empleado, TipoDocumento, TipoContrato, Banco } from '@/types'

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
  // ─── Identidad y contacto (opcionales, salvo default para empleados nuevos) ─
  'Tipo de Documento',
  'Nacionalidad',
  'Fecha de Nacimiento',
  'Tipo de Contrato',
  'Correo Electrónico',
  'Teléfono',
  'Banco',
  'Número de Cuenta',
  'Régimen Intermitente (Sí/No)',
  // ─── Migración (saldos/créditos previos a Cielo Cloud) ─────────────────────
  'Vacaciones Pendientes (días)',
  'Regalía Pagada Este Año (RD$)',
  'Salario Histórico de Referencia (RD$)',
  'Saldo ISR a Favor (RD$)',
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
  // ─── Identidad y contacto — null significa "no cambiar" (actualizar) o
  // "usar el default" (crear), ver confirmarImportacion() ────────────────────
  tipoDocumento: TipoDocumento | null
  nacionalidad: string | null
  fechaNacimiento: string | null
  tipoContrato: TipoContrato | null
  email: string | null
  telefono: string | null
  banco: Banco | null
  numeroCuenta: string | null
  regimenIntermitente: boolean | null
  saldoVacacionesInicial: number | null
  regaliaPagadaEsteAnio: number | null
  salarioHistoricoReferencia: number | null
  // No es un campo de Empleado — crea un SaldoISRFavor real vía
  // registrarSaldoISR() al confirmar, igual que registrarlo desde la ficha
  // del empleado (ver comentario en confirmarImportacion).
  saldoISRFavor: number | null
  accion: Accion
  empleadoExistenteId?: string
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

// Quita acentos y normaliza mayúsculas/espacios — para aceptar tanto el
// valor exacto en inglés (ej. "cedula") como la etiqueta en español que ve
// el usuario (ej. "Cédula") en las columnas de catálogo del Excel.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function parsearTipoDocumento(v: unknown): { ok: boolean; valor: TipoDocumento | null } {
  const s = celdaTexto(v)
  if (!s) return { ok: true, valor: null }
  const norm = normalizar(s)
  const match = DOC_TIPOS.find(d => normalizar(d.label) === norm || d.value === norm)
  return match ? { ok: true, valor: match.value } : { ok: false, valor: null }
}

// Acepta el código ISO (ej. "DO") o el nombre en español (ej. "República Dominicana")
function parsearNacionalidad(v: unknown): { ok: boolean; valor: string | null } {
  const s = celdaTexto(v)
  if (!s) return { ok: true, valor: null }
  const norm = normalizar(s)
  const match = PAISES.find(p => p.code.toLowerCase() === norm || normalizar(p.nombre) === norm)
  return match ? { ok: true, valor: match.code } : { ok: false, valor: null }
}

function parsearTipoContrato(v: unknown): { ok: boolean; valor: TipoContrato | null } {
  const s = celdaTexto(v)
  if (!s) return { ok: true, valor: null }
  const norm = normalizar(s)
  const match = TIPO_CONTRATO_OPTIONS.find(t => normalizar(t.label) === norm || t.value === norm)
  return match ? { ok: true, valor: match.value } : { ok: false, valor: null }
}

function parsearBanco(v: unknown): { ok: boolean; valor: Banco | null } {
  const s = celdaTexto(v)
  if (!s) return { ok: true, valor: null }
  const norm = normalizar(s)
  const match = BANCOS.find(b => normalizar(b) === norm)
  return match ? { ok: true, valor: match } : { ok: false, valor: null }
}

function parsearBooleanoSiNo(v: unknown): { ok: boolean; valor: boolean | null } {
  const s = celdaTexto(v)
  if (!s) return { ok: true, valor: null }
  const norm = normalizar(s)
  if (['si', 'sí', 'true', '1', 'x'].includes(norm)) return { ok: true, valor: true }
  if (['no', 'false', '0'].includes(norm)) return { ok: true, valor: false }
  return { ok: false, valor: null }
}

export function ImportadorExcel({ onFinish }: Props) {
  const { empleados, add, update } = useEmpleados()
  const { empresa } = useEmpresa()
  const { registrar: registrarSaldoISR } = useSaldoISR()
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
        '2019-03-15', 35000,
        'Cédula', 'República Dominicana', '1990-05-20', 'Fijo (Tiempo Indefinido)',
        'juana.perez@empresa.com', '809-555-0101', 'Banco Popular', '100-2345678-9', 'No',
        14, 0, 32000, 0,
      ],
      [
        '000-0000001-1 (ejemplo — bórrame)', 'Carlos', 'Ramírez', 'Supervisor de Bodega', 'Almacén',
        '2022-08-01', 28000,
        'Cédula', 'República Dominicana', '1985-11-03', 'Fijo (Tiempo Indefinido)',
        'carlos.ramirez@empresa.com', '829-555-0202', 'BanReservas', '200-3456789-0', 'No',
        7, 5000, '', 3500,
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [16, 14, 14, 22, 16, 14, 12, 16, 20, 16, 22, 26, 14, 16, 16, 14, 16, 20, 22, 18].map(w => ({ wch: w }))
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

    // .csv es texto plano (UTF-8) — leerlo como "binary string" corrompe
    // cualquier acento/ñ (cada byte multi-byte de UTF-8 se lee como un
    // carácter latin1 aparte, ej. "Cédula" → "CÃ©dula"), lo cual antes no
    // se notaba porque ningún valor de columna necesitaba coincidir
    // exactamente contra un catálogo (nombres/cédulas no se comparan por
    // igualdad). Los nuevos catálogos (Tipo de Documento, Banco, etc.) sí
    // lo necesitan, así que .csv se lee como texto UTF-8 real y .xlsx/.xls
    // (formato binario ZIP) como ArrayBuffer — cada uno con el modo de
    // lectura de xlsx que le corresponde.
    const esCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) throw new Error('No se pudo leer el archivo')
        const wb = esCSV
          ? XLSX.read(data, { type: 'string', cellDates: true })
          : XLSX.read(data, { type: 'array', cellDates: true })
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
          const tipoDocRaw = row[7]
          const nacionalidadRaw = row[8]
          const fechaNacRaw = row[9]
          const tipoContratoRaw = row[10]
          const emailRaw = row[11]
          const telefonoRaw = row[12]
          const bancoRaw = row[13]
          const numeroCuentaRaw = row[14]
          const regimenIntermRaw = row[15]
          const vacacionesRaw = row[16]
          const regaliaRaw = row[17]
          const salarioHistRaw = row[18]
          const saldoISRRaw = row[19]

          const filaCompletamenteVacia =
            !cedulaRaw && !nombreRaw && !apellidoRaw && !cargoRaw && !departamentoRaw &&
            celdaTexto(fechaRaw) === '' && celdaTexto(salarioRaw) === '' &&
            celdaTexto(tipoDocRaw) === '' && celdaTexto(nacionalidadRaw) === '' && celdaTexto(fechaNacRaw) === '' &&
            celdaTexto(tipoContratoRaw) === '' && celdaTexto(emailRaw) === '' && celdaTexto(telefonoRaw) === '' &&
            celdaTexto(bancoRaw) === '' && celdaTexto(numeroCuentaRaw) === '' && celdaTexto(regimenIntermRaw) === '' &&
            celdaTexto(vacacionesRaw) === '' && celdaTexto(regaliaRaw) === '' && celdaTexto(salarioHistRaw) === '' &&
            celdaTexto(saldoISRRaw) === ''
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
          const tipoDoc = parsearTipoDocumento(tipoDocRaw)
          const nacionalidad = parsearNacionalidad(nacionalidadRaw)
          const fechaNacRawTexto = celdaTexto(fechaNacRaw)
          const fechaNacimiento = parsearFecha(fechaNacRaw)
          const tipoContratoParsed = parsearTipoContrato(tipoContratoRaw)
          const banco = parsearBanco(bancoRaw)
          const regimenInterm = parsearBooleanoSiNo(regimenIntermRaw)
          const vac = parsearNumeroOpcional(vacacionesRaw)
          const reg = parsearNumeroOpcional(regaliaRaw)
          const histRef = parsearNumeroOpcional(salarioHistRaw)
          const isr = parsearNumeroOpcional(saldoISRRaw)

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

          if (!error && !tipoDoc.ok) error = 'Tipo de Documento no reconocido — usa Cédula/Pasaporte/Residencia/Permiso de trabajo'
          if (!error && !nacionalidad.ok) error = 'Nacionalidad no reconocida — usa el nombre del país o su código (ej. DO)'
          if (!error && fechaNacRawTexto !== '' && !fechaNacimiento) error = 'Fecha de Nacimiento inválida (use YYYY-MM-DD)'
          if (!error && !tipoContratoParsed.ok) error = 'Tipo de Contrato no reconocido — usa Fijo/Temporal/Estacional/Ocasional/Pasante/Aprendiz/Eventual'
          if (!error && !banco.ok) error = 'Banco no reconocido — usa Banco Popular/BanReservas/Scotiabank/BHD León/Banistmo/Otro'
          if (!error && !regimenInterm.ok) error = 'Régimen Intermitente debe ser Sí o No'
          if (!error && !vac.ok) error = 'Vacaciones Pendientes debe ser un número mayor o igual a 0'
          if (!error && !reg.ok) error = 'Regalía Pagada debe ser un número mayor o igual a 0'
          if (!error && !histRef.ok) error = 'Salario Histórico de Referencia debe ser un número mayor o igual a 0'
          if (!error && !isr.ok) error = 'Saldo ISR a Favor debe ser un número mayor o igual a 0'

          parsed.push({
            fila: numFila,
            cedula: cedulaRaw,
            nombre: nombreRaw,
            apellido: apellidoRaw,
            cargo: cargoRaw,
            departamento: departamentoRaw,
            fechaIngreso: fechaIngreso ?? '',
            salarioBase: salarioNum !== null && !isNaN(salarioNum) ? salarioNum : null,
            tipoDocumento: tipoDoc.valor,
            nacionalidad: nacionalidad.valor,
            fechaNacimiento: fechaNacimiento,
            tipoContrato: tipoContratoParsed.valor,
            email: emailRaw ? celdaTexto(emailRaw) : null,
            telefono: telefonoRaw ? celdaTexto(telefonoRaw) : null,
            banco: banco.valor,
            numeroCuenta: numeroCuentaRaw ? celdaTexto(numeroCuentaRaw) : null,
            regimenIntermitente: regimenInterm.valor,
            saldoVacacionesInicial: vac.valor,
            regaliaPagadaEsteAnio: reg.valor,
            salarioHistoricoReferencia: histRef.valor,
            saldoISRFavor: isr.valor,
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
    if (esCSV) reader.readAsText(file, 'UTF-8')
    else reader.readAsArrayBuffer(file)
  }

  const filasValidas = filas.filter(f => !f.error)
  const filasConError = filas.filter(f => f.error)

  function confirmarImportacion() {
    for (const f of filasValidas) {
      let empleadoId: string
      if (f.accion === 'actualizar' && f.empleadoExistenteId) {
        // No-destructivo: en blanco significa "no tocar" — nunca sobreescribe
        // un dato bueno ya cargado con vacío, igual que el Asistente Guiado.
        const cambios: Partial<Empleado> = { saldosInicialesRevisado: true }
        if (f.saldoVacacionesInicial !== null) cambios.saldoVacacionesInicial = f.saldoVacacionesInicial
        if (f.regaliaPagadaEsteAnio !== null) cambios.regaliaPagadaEsteAnio = f.regaliaPagadaEsteAnio
        if (f.salarioHistoricoReferencia !== null) cambios.salarioHistoricoReferencia = f.salarioHistoricoReferencia
        if (f.tipoDocumento !== null) cambios.tipoDocumento = f.tipoDocumento
        if (f.nacionalidad !== null) cambios.nacionalidad = f.nacionalidad
        if (f.fechaNacimiento !== null) cambios.fechaNacimiento = f.fechaNacimiento
        if (f.tipoContrato !== null) cambios.tipoContrato = f.tipoContrato
        if (f.email !== null) cambios.email = f.email
        if (f.telefono !== null) cambios.telefono = f.telefono
        if (f.banco !== null) cambios.banco = f.banco
        if (f.numeroCuenta !== null) cambios.numeroCuenta = f.numeroCuenta
        if (f.regimenIntermitente !== null) cambios.regimenIntermitente = f.regimenIntermitente
        update(f.empleadoExistenteId, cambios)
        empleadoId = f.empleadoExistenteId
      } else {
        const nuevo: Omit<Empleado, 'id'> = {
          nombre: f.nombre.trim(),
          apellido: f.apellido.trim(),
          cedula: f.cedula.trim(),
          tipoDocumento: f.tipoDocumento ?? 'cedula',
          nacionalidad: f.nacionalidad ?? undefined,
          fechaNacimiento: f.fechaNacimiento ?? undefined,
          cargo: f.cargo.trim(),
          departamento: f.departamento.trim(),
          fechaIngreso: f.fechaIngreso,
          salarioBase: f.salarioBase ?? 0,
          tipoContrato: f.tipoContrato ?? 'fijo',
          activo: true,
          email: f.email ?? undefined,
          telefono: f.telefono ?? undefined,
          banco: f.banco ?? undefined,
          numeroCuenta: f.numeroCuenta ?? undefined,
          categoriaRiesgo: getCategoriaSRLPorSector(empresa.sectorEmpresa),
          regimenIntermitente: f.regimenIntermitente ?? undefined,
          saldoVacacionesInicial: f.saldoVacacionesInicial ?? undefined,
          regaliaPagadaEsteAnio: f.regaliaPagadaEsteAnio ?? undefined,
          salarioHistoricoReferencia: f.salarioHistoricoReferencia ?? undefined,
          saldosInicialesRevisado: true,
        }
        empleadoId = add(nuevo).id
      }
      // Saldo ISR a Favor no es un campo de Empleado — crea un SaldoISRFavor
      // real vía registrarSaldoISR(), igual que registrarlo desde la ficha
      // del empleado, para que se aplique automáticamente en su próxima nómina.
      if (f.saldoISRFavor !== null && f.saldoISRFavor > 0) {
        registrarSaldoISR({
          empleadoId,
          monto: f.saldoISRFavor,
          motivo: 'Saldo migrado en Carga Inicial (Importador Excel)',
          tipo: 'retencion_excesiva',
          anio: new Date().getFullYear(),
          fechaRegistro: new Date().toISOString().slice(0, 10),
        })
      }
    }
    setImportados(filasValidas.length)
    setPaso('exito')
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)] space-y-6">

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
                Contiene las columnas exactas que necesitamos — identidad, contacto y datos bancarios,
                además de los saldos migrados — con 2 filas de ejemplo. Bórralas antes de llenar los datos
                reales de tus empleados. Si la cédula de una fila ya existe en el sistema, solo se
                actualizan los campos que llenaste (lo que dejes en blanco no se toca) — si no existe, se
                crea un empleado nuevo con los datos de esa fila.
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Se importarán</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{filasValidas.length}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-[#252840]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Fila</th>
                  <th className="px-4 py-2.5 font-medium">Empleado</th>
                  <th className="px-4 py-2.5 font-medium">Acción</th>
                  <th className="px-4 py-2.5 font-medium">Vacaciones</th>
                  <th className="px-4 py-2.5 font-medium">Regalía Pagada</th>
                  <th className="px-4 py-2.5 font-medium">Salario Histórico</th>
                  <th className="px-4 py-2.5 font-medium">Saldo ISR</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
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
                    <td className="px-4 py-2.5 text-zinc-500 tabular-nums">{f.saldoISRFavor !== null ? formatRD(f.saldoISRFavor) : '—'}</td>
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
                    <td colSpan={8} className="px-4 py-6 text-center text-xs text-zinc-400">
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
            Se importaron/actualizaron {importados} empleado{importados === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            Sus datos ya quedaron guardados. Puedes revisarlos en la ficha de cada empleado.
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
