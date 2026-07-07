'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, ChevronRight, Building2, Mail, Phone, X, Pencil,
  User, Calendar, CreditCard, Download, FileText,
  Minimize2, Maximize2, Globe, UserPlus, Users, Clock, Trash2, Info,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularCesantia, calcularPreaviso, getAnosServicio, calcularNomina, calcularNominaQuincenal, cuotaDependienteSFS, getDivisorSalarioDiario, aplicarSaldoISRFavor } from '@/lib/dominican-labor'
import {
  formatRD, formatDate, formatAnosServicio,
  fullName, contratoBadgeClass, contratoLabel,
} from '@/lib/utils'
import { usePeriodos } from '@/lib/periodos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import {
  getPais, formatDocNumber, labelTipoDoc, calcularEdad, downloadBase64,
  EMPTY_EMP_FORM, toEmpForm, formToEmpleado, validateEmpForm,
} from '@/lib/empleado-form'
import type { EmpForm } from '@/lib/empleado-form'
import { EmpleadoAvatar } from '@/components/empleados/EmpleadoAvatar'
import { EmpleadoFormFields, FlagImg, inputCls, labelCls } from '@/components/empleados/EmpleadoFormFields'
import type { Empleado, Dependiente, ParentescoDependiente, PeriodoNomina, AjusteLinea, TipoPeriodo, ResultadoNomina, TipoCreditoISR } from '@/types'

// ── Floating Form Modal ───────────────────────────────────────────────────────
type WindowState = 'normal' | 'maximized' | 'minimized'

