'use client'

import { useMemo, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import {
  useLicencias, DIAS_LICENCIA, DIAS_SUGERIDOS_SUBSIDIO, labelLicencia, esLicenciaConSubsidio,
} from '@/lib/licencias-context'
import { formatRD, formatDate, fullName, BTN_PRIMARY } from '@/lib/utils'
import { downloadBase64 } from '@/lib/empleado-form'
import type { TipoLicencia, EstadoReclamoSubsidio } from '@/types'
import {
  FileClock, CalendarPlus, Banknote, Trash2, Plus, Info, Heart, HeartCrack, Baby,
  Stethoscope, HardHat, ShieldCheck, Download, Search, RotateCcw, Upload, FileText, X,
  HandCoins,
} from 'lucide-react'

const TIPOS: TipoLicencia[] = [
  'matrimonial', 'fallecimiento', 'alumbramiento',
  'enfermedad_comun', 'accidente_laboral', 'maternidad',
]

// Tope de cordura para el campo "Días" de licencias con subsidio — ningún
// certificado médico/legal individual excede razonablemente un año calendario;
// sirve para atajar errores de tipeo (ej. "9999" en vez de "9") antes de que
// distorsionen las stat cards y el histórico.
const DIAS_MAX_SUBSIDIO = 365

function iconoTipo(tipo: TipoLicencia) {
  switch (tipo) {
    case 'matrimonial':       return Heart
    case 'fallecimiento':     return HeartCrack
    case 'alumbramiento':     return Baby
    case 'enfermedad_comun':  return Stethoscope
    case 'accidente_laboral': return HardHat
    case 'maternidad':        return Baby
  }
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

function labelModalidad(l: { tipo: TipoLicencia, modalidadEnfermedad?: 'ambulatoria' | 'hospitalaria' }): string {
  if (l.tipo === 'enfermedad_comun') {
    return l.modalidadEnfermedad === 'hospitalaria' ? 'Hospitalaria (40%)' : 'Ambulatoria (60%)'
  }
  if (l.tipo === 'accidente_laboral') return 'SRL (75%)'
  if (l.tipo === 'maternidad') return 'SISALRIL (Art. 236)'
  return '—'
}

const LABEL_RECLAMO: Record<EstadoReclamoSubsidio, string> = {
  por_reclamar: 'Por Reclamar',
  reclamado:    'Reclamado',
  reembolsado:  'Reembolsado',
}

const VARIANT_RECLAMO: Record<EstadoReclamoSubsidio, 'warning' | 'info' | 'success'> = {
  por_reclamar: 'warning',
  reclamado:    'info',
  reembolsado:  'success',
}

export default function LicenciasPage() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa } = useEmpresa()
  const {
    licencias, registrar, eliminar, marcarReclamado, marcarReembolsado, revertirEstadoReclamo,
  } = useLicencias()

  const [empleadoId, setEmpleadoId] = useState('')
  const [tipo, setTipo] = useState<TipoLicencia>('matrimonial')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [diasSubsidio, setDiasSubsidio] = useState<string>('')
  const [modalidadEnfermedad, setModalidadEnfermedad] = useState<'ambulatoria' | 'hospitalaria'>('ambulatoria')
  const [disfruteSueldo, setDisfruteSueldo] = useState(false)
  const [docBase64, setDocBase64] = useState<string | null>(null)
  const [docNombre, setDocNombre] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  // ── Filtros (nombre, cédula, departamento) ──────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('todos')

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])
  const conSubsidio = esLicenciaConSubsidio(tipo)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setDocBase64(base64)
      setDocNombre(file.name)
    }
    reader.readAsDataURL(file)
  }

  function clearFile() {
    setDocBase64(null)
    setDocNombre(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hoy = new Date()
  const licenciasMes = licencias.filter(l => {
    const f = new Date(l.fechaInicio)
    return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear()
  })
  const totalPagadoMes = licenciasMes.reduce((s, l) => s + l.montoPagado, 0)
  const totalPagadoGeneral = licencias.reduce((s, l) => s + l.montoPagado, 0)
  const totalSubsidioMes = licenciasMes.reduce((s, l) => s + (l.montoSubsidioEstimado ?? 0), 0)

  function resetForm() {
    setEmpleadoId('')
    setFechaInicio(new Date().toISOString().split('T')[0])
    setDiasSubsidio('')
    setModalidadEnfermedad('ambulatoria')
    setDisfruteSueldo(false)
    clearFile()
  }

  function handleRegistrar() {
    const emp = empMap[empleadoId]
    if (!emp) {
      setToast('Seleccione un empleado')
      return
    }
    // Días de licencia con subsidio: se capturan del certificado médico/legal
    // y siempre son días calendario completos — se redondea por si el campo
    // numérico trae un valor fraccional (ej. 3.5), y se pone un tope de
    // cordura para no dejar pasar un error de tipeo (ej. un cero de más) que
    // dispararía los totales de la página a cifras absurdas sin ningún aviso.
    const diasNum = Math.round(Number(diasSubsidio))
    if (conSubsidio) {
      if (!diasSubsidio || !Number.isFinite(diasNum) || diasNum <= 0) {
        setToast('Indique los días de licencia (según certificado médico/legal)')
        return
      }
      if (diasNum > DIAS_MAX_SUBSIDIO) {
        setToast(`Los días de licencia superan ${DIAS_MAX_SUBSIDIO} — verifique el certificado médico/legal antes de registrar`)
        return
      }
    }
    registrar(empleadoId, tipo, fechaInicio, emp, {
      dias: conSubsidio ? diasNum : undefined,
      modalidadEnfermedad: tipo === 'enfermedad_comun' ? modalidadEnfermedad : undefined,
      disfruteSueldo: conSubsidio ? disfruteSueldo : undefined,
      documentoSoporte: docBase64 ?? undefined,
      documentoNombre: docNombre ?? undefined,
    })
    setToast(`Licencia ${labelLicencia(tipo).toLowerCase()} registrada — ${fullName(emp)}`)
    resetForm()
  }

  function handleEliminar(id: string) {
    eliminar(id)
    setToast('Licencia eliminada')
  }

  function handleDescargarDocumento(l: { documentoSoporte?: string, documentoNombre?: string }) {
    if (!l.documentoSoporte || !l.documentoNombre) return
    downloadBase64(l.documentoSoporte, l.documentoNombre)
  }

  const hoyISO = new Date().toISOString().split('T')[0]

  function handleAvanzarReclamo(l: { id: string, estadoReclamo?: EstadoReclamoSubsidio, montoSubsidioEstimado?: number }) {
    if (l.estadoReclamo === 'por_reclamar') {
      marcarReclamado(l.id, hoyISO)
      setToast('Reclamo marcado como sometido ante SISALRIL/ARL')
    } else if (l.estadoReclamo === 'reclamado') {
      marcarReembolsado(l.id, hoyISO, l.montoSubsidioEstimado)
      setToast('Reembolso registrado')
    }
  }

  const licenciasOrdenadas = [...licencias].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))

  const departamentos = Array.from(new Set(
    licenciasOrdenadas.map(l => empMap[l.empleadoId]?.departamento).filter((d): d is string => !!d)
  )).sort()
  const q = busqueda.trim().toLowerCase()
  const licenciasVisibles = licenciasOrdenadas.filter(l => {
    const emp = empMap[l.empleadoId]
    if (filtroDepto !== 'todos' && emp?.departamento !== filtroDepto) return false
    if (!q) return true
    if (!emp) return false
    return fullName(emp).toLowerCase().includes(q) || emp.cedula.toLowerCase().includes(q)
  })
  const hayFiltrosActivos = busqueda.trim() !== '' || filtroDepto !== 'todos'
  const totalPagadoVisible = licenciasVisibles.reduce((s, l) => s + l.montoPagado, 0)
  const totalSubsidioVisible = licenciasVisibles.reduce((s, l) => s + (l.montoSubsidioEstimado ?? 0), 0)

  const subsidiosPorReclamar = licencias.filter(l => l.estadoReclamo === 'por_reclamar')
  const totalPorReclamar = subsidiosPorReclamar.reduce((s, l) => s + (l.montoSubsidioEstimado ?? 0), 0)

  async function handleExportar() {
    if (licenciasOrdenadas.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filas = licenciasOrdenadas.map(l => {
      const emp = empMap[l.empleadoId]
      return [
        emp ? fullName(emp) : 'Empleado eliminado',
        labelLicencia(l.tipo),
        formatDate(l.fechaInicio),
        formatDate(l.fechaFin),
        labelModalidad(l),
        l.dias,
        l.montoPagado,
        l.montoSubsidioEstimado ?? 0,
        l.estadoReclamo ? LABEL_RECLAMO[l.estadoReclamo] : '—',
        l.documentoNombre ?? '—',
      ]
    })
    const totalPagado = licenciasOrdenadas.reduce((s, l) => s + l.montoPagado, 0)
    const totalSubsidio = licenciasOrdenadas.reduce((s, l) => s + (l.montoSubsidioEstimado ?? 0), 0)
    await exportarExcel({
      nombreArchivo: `licencias-${new Date().toISOString().split('T')[0]}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Licencias',
        titulo: 'Licencias Registradas',
        subtitulo: `${licenciasOrdenadas.length} licencia(s) — generado ${formatDate(new Date().toISOString())}`,
        encabezados: [
          'Empleado', 'Tipo de Licencia', 'Fecha Inicio', 'Fecha Fin', 'Modalidad',
          'Días', 'Pagado por la Empresa', 'Subsidio TSS/ARL Estimado', 'Estado Reclamo', 'Doc. Adjunto',
        ],
        filas,
        totales: ['TOTAL', '', '', '', '', '', totalPagado, totalSubsidio, '', ''],
        anchos: [26, 20, 14, 14, 18, 8, 20, 22, 16, 24],
        columnasEnteras: [5],
      }],
    })
    setToast('Licencias exportadas a Excel')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Licencias Remuneradas"
        subtitle="Remuneradas y con subsidio — Código de Trabajo y Seguridad Social"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Licencias Este Mes"
            value={`${licenciasMes.length}`}
            sub="Registradas en el mes actual"
            icon={FileClock}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Pagado por la Empresa Este Mes"
            value={formatRD(totalPagadoMes)}
            sub="Vía nómina — no incluye subsidios TSS"
            icon={Banknote}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Subsidio SISALRIL/ARL Este Mes"
            value={formatRD(totalSubsidioMes)}
            sub="Informativo — lo paga/reembolsa TSS"
            icon={ShieldCheck}
            iconColor="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          />
          <StatCard
            label="Pendiente de Reclamar"
            value={formatRD(totalPorReclamar)}
            sub={`${subsidiosPorReclamar.length} caso(s) sin reclamo sometido`}
            icon={HandCoins}
            iconColor="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          />
          <StatCard
            label="Total Histórico Pagado"
            value={formatRD(totalPagadoGeneral)}
            sub={`${licencias.length} licencia(s) registrada(s)`}
            icon={CalendarPlus}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>

        {/* ── Form: registrar nueva licencia ──────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Registrar Nueva Licencia</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              La fecha fin y el monto a pagar se calculan automáticamente según el tipo de licencia
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Empleado</label>
                <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} className={INPUT_CLASS}>
                  <option value="">— Seleccionar empleado —</option>
                  {empleadosActivos.map(e => (
                    <option key={e.id} value={e.id}>{fullName(e)} — {e.cargo}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tipo de Licencia</label>
                <select
                  value={tipo}
                  onChange={e => {
                    const nuevoTipo = e.target.value as TipoLicencia
                    setTipo(nuevoTipo)
                    if (esLicenciaConSubsidio(nuevoTipo)) {
                      setDiasSubsidio(String(DIAS_SUGERIDOS_SUBSIDIO[nuevoTipo as 'enfermedad_comun' | 'accidente_laboral' | 'maternidad']))
                    }
                  }}
                  className={INPUT_CLASS}
                >
                  {TIPOS.map(t => (
                    <option key={t} value={t}>
                      {labelLicencia(t)} {esLicenciaConSubsidio(t) ? '(días variables)' : `(${DIAS_LICENCIA[t as 'matrimonial' | 'fallecimiento' | 'alumbramiento']} días)`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Fecha de Inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {conSubsidio && (
                <div className="flex flex-col gap-1.5 w-28">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Días</label>
                  <input
                    type="number"
                    min="1"
                    max={DIAS_MAX_SUBSIDIO}
                    step="1"
                    value={diasSubsidio}
                    onChange={e => setDiasSubsidio(e.target.value)}
                    placeholder="Días"
                    className={INPUT_CLASS}
                  />
                </div>
              )}

              {tipo === 'enfermedad_comun' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Modalidad</label>
                  <select
                    value={modalidadEnfermedad}
                    onChange={e => setModalidadEnfermedad(e.target.value as 'ambulatoria' | 'hospitalaria')}
                    className={INPUT_CLASS}
                  >
                    <option value="ambulatoria">Ambulatoria (60%)</option>
                    <option value="hospitalaria">Hospitalaria (40%)</option>
                  </select>
                </div>
              )}

              <button
                onClick={handleRegistrar}
                disabled={!empleadoId}
                className={BTN_PRIMARY}
              >
                <Plus className="h-4 w-4" />
                Registrar
              </button>
            </div>

            {tipo !== 'maternidad' && conSubsidio && (
              <label className="mt-3 flex w-fit items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disfruteSueldo}
                  onChange={e => setDisfruteSueldo(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#1B2980]"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  La empresa además paga el sueldo completo como beneficio adicional (disfrute de sueldo)
                </span>
              </label>
            )}

            {/* Documento de soporte — certificado médico / acta según el tipo */}
            <div className="mt-3">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Documento de Soporte (opcional)
              </label>
              <div className="mt-1.5">
                {docNombre ? (
                  <div className="flex w-fit items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="max-w-xs truncate text-xs text-emerald-700 dark:text-emerald-300">{docNombre}</span>
                    <button type="button" onClick={clearFile} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors">
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Adjuntar certificado médico o acta…</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                      className="sr-only"
                      onChange={handleFileUpload}
                    />
                  </label>
                )}
              </div>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                Se almacena localmente junto con la licencia — certificado médico, acta de matrimonio/defunción/nacimiento, según el tipo.
              </p>
            </div>

            {conSubsidio && (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {tipo === 'maternidad'
                    ? 'La empresa paga el 100% del salario durante la licencia y luego solicita el reembolso a SISALRIL.'
                    : 'El subsidio lo paga SISALRIL/ARL directamente al empleado — Cielo Cloud no lo desembolsa, solo lo registra como referencia para tu contabilidad.'}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Licencias Registradas</h2>
            {licenciasOrdenadas.length > 0 && (
              <button
                onClick={handleExportar}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar Excel
              </button>
            )}
          </div>
          {licenciasOrdenadas.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o cédula…"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
                />
              </div>
              <select
                value={filtroDepto}
                onChange={e => setFiltroDepto(e.target.value)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              >
                <option value="todos">Todos los departamentos</option>
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {hayFiltrosActivos && (
                <button
                  onClick={() => { setBusqueda(''); setFiltroDepto('todos') }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Ver todos
                </button>
              )}
              <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
                {licenciasVisibles.length} de {licenciasOrdenadas.length} licencia(s)
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fin</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagado Empresa</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Subsidio TSS</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Reclamo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Doc.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {licenciasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <FileClock className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin licencias registradas</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Usa el formulario de arriba para registrar la primera licencia remunerada.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {licenciasOrdenadas.length > 0 && licenciasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      Ninguna licencia coincide con el filtro.
                    </td>
                  </tr>
                )}
                {licenciasVisibles.map(l => {
                  const emp = empMap[l.empleadoId]
                  const Icon = iconoTipo(l.tipo)
                  return (
                    <tr key={l.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        {emp ? (
                          <div>
                            <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(emp)}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">{emp.cargo}</p>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs">Empleado eliminado</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          <Icon className="h-3 w-3" />
                          {labelLicencia(l.tipo)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaInicio)}</td>
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaFin)}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-zinc-500 dark:text-zinc-400">{l.dias}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                        {formatRD(l.montoPagado, 2)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-sky-600 dark:text-sky-400">
                        {l.montoSubsidioEstimado != null ? formatRD(l.montoSubsidioEstimado, 2) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {l.estadoReclamo ? (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAvanzarReclamo(l)}
                              disabled={l.estadoReclamo === 'reembolsado'}
                              title={
                                l.estadoReclamo === 'por_reclamar' ? 'Marcar como reclamado ante SISALRIL/ARL'
                                : l.estadoReclamo === 'reclamado' ? 'Registrar reembolso recibido'
                                : 'Reembolso ya registrado'
                              }
                              className={l.estadoReclamo !== 'reembolsado' ? 'cursor-pointer' : 'cursor-default'}
                            >
                              <Badge variant={VARIANT_RECLAMO[l.estadoReclamo]}>{LABEL_RECLAMO[l.estadoReclamo]}</Badge>
                            </button>
                            {l.estadoReclamo !== 'por_reclamar' && (
                              <button
                                type="button"
                                onClick={() => revertirEstadoReclamo(l.id)}
                                className="text-[10px] text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                              >
                                deshacer
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {l.documentoSoporte ? (
                          <button
                            type="button"
                            onClick={() => handleDescargarDocumento(l)}
                            title={`Descargar: ${l.documentoNombre}`}
                            className="text-[#1B2980] dark:text-indigo-400 hover:text-[#151f66] dark:hover:text-indigo-300 transition-colors"
                          >
                            <FileText className="h-4 w-4 mx-auto" />
                          </button>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleEliminar(l.id)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                          title="Eliminar licencia"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {licenciasOrdenadas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                    <td colSpan={5} className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      {hayFiltrosActivos ? `TOTAL (filtrado) — ${licenciasVisibles.length} licencia(s)` : `TOTAL — ${licenciasOrdenadas.length} licencia(s)`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                      {formatRD(totalPagadoVisible, 2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-600 dark:text-sky-400">
                      {formatRD(totalSubsidioVisible, 2)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Legal note ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1.5">
              <p className="font-semibold">Licencias Remuneradas — Código de Trabajo, República Dominicana</p>
              <p>
                <strong>Matrimonial:</strong> 5 días calendario pagados al 100%. <strong>Fallecimiento de familiar</strong>
                {' '}(abuelos, padres, hijos, cónyuge): 3 días calendario pagados al 100%. <strong>Alumbramiento</strong> de
                esposa o compañera registrada: 2 días calendario pagados al 100%. El monto se calcula sobre el salario
                diario (salario base ÷ 23.83, o ÷26 en régimen de trabajo intermitente).
              </p>
              <p>
                <strong>Licencias con subsidio (Seguridad Social):</strong> <strong>Enfermedad común</strong> — SISALRIL
                subsidia 60% (atención ambulatoria) o 40% (hospitalización) del salario, pagado directo al empleado.
                {' '}<strong>Accidente laboral o enfermedad profesional</strong> — el Seguro de Riesgos Laborales (SRL)
                subsidia 75%. <strong>Maternidad</strong> — 12 semanas (Art. 236 Código de Trabajo: 6 antes y 6 después
                del parto), la empresa paga el 100% y luego solicita reembolso a SISALRIL. En los tres casos, Cielo Cloud
                solo registra el subsidio como referencia — no lo desembolsa — salvo que actives "disfrute de sueldo"
                como beneficio adicional pagado por la empresa vía nómina.
              </p>
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
