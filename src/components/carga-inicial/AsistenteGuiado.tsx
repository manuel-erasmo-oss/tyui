'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  PartyPopper,
  UserRound,
  ArrowRight,
  ArrowLeft,
  UserX,
  UserPlus,
  LogOut,
  Info,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { getAnosServicio } from '@/lib/dominican-labor'
import { formatAnosServicio, formatDate, fullName } from '@/lib/utils'
import { EmpleadoFormFields } from '@/components/empleados/EmpleadoFormFields'
import { EMPTY_EMP_FORM, formToEmpleado, validateEmpForm } from '@/lib/empleado-form'
import type { EmpForm } from '@/lib/empleado-form'
import type { Empleado } from '@/types'

interface Props {
  onFinish: () => void
}

const inputCls =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'
const labelCls = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

interface FormState {
  saldoVacacionesInicial: string
  regaliaPagadaEsteAnio: string
  salarioHistoricoReferencia: string
}

const EMPTY_FORM: FormState = {
  saldoVacacionesInicial: '',
  regaliaPagadaEsteAnio: '',
  salarioHistoricoReferencia: '',
}

export function AsistenteGuiado({ onFinish }: Props) {
  const { empleados, empleadosActivos, add, update } = useEmpleados()
  const { empresa } = useEmpresa()

  // Lista viva de pendientes: se recalcula en cada render a partir de
  // empleadosActivos, así que en cuanto `update()` marca a alguien como
  // revisado, desaparece automáticamente de este arreglo.
  const pendientes = useMemo(
    () => empleadosActivos.filter(e => e.saldosInicialesRevisado !== true),
    [empleadosActivos]
  )

  // Total capturado solo en el primer render de esta sesión del asistente,
  // para poder mostrar "Empleado X de Y" aunque Y (pendientes.length) vaya
  // bajando a medida que se avanza.
  const [totalInicial] = useState(() => pendientes.length)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // ─── Alta de empleado nuevo desde el propio asistente ──────────────────────
  // Si el usuario ya se tomó el tiempo de decir que hará la carga inicial
  // manual, debe poder registrar al empleado aquí mismo — con toda la info
  // que el módulo de Empleados necesita — en vez de toparse con un
  // callejón sin salida cuando todavía no existe ni un empleado en el sistema.
  const [modoAlta, setModoAlta] = useState(false)
  const [altaForm, setAltaForm] = useState<EmpForm>(EMPTY_EMP_FORM)
  const [altaErrors, setAltaErrors] = useState<Partial<Record<keyof EmpForm, string>>>({})
  const [creadosEnSesion, setCreadosEnSesion] = useState(0)

  const departamentos = useMemo(() => Array.from(new Set(empleados.map(e => e.departamento))), [empleados])
  const supervisoresDisponibles = useMemo(() => empleados.filter(e => e.activo), [empleados])

  function setAlta<K extends keyof EmpForm>(field: K, value: EmpForm[K]) {
    setAltaForm(prev => ({ ...prev, [field]: value }))
    if (altaErrors[field]) setAltaErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function guardarNuevoEmpleado() {
    const errs = validateEmpForm(altaForm)
    setAltaErrors(errs)
    if (Object.keys(errs).length > 0) return
    add({ ...formToEmpleado(altaForm, empresa.sectorEmpresa), activo: true, saldosInicialesRevisado: true })
    setCreadosEnSesion(c => c + 1)
    setAltaForm(EMPTY_EMP_FORM)
    setAltaErrors({})
  }

  const empleadoActual: Empleado | undefined = pendientes[0]
  const revisados = totalInicial - pendientes.length

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function guardarYContinuar() {
    if (!empleadoActual) return
    const changes: Partial<Empleado> = { saldosInicialesRevisado: true }
    if (form.saldoVacacionesInicial.trim() !== '') {
      changes.saldoVacacionesInicial = Number(form.saldoVacacionesInicial)
    }
    if (form.regaliaPagadaEsteAnio.trim() !== '') {
      changes.regaliaPagadaEsteAnio = Number(form.regaliaPagadaEsteAnio)
    }
    if (form.salarioHistoricoReferencia.trim() !== '') {
      changes.salarioHistoricoReferencia = Number(form.salarioHistoricoReferencia)
    }
    update(empleadoActual.id, changes)
    setForm(EMPTY_FORM)
  }

  function marcarNoAplica() {
    if (!empleadoActual) return
    update(empleadoActual.id, { saldosInicialesRevisado: true })
    setForm(EMPTY_FORM)
  }

  // ─── Estado: registrando un empleado nuevo desde el asistente ──────────────
  if (modoAlta) {
    return (
      <div className="animate-modal-in rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Registrar empleado nuevo
          </span>
          <button
            onClick={() => setModoAlta(false)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>
        </div>

        <EmpleadoFormFields
          form={altaForm}
          set={setAlta}
          errors={altaErrors}
          departamentos={departamentos}
          supervisores={supervisoresDisponibles}
          wide
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-[#1d2035] pt-5">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {creadosEnSesion > 0
              ? `${creadosEnSesion} empleado${creadosEnSesion === 1 ? '' : 's'} agregado${creadosEnSesion === 1 ? '' : 's'} en esta sesión`
              : Object.keys(altaErrors).length > 0
                ? `${Object.keys(altaErrors).length} campo${Object.keys(altaErrors).length > 1 ? 's' : ''} requerido${Object.keys(altaErrors).length > 1 ? 's' : ''}`
                : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModoAlta(false)}
              className="rounded-xl border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              Terminar de agregar
            </button>
            <button
              onClick={guardarNuevoEmpleado}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1B2980]/25 transition-all"
            >
              Guardar y agregar otro <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Estado: nada pendiente desde el inicio ────────────────────────────────
  if (totalInicial === 0) {
    return <TodoAlDia onFinish={onFinish} onAgregar={() => setModoAlta(true)} />
  }

  // ─── Estado: se completó el recorrido de esta sesión ───────────────────────
  if (!empleadoActual) {
    return <Completado cantidad={totalInicial} onFinish={onFinish} onAgregar={() => setModoAlta(true)} />
  }

  const anos = getAnosServicio(empleadoActual.fechaIngreso)

  return (
    <div key={empleadoActual.id} className="animate-modal-in rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)]">
      {/* Progreso */}
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Empleado {revisados + 1} de {totalInicial} pendientes
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setModoAlta(true)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" /> Agregar empleado nuevo
          </button>
          <button
            onClick={onFinish}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] transition-all duration-300"
          style={{ width: `${(revisados / totalInicial) * 100}%` }}
        />
      </div>

      {/* Empleado actual */}
      <div className="mb-6 flex items-center gap-3.5">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-lg dark:bg-indigo-500/25" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
            <UserRound className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
            {fullName(empleadoActual)}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {empleadoActual.cargo} · Ingresó el {formatDate(empleadoActual.fechaIngreso)} · {formatAnosServicio(anos)} de antigüedad
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Vacaciones Pendientes (días)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            className={inputCls}
            value={form.saldoVacacionesInicial}
            onChange={e => set('saldoVacacionesInicial', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Regalía Pagada Este Año (RD$)</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.regaliaPagadaEsteAnio}
            onChange={e => set('regaliaPagadaEsteAnio', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Salario Histórico de Referencia (RD$)</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.salarioHistoricoReferencia}
            onChange={e => set('salarioHistoricoReferencia', e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-zinc-50 dark:bg-[#1a1d2e] px-3.5 py-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400 dark:text-zinc-500" />
        <span>
          El salario histórico se usa solo para Cesantía/Preaviso mientras este empleado no acumule
          12 meses reales de nómina procesada en Cielo Cloud — después el sistema recalcula con datos propios.
        </span>
      </div>

      {/* Acciones */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-[#1d2035] pt-5">
        <button
          onClick={marcarNoAplica}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <UserX className="h-3.5 w-3.5" /> Empleado nuevo, no aplica
        </button>
        <button
          onClick={guardarYContinuar}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1B2980]/25 transition-all"
        >
          Guardar y Continuar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function TodoAlDia({ onFinish, onAgregar }: { onFinish: () => void; onAgregar: () => void }) {
  return (
    <div className="animate-modal-in flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 px-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)]">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#1B2980]/20 blur-xl dark:bg-indigo-500/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
          <CheckCircle2 className="h-7 w-7" />
        </div>
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">¡Todo al día!</p>
      <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
        No hay empleados activos pendientes por revisar. Si ya tienes empleados con historial
        previo, agrégalos aquí mismo para capturar sus saldos iniciales.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onFinish}
          className="rounded-xl border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
        >
          Volver
        </button>
        <button
          onClick={onAgregar}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1B2980]/25 transition-all"
        >
          <UserPlus className="h-4 w-4" /> Agregar empleado nuevo
        </button>
      </div>
    </div>
  )
}

function Completado({ cantidad, onFinish, onAgregar }: { cantidad: number; onFinish: () => void; onAgregar: () => void }) {
  return (
    <div className="animate-modal-in flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 px-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(27,41,128,0.25)] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)]">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#1B2980]/20 blur-xl dark:bg-indigo-500/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
          <PartyPopper className="h-7 w-7" />
        </div>
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
        Listo, revisaste {cantidad} {cantidad === 1 ? 'empleado' : 'empleados'}
      </p>
      <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
        Puedes volver a este asistente en cualquier momento si contratas empleados nuevos con
        historial previo.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onFinish}
          className="rounded-xl border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
        >
          Volver
        </button>
        <button
          onClick={onAgregar}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1B2980]/25 transition-all"
        >
          <UserPlus className="h-4 w-4" /> Agregar empleado nuevo
        </button>
      </div>
    </div>
  )
}