function EmpleadoFormModal({
  mode, inicial, departamentos, todosEmpleados, selfId, onClose, onGuardar,
}: {
  mode: 'crear' | 'editar'
  inicial?: Empleado
  departamentos: string[]
  todosEmpleados: Empleado[]
  selfId?: string
  onClose: () => void
  onGuardar: (data: EmpForm) => void
}) {
  const [form, setForm] = useState<EmpForm>(inicial ? toEmpForm(inicial) : EMPTY_EMP_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof EmpForm, string>>>({})
  const [winState, setWinState] = useState<WindowState>('normal')

  function set<K extends keyof EmpForm>(field: K, value: EmpForm[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validateEmpForm(form)
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onGuardar(form)
  }

  const supervisores = todosEmpleados.filter(e => e.id !== selfId && e.activo)

  // Window size classes
  const isMax = winState === 'maximized'
  const isMin = winState === 'minimized'

  // When minimized → small floating bar at bottom-center
  if (isMin) {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-xl bg-[#1B2980] px-4 py-2.5 shadow-2xl">
          <Globe className="h-4 w-4 text-indigo-200" />
          <span className="text-sm font-medium text-white">
            {mode === 'editar' ? 'Editar Empleado' : 'Nuevo Empleado'}
          </span>
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => setWinState('normal')}
              className="rounded p-1 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              title="Restaurar"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMax ? 'items-stretch' : 'items-center justify-center p-4'}`}
      onClick={isMax ? undefined : onClose}
    >
      {/* Window */}
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-200 animate-modal-in ${
          isMax
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-2xl max-h-[92vh] rounded-xl'
        } bg-white dark:bg-[#141722]`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Title bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-[#1B2980] dark:bg-[#111527] px-5 py-3 shrink-0 select-none">
          {/* Left: traffic lights */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/90 hover:bg-red-400 cursor-pointer" onClick={onClose} title="Cerrar" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/90 hover:bg-yellow-400 cursor-pointer" onClick={() => setWinState('minimized')} title="Minimizar" />
              <div className="h-3 w-3 rounded-full bg-green-400/90 hover:bg-green-400 cursor-pointer" onClick={() => setWinState(s => s === 'maximized' ? 'normal' : 'maximized')} title={isMax ? 'Restaurar' : 'Maximizar'} />
            </div>
            <span className="text-sm font-semibold text-white/90">
              {mode === 'editar' ? 'Editar Empleado' : 'Nuevo Empleado'}
            </span>
            {form.nombre && (
              <span className="text-xs text-indigo-300 hidden sm:inline">
                — {form.nombre} {form.apellido}
              </span>
            )}
          </div>

          {/* Right: icon controls */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setWinState('minimized')}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Minimizar">
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setWinState(s => s === 'maximized' ? 'normal' : 'maximized')}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              title={isMax ? 'Restaurar' : 'Maximizar'}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClose}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
          <div className={`overflow-y-auto flex-1 ${isMax ? 'p-8' : 'p-6'}`}>
            <EmpleadoFormFields
              form={form}
              set={set}
              errors={errors}
              departamentos={departamentos}
              supervisores={supervisores}
              wide={isMax}
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              {Object.keys(errors).length > 0 && (
                <span className="text-rose-500">{Object.keys(errors).length} campo{Object.keys(errors).length > 1 ? 's' : ''} requerido{Object.keys(errors).length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                Cancelar
              </button>
              <button type="submit"
                className="rounded-lg bg-[#1B2980] px-5 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors">
                {mode === 'editar' ? 'Guardar Cambios' : 'Registrar Empleado'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Historial helpers ─────────────────────────────────────────────────────────
const MESES_HIST = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

function labelPeriodoHist(p: PeriodoNomina): string {
  const mes = MESES_HIST[p.mes - 1]
  if (p.tipo === 'quincenal') {
    return `${p.quincena === 1 ? '1a Q' : '2a Q'} ${mes} ${p.anio}`
  }
  return `${mes} ${p.anio}`
}

function calcNominaConAjustes(
  empleado: Empleado,
  ajustes: AjusteLinea[],
  tipo: TipoPeriodo,
  quincena: 1 | 2,
): ResultadoNomina {
  const horasExtras35   = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a) => s + a.valor, 0)
  const horasExtras100  = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
  const bonificaciones  = ajustes.filter(a => a.concepto === 'bono' || a.concepto === 'otro_ingreso').reduce((s, a) => s + a.valor, 0)
  const comisiones      = ajustes.filter(a => a.concepto === 'comision').reduce((s, a) => s + a.valor, 0)
  const sfsDependientes = ajustes.filter(a => a.concepto === 'dependiente_sfs').reduce((s, a) => s + a.valor, 0)
  const otrosDescuentos = ajustes.filter(a => a.concepto === 'prestamo' || a.concepto === 'otro_descuento').reduce((s, a) => s + a.valor, 0)
  const params = { horasExtras35, horasExtras100, bonificaciones, comisiones, sfsDependientes, otrosDescuentos }
  return tipo === 'quincenal'
    ? calcularNominaQuincenal(empleado, quincena, params)
    : calcularNomina(empleado, params)
}

// ── View Modal (floating window) ──────────────────────────────────────────────
function EmpleadoDrawer({
  empleado, todosEmpleados, onClose, onEditar, onToggleActivo, onEliminar,
}: {
  empleado: Empleado
  todosEmpleados: Empleado[]
  onClose: () => void
  onEditar: () => void
  onToggleActivo: () => void
  onEliminar: () => void
}) {
  const { update, suspender, reactivar } = useEmpleados()
  const { periodos } = usePeriodos()
  const { registrar: registrarSaldoISR, getSaldosActivos, getMontoAplicadoEnPeriodo } = useSaldoISR()
  const [showSaldoISRForm, setShowSaldoISRForm] = useState(false)
  const [saldoISRMonto, setSaldoISRMonto] = useState('')
  const [saldoISRMotivo, setSaldoISRMotivo] = useState('')
  const [saldoISRTipo, setSaldoISRTipo] = useState<TipoCreditoISR>('retencion_excesiva')
  const [saldoISRAnio, setSaldoISRAnio] = useState(() => new Date().getFullYear())
  const [winState, setWinState] = useState<WindowState>('normal')
  const [mostrarSuspension, setMostrarSuspension] = useState(false)
  const [motivoSusp, setMotivoSusp] = useState('')
  const [fechaSusp, setFechaSusp] = useState(() => new Date().toISOString().slice(0, 10))
  const [tabActivo, setTabActivo] = useState<'info' | 'dependientes' | 'historial'>('info')
  const [showDepForm, setShowDepForm] = useState(false)
  const [depNombre, setDepNombre]     = useState('')
  const [depApellido, setDepApellido] = useState('')
  const [depCedula, setDepCedula]     = useState('')
  const [depParentesco, setDepParentesco] = useState<ParentescoDependiente>('hijo_mayor_18_no_estudiante')
  const [depFechaNac, setDepFechaNac] = useState('')
  const depCuotaMensual = cuotaDependienteSFS()
  const anos      = getAnosServicio(empleado.fechaIngreso)
  const cesantia  = calcularCesantia(empleado.salarioBase, anos, getDivisorSalarioDiario(empleado))
  const preaviso  = calcularPreaviso(empleado.salarioBase, anos, getDivisorSalarioDiario(empleado))
  const supervisor = todosEmpleados.find(e => e.id === empleado.supervisorId)
  const pais       = empleado.nacionalidad ? getPais(empleado.nacionalidad) : undefined
  const saldosISRActivos = getSaldosActivos(empleado.id)
  const isMax      = winState === 'maximized'
  const isMin      = winState === 'minimized'

  if (isMin) {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-xl bg-[#1B2980] dark:bg-[#111527] px-4 py-2.5 shadow-2xl">
          <EmpleadoAvatar emp={empleado} size="sm" />
          <span className="text-sm font-medium text-white">{fullName(empleado)}</span>
          <div className="flex items-center gap-1 ml-2">
            <button type="button" onClick={() => setWinState('normal')}
              className="rounded p-1 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Restaurar">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClose}
              className="rounded p-1 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Cerrar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMax ? 'items-stretch' : 'items-center justify-center p-4'}`}
      onClick={isMax ? undefined : onClose}
    >
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-200 animate-modal-in bg-white dark:bg-[#141722] ${
          isMax ? 'w-full h-full rounded-none' : 'w-full max-w-2xl max-h-[92vh] rounded-xl'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Title bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-[#1B2980] dark:bg-[#111527] px-5 py-3 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/90 hover:bg-red-400 cursor-pointer" onClick={onClose} title="Cerrar" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/90 hover:bg-yellow-400 cursor-pointer" onClick={() => setWinState('minimized')} title="Minimizar" />
              <div className="h-3 w-3 rounded-full bg-green-400/90 hover:bg-green-400 cursor-pointer" onClick={() => setWinState(s => s === 'maximized' ? 'normal' : 'maximized')} title={isMax ? 'Restaurar' : 'Maximizar'} />
            </div>
            <div className="flex items-center gap-2.5 ml-1">
              <EmpleadoAvatar emp={empleado} size="sm" className="ring-2 ring-white/20" />
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{fullName(empleado)}</p>
                <p className="text-[11px] text-indigo-200 leading-tight">{empleado.cargo} · {empleado.departamento}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setWinState('minimized')}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Minimizar">
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setWinState(s => s === 'maximized' ? 'normal' : 'maximized')}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              title={isMax ? 'Restaurar' : 'Maximizar'}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClose}
              className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Hero strip: avatar grande + badges ──────────────────── */}
        <div className="shrink-0 flex items-center gap-5 px-8 py-5 border-b border-zinc-100 dark:border-[#1d2035] bg-gradient-to-r from-slate-50 to-white dark:from-[#1a1d2e] dark:to-[#141722]">
          <EmpleadoAvatar emp={empleado} size="lg" className="ring-4 ring-white dark:ring-[#252840] shadow-md" />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">{fullName(empleado)}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{empleado.cargo} · {empleado.departamento}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={`ring-1 ${contratoBadgeClass(empleado.tipoContrato)}`}>
                {contratoLabel(empleado.tipoContrato)}
              </Badge>
              <Badge variant={empleado.activo ? 'success' : 'neutral'}>
                {empleado.activo ? 'Activo' : 'Inactivo'}
              </Badge>
              {empleado.activo && empleado.suspendido && (
                <Badge variant="warning">Suspendido</Badge>
              )}
              {pais && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <FlagImg code={pais.code} className="h-3.5 w-5" /> {pais.nombre}
                </span>
              )}
            </div>
            {empleado.activo && empleado.suspendido && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                Suspendido desde el {formatDate(empleado.fechaSuspension!)}
                {empleado.motivoSuspension && ` — ${empleado.motivoSuspension}`}
              </p>
            )}
          </div>
          {/* Quick stats */}
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(empleado.salarioBase, 0)}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Salario mensual</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{formatAnosServicio(anos)} de antigüedad</p>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────── */}
        <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 flex gap-0 shrink-0">
          {([
            { id: 'info',         label: 'Información' },
            { id: 'dependientes', label: 'Dependientes' },
            { id: 'historial',    label: 'Historial Nómina' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActivo(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tabActivo === tab.id
                  ? 'border-[#1B2980] text-[#1B2980] dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Información ─────────────────────────────────────── */}
        {tabActivo === 'info' && (
        <div className={`overflow-y-auto flex-1 ${isMax ? 'p-8' : 'p-6'}`}>
          <div className={`space-y-6 ${isMax ? 'grid grid-cols-2 gap-8 space-y-0' : ''}`}>

            {/* Column 1 */}
            <div className="space-y-6">
              {/* Datos Personales */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
                <div className="space-y-2.5">
                  {pais && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Nacionalidad</span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        <FlagImg code={pais.code} /> {pais.nombre}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">{labelTipoDoc(empleado.tipoDocumento)}</span>
                    <span className="text-sm font-medium font-mono text-zinc-800 dark:text-zinc-200">
                      {formatDocNumber(empleado.cedula, empleado.tipoDocumento)}
                    </span>
                  </div>
                  {empleado.fechaNacimiento && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Nacimiento</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {formatDate(empleado.fechaNacimiento)} · {calcularEdad(empleado.fechaNacimiento)} años
                      </span>
                    </div>
                  )}
                  {empleado.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Correo</span>
                      <a href={`mailto:${empleado.email}`}
                        className="text-sm font-medium text-[#1B2980] dark:text-indigo-400 hover:underline truncate"
                        onClick={e => e.stopPropagation()}>
                        {empleado.email}
                      </a>
                    </div>
                  )}
                  {empleado.telefono && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Teléfono</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{empleado.telefono}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Departamento</span>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{empleado.departamento}</span>
                  </div>
                  {supervisor && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Supervisor</span>
                      <div className="flex items-center gap-2">
                        <EmpleadoAvatar emp={supervisor} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fullName(supervisor)}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{supervisor.cargo}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Documentos adjuntos */}
              {(empleado.documentoIdentidad || empleado.contratoLaboral) && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Documentos</h3>
                  <div className="space-y-2">
                    {empleado.documentoIdentidad && empleado.documentoIdentidadNombre && (
                      <button type="button"
                        onClick={() => downloadBase64(empleado.documentoIdentidad!, empleado.documentoIdentidadNombre!)}
                        className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors group">
                        <FileText className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{labelTipoDoc(empleado.tipoDocumento)} — escaneo</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.documentoIdentidadNombre}</p>
                        </div>
                        <Download className="h-3.5 w-3.5 text-zinc-400 group-hover:text-[#1B2980] dark:group-hover:text-indigo-400 shrink-0 transition-colors" />
                      </button>
                    )}
                    {empleado.contratoLaboral && empleado.contratoLaboralNombre && (
                      <button type="button"
                        onClick={() => downloadBase64(empleado.contratoLaboral!, empleado.contratoLaboralNombre!)}
                        className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors group">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Contrato Laboral</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.contratoLaboralNombre}</p>
                        </div>
                        <Download className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-colors" />
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Column 2 (or continuation when normal) */}
            <div className="space-y-6">
              {/* Datos Laborales */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Fecha de Ingreso', value: formatDate(empleado.fechaIngreso) },
                    { label: 'Antigüedad',        value: formatAnosServicio(anos) },
                    { label: 'Salario Mensual',   value: formatRD(empleado.salarioBase, 0) },
                    { label: 'Salario Anual',     value: formatRD(empleado.salarioBase * 12, 0) },
                    { label: 'Banco',             value: empleado.banco ?? '—' },
                    { label: 'N° Cuenta',         value: empleado.numeroCuenta ?? '—' },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase text-zinc-400 dark:text-zinc-500">{item.label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Derechos */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  Derechos (Estimado Acumulado)
                </h3>
                <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  Cálculo conforme a Ley 16-92 · Código de Trabajo
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'Cesantía estimada', sub: 'Art. 80 — Auxilio de cesantía', value: cesantia,                   color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-950/20',    border: 'border-rose-100 dark:border-rose-900/40' },
                    { label: 'Preaviso',           sub: 'Art. 76 — Desahucio',           value: preaviso,                   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20',  border: 'border-amber-100 dark:border-amber-900/40' },
                    { label: 'Regalía Pascual',    sub: 'Art. 219 — 1/12 anual/mes',     value: empleado.salarioBase / 12,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/40' },
                  ].map(r => (
                    <div key={r.label} className={`flex items-center justify-between rounded-lg border ${r.border} ${r.bg} px-4 py-3`}>
                      <div>
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{r.sub}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${r.color}`}>{formatRD(r.value, 0)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Saldo ISR a Favor */}
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Saldo ISR a Favor
                  </h3>
                  <button type="button" onClick={() => setShowSaldoISRForm(v => !v)}
                    className="text-[11px] font-medium text-[#1B2980] dark:text-indigo-400 hover:underline">
                    + Registrar
                  </button>
                </div>
                <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                  ISR retenido de más — se descuenta automáticamente del ISR calculado en próximos
                  períodos hasta agotarse, o se liquida contra prestaciones si se desvincula antes.
                </p>

                {showSaldoISRForm && (
                  <div className="mb-3 space-y-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] p-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Tipo de Crédito</label>
                      <select value={saldoISRTipo} onChange={e => setSaldoISRTipo(e.target.value as TipoCreditoISR)}
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none">
                        <option value="retencion_excesiva">Retención de ISR en exceso</option>
                        <option value="gastos_educativos">Gastos educativos (Ley 179-09)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Monto (RD$)</label>
                        <input type="number" min="0" step="0.01" value={saldoISRMonto}
                          onChange={e => setSaldoISRMonto(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Año Fiscal</label>
                        <input type="number" value={saldoISRAnio}
                          onChange={e => setSaldoISRAnio(Number(e.target.value))}
                          className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Motivo</label>
                      <input type="text" value={saldoISRMotivo}
                        onChange={e => setSaldoISRMotivo(e.target.value)}
                        placeholder={saldoISRTipo === 'gastos_educativos' ? 'Ej. colegiatura autorizada por DGII' : 'Ej. cambio de tramo ISR a mitad de año'}
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
                    </div>
                    {saldoISRTipo === 'gastos_educativos' && (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        La Ley 179-09 permite un crédito de ISR por gastos educativos, pero el 10%/25%
                        exacto depende de una notificación/aprobación de la DGII — Cielo Cloud no lo
                        calcula automáticamente. Registra aquí el monto ya autorizado.
                      </p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button"
                        onClick={() => { setShowSaldoISRForm(false); setSaldoISRMonto(''); setSaldoISRMotivo(''); setSaldoISRTipo('retencion_excesiva') }}
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-[#141722] transition-colors">
                        Cancelar
                      </button>
                      <button type="button"
                        onClick={() => {
                          const monto = Number(saldoISRMonto)
                          if (!monto || monto <= 0) return
                          registrarSaldoISR({
                            empleadoId: empleado.id,
                            monto,
                            motivo: saldoISRMotivo.trim() || 'Sin especificar',
                            tipo: saldoISRTipo,
                            anio: saldoISRAnio,
                            fechaRegistro: new Date().toISOString().slice(0, 10),
                          })
                          setShowSaldoISRForm(false)
                          setSaldoISRMonto('')
                          setSaldoISRMotivo('')
                          setSaldoISRTipo('retencion_excesiva')
                        }}
                        className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors">
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {saldosISRActivos.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Sin saldo pendiente.</p>
                ) : (
                  <div className="space-y-2">
                    {saldosISRActivos.map(s => (
                      <div key={s.id} className="rounded-lg border border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-950/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{s.motivo}</p>
                              {s.tipo === 'gastos_educativos' && (
                                <span className="rounded-full bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                                  Ley 179-09
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Año {s.anio} · original {formatRD(s.monto, 0)}</p>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-teal-600 dark:text-teal-400">{formatRD(s.saldoPendiente, 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

          </div>
        </div>
        )}

        {/* ── Tab: Dependientes ───────────────────────────────────── */}
        {tabActivo === 'dependientes' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dependientes Adicionales SFS</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Resolución 624-02 CNSS · Descuento por nómina</p>
              </div>
              {!showDepForm && (
                <button
                  onClick={() => setShowDepForm(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1B2980] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#151f66] transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              )}
            </div>

            {showDepForm && (
              <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nuevo Dependiente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre</label>
                    <input value={depNombre} onChange={e => setDepNombre(e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Apellido</label>
                    <input value={depApellido} onChange={e => setDepApellido(e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cédula (opcional)</label>
                    <input value={depCedula} onChange={e => setDepCedula(e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Parentesco</label>
                    <select value={depParentesco} onChange={e => setDepParentesco(e.target.value as ParentescoDependiente)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none">
                      <option value="hijo_mayor_18_no_estudiante">Hijo/Hijastro +18 (no estudiante)</option>
                      <option value="hijo_mayor_21">Hijo/Hijastro +21 años</option>
                      <option value="padre_titular">Padre del Titular</option>
                      <option value="madre_titular">Madre del Titular</option>
                      <option value="padre_conyuge">Padre del Cónyuge</option>
                      <option value="madre_conyuge">Madre del Cónyuge</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha de Nacimiento</label>
                    <input type="date" value={depFechaNac} onChange={e => setDepFechaNac(e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Descuento SFS (Res. 624-02)</label>
                    <div className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                      <span>2.9% × cotizable del empleado</span>
                      <span className="tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                        {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(depCuotaMensual)}/mes
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (!depNombre.trim() || !depApellido.trim()) return
                      const nuevo: Dependiente = {
                        id: Date.now().toString(36),
                        nombre: depNombre.trim(),
                        apellido: depApellido.trim(),
                        cedula: depCedula.trim() || undefined,
                        parentesco: depParentesco,
                        fechaNacimiento: depFechaNac || undefined,
                      }
                      const deps = [...(empleado.dependientes ?? []), nuevo]
                      update(empleado.id, { dependientes: deps })
                      setShowDepForm(false)
                      setDepNombre(''); setDepApellido(''); setDepCedula('')
                      setDepParentesco('hijo_mayor_18_no_estudiante'); setDepFechaNac('')
                    }}
                    disabled={!depNombre.trim() || !depApellido.trim()}
                    className="rounded-lg bg-[#1B2980] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#151f66] transition-colors disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button onClick={() => setShowDepForm(false)}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {(empleado.dependientes ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                  <Users className="h-7 w-7 text-[#1B2980] dark:text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Sin dependientes registrados</p>
                <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">Los dependientes adicionales SFS se descuentan automáticamente en cada nómina.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(empleado.dependientes ?? []).map(dep => (
                  <div key={dep.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0fb] dark:bg-indigo-900/40 text-xs font-semibold text-[#1B2980] dark:text-indigo-300">
                        {dep.nombre[0]}{dep.apellido[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{dep.nombre} {dep.apellido}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                          {({
                            hijo_mayor_18_no_estudiante: 'Hijo/Hijastro +18 (no estudiante)',
                            hijo_mayor_21:               'Hijo/Hijastro +21 años',
                            padre_titular:               'Padre del Titular',
                            madre_titular:               'Madre del Titular',
                            padre_conyuge:               'Padre del Cónyuge',
                            madre_conyuge:               'Madre del Cónyuge',
                          } as Record<ParentescoDependiente, string>)[dep.parentesco]}{dep.cedula ? ` · ${dep.cedula}` : ''}{dep.fechaNacimiento ? ` · ${new Date(dep.fechaNacimiento).toLocaleDateString('es-DO')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(cuotaDependienteSFS())}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">/ mes</p>
                      </div>
                      <button
                        onClick={() => {
                          const deps = (empleado.dependientes ?? []).filter(d => d.id !== dep.id)
                          update(empleado.id, { dependientes: deps })
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-[#eef0fb] dark:bg-indigo-950/20 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#1B2980] dark:text-indigo-400">Total descuento mensual</p>
                  <p className="text-sm font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">
                    {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(
                      (empleado.dependientes ?? []).length * cuotaDependienteSFS()
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Historial Nómina ───────────────────────────────── */}
        {tabActivo === 'historial' && (() => {
          const historial = periodos
            .filter(p => {
              const fechaPeriodo = new Date(p.fechaGeneracion)
              const fechaIngreso = new Date(empleado.fechaIngreso)
              return fechaIngreso <= fechaPeriodo && p.estado !== 'en_proceso'
            })
            .map(p => {
              const ajustes = p.ajustesPorEmpleado?.[empleado.id] ?? []
              const base = calcNominaConAjustes(empleado, ajustes, p.tipo, p.quincena ?? 1)
              // Reconstrucción histórica: usa lo que realmente se aplicó en ese
              // período (no el saldoPendiente actual, que ya pudo cambiar).
              const montoAplicado = getMontoAplicadoEnPeriodo(empleado.id, p.id)
              const { resultado } = aplicarSaldoISRFavor(base, montoAplicado, empleado.grossingUpPct)
              return { periodo: p, resultado }
            })
            .sort((a, b) => new Date(b.periodo.fechaGeneracion).getTime() - new Date(a.periodo.fechaGeneracion).getTime())

          if (historial.length === 0) {
            return (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                  <Clock className="h-7 w-7 text-[#1B2980] dark:text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Sin historial de nómina</p>
                <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                  Los períodos procesados aparecerán aquí con el detalle de cada pago.
                </p>
              </div>
            )
          }

          const ytdYear = new Date().getFullYear()
          const ytd = historial
            .filter(h => h.periodo.anio === ytdYear)
            .reduce((acc, h) => ({
              bruto: acc.bruto + h.resultado.totalBruto,
              neto:  acc.neto  + h.resultado.salarioNeto,
              isr:   acc.isr   + h.resultado.isrMensual,
            }), { bruto: 0, neto: 0, isr: 0 })

          return (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 p-5 border-b border-zinc-100 dark:border-[#1d2035]">
                {[
                  { label: `Bruto YTD ${ytdYear}`, value: ytd.bruto },
                  { label: `Neto YTD ${ytdYear}`,  value: ytd.neto  },
                  { label: `ISR YTD ${ytdYear}`,   value: ytd.isr   },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-xl border border-zinc-100 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{kpi.label}</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">{formatRD(kpi.value, 0)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      <th className="px-5 py-2.5 font-semibold uppercase tracking-wide text-zinc-400">Período</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-zinc-400">S. Bruto</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-zinc-400">AFP+SFS</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-zinc-400">ISR</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-zinc-400">Dep. SFS</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-zinc-400">S. Neto</th>
                      <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-zinc-400">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(({ periodo, resultado }) => (
                      <tr key={periodo.id} className="border-b border-zinc-50 dark:border-[#1d2035] hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">{labelPeriodoHist(periodo)}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 capitalize">{periodo.tipo}</p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(resultado.totalBruto, 0)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(resultado.afpEmpleado + resultado.sfsEmpleado, 0)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.isrMensual === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : formatRD(resultado.isrMensual, 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.sfsDependientes === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : formatRD(resultado.sfsDependientes, 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">{formatRD(resultado.salarioNeto, 0)}</td>
                        <td className="px-3 py-3">
                          {periodo.estado === 'cerrada' ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-[#1a1d2e] dark:text-zinc-400">Cerrada</span>
                          ) : periodo.estado === 'procesada' ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Procesada</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">En Proceso</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                      <td className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                        Total — {historial.length} período{historial.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatRD(historial.reduce((s, h) => s + h.resultado.totalBruto, 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(historial.reduce((s, h) => s + h.resultado.afpEmpleado + h.resultado.sfsEmpleado, 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(historial.reduce((s, h) => s + h.resultado.isrMensual, 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatRD(historial.reduce((s, h) => s + h.resultado.sfsDependientes, 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                        {formatRD(historial.reduce((s, h) => s + h.resultado.salarioNeto, 0), 0)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })()}

        {/* ── Suspensión de contrato ───────────────────────────────── */}
        {mostrarSuspension && (
          <div className="shrink-0 border-t border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-6 py-4 space-y-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Suspender contrato — el empleado no se incluirá en la próxima nómina ni acumulará
              vacaciones/regalía hasta que lo reactives. Conserva su antigüedad.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha de inicio</label>
                <input type="date" value={fechaSusp} onChange={e => setFechaSusp(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Motivo</label>
                <input type="text" value={motivoSusp} onChange={e => setMotivoSusp(e.target.value)}
                  placeholder="Ej. Licencia médica no cubierta"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMostrarSuspension(false)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-[#1a1d2e] transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!fechaSusp) return
                  suspender(empleado.id, fechaSusp, motivoSusp.trim())
                  setMostrarSuspension(false)
                  setMotivoSusp('')
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-semibold text-white transition-colors">
                Confirmar Suspensión
              </button>
            </div>
          </div>
        )}

        {/* ── Footer actions ──────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <button onClick={onEliminar}
            className="rounded-lg border border-rose-200 dark:border-rose-800/50 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
            Eliminar
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onEditar}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            {empleado.activo && (
              empleado.suspendido ? (
                <button onClick={() => reactivar(empleado.id)}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-medium text-white transition-colors">
                  Reactivar de Suspensión
                </button>
              ) : (
                <button onClick={() => setMostrarSuspension(v => !v)}
                  className="rounded-lg border border-amber-200 dark:border-amber-800/50 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                  Suspender
                </button>
              )
            )}
            <button onClick={onToggleActivo}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                empleado.activo
                  ? 'border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}>
              {empleado.activo ? 'Dar de baja' : 'Reactivar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmpleadosPage() {
  const { empleados, add, update, remove } = useEmpleados()
  const { empresa } = useEmpresa()
  const [busqueda, setBusqueda]             = useState('')
  const [departamento, setDepartamento]     = useState('Todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [empleadoSeleccionado, setEmpSeleccionado] = useState<Empleado | null>(null)
  const [mostrarNuevo, setMostrarNuevo]     = useState(false)
  const [editando, setEditando]             = useState<Empleado | null>(null)
  const [toast, setToast]                   = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('nuevo=1')) {
      setMostrarNuevo(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (empleadoSeleccionado) {
      const fresh = empleados.find(e => e.id === empleadoSeleccionado.id)
      if (fresh) setEmpSeleccionado(fresh)
    }
  }, [empleados]) // eslint-disable-line react-hooks/exhaustive-deps

  const departamentos = ['Todos', ...new Set(empleados.map(e => e.departamento))]

  const filtrados = empleados.filter(e => {
    const q = busqueda.toLowerCase()
    const matchBusqueda =
      fullName(e).toLowerCase().includes(q) ||
      e.cedula.toLowerCase().includes(q) ||
      e.cargo.toLowerCase().includes(q)
    const matchDepto  = departamento === 'Todos' || e.departamento === departamento
    const matchActivo = mostrarInactivos ? true : e.activo
    return matchBusqueda && matchDepto && matchActivo
  })

  function handleAdd(form: EmpForm) {
    add({ ...formToEmpleado(form, empresa.sectorEmpresa), activo: true })
    setMostrarNuevo(false)
    setToast('Empleado registrado exitosamente')
  }

  function handleEdit(form: EmpForm) {
    if (!editando) return
    update(editando.id, formToEmpleado(form, empresa.sectorEmpresa))
    setEditando(null)
    setToast('Cambios guardados')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Empleados"
        subtitle={`${empleados.filter(e => e.activo).length} activos · ${empleados.filter(e => !e.activo).length} inactivos`}
        actions={
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento o cargo…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10"
            />
          </div>
          <select
            value={departamento}
            onChange={e => setDepartamento(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] dark:text-zinc-200 py-2 pl-3 pr-8 text-sm text-zinc-700 focus:border-[#1B2980] focus:outline-none"
          >
            {departamentos.map(d => <option key={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={mostrarInactivos}
              onChange={e => setMostrarInactivos(e.target.checked)}
              className="rounded border-zinc-300 text-[#1B2980]" />
            Mostrar inactivos
          </label>
        </div>

        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {['Empleado', 'Nacionalidad', 'Documento', 'Departamento', 'Tipo Contrato', 'Ingreso'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Base</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filtrados.map(emp => {
                  const pais = emp.nacionalidad ? getPais(emp.nacionalidad) : undefined
                  return (
                    <tr key={emp.id}
                      className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors cursor-pointer"
                      onClick={() => setEmpSeleccionado(emp)}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <EmpleadoAvatar emp={emp} size="sm" />
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {pais ? (
                          <span className="flex items-center gap-1.5 text-sm" title={pais.nombre}>
                            <FlagImg code={pais.code} />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden lg:inline">{pais.nombre}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{formatDocNumber(emp.cedula, emp.tipoDocumento)}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{labelTipoDoc(emp.tipoDocumento)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{emp.departamento}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${contratoBadgeClass(emp.tipoContrato)}`}>
                          {contratoLabel(emp.tipoContrato)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{formatDate(emp.fechaIngreso)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(emp.salarioBase, 0)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={emp.activo ? 'success' : 'neutral'}>{emp.activo ? 'Activo' : 'Inactivo'}</Badge>
                          {emp.activo && emp.suspendido && <Badge variant="warning">Suspendido</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <circle cx="12" cy="8" r="4" strokeLinecap="round" strokeLinejoin="round" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin resultados</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          No se encontraron empleados con los filtros aplicados. Intenta ajustar la búsqueda.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Mostrando {filtrados.length} de {empleados.length} empleados
          </p>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Ver ficha */}
      {empleadoSeleccionado && !editando && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <EmpleadoDrawer
            empleado={empleadoSeleccionado}
            todosEmpleados={empleados}
            onClose={() => setEmpSeleccionado(null)}
            onEditar={() => { setEditando(empleadoSeleccionado); setEmpSeleccionado(null) }}
            onToggleActivo={() => {
              update(empleadoSeleccionado.id, { activo: !empleadoSeleccionado.activo })
              setEmpSeleccionado(null)
              setToast(empleadoSeleccionado.activo ? 'Empleado dado de baja' : 'Empleado reactivado')
            }}
            onEliminar={() => {
              if (!confirm(`¿Eliminar a ${fullName(empleadoSeleccionado)}? Esta acción no se puede deshacer.`)) return
              remove(empleadoSeleccionado.id)
              setEmpSeleccionado(null)
              setToast('Empleado eliminado')
            }}
          />
        </>
      )}

      {/* Crear — floating modal */}
      {mostrarNuevo && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <EmpleadoFormModal
            mode="crear"
            departamentos={departamentos}
            todosEmpleados={empleados}
            onClose={() => setMostrarNuevo(false)}
            onGuardar={handleAdd}
          />
        </>
      )}

      {/* Editar — floating modal */}
      {editando && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <EmpleadoFormModal
            mode="editar"
            inicial={editando}
            departamentos={departamentos}
            todosEmpleados={empleados}
            selfId={editando.id}
            onClose={() => setEditando(null)}
            onGuardar={handleEdit}
          />
        </>
      )}
    </div>
  )
}
