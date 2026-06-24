'use client'

import { useState, useEffect } from 'react'
import {
  Search, Plus, ChevronRight, Building2, Mail, Phone, CreditCard, X, Pencil,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularCesantia, calcularPreaviso, getAnosServicio } from '@/lib/dominican-labor'
import {
  formatRD, formatDate, formatCedula, formatAnosServicio,
  fullName, contratoBadgeClass, contratoLabel,
} from '@/lib/utils'
import type { Empleado, TipoContrato, Banco } from '@/types'

const BANCOS: Banco[] = ['Banco Popular', 'BanReservas', 'Scotiabank', 'BHD León', 'Banistmo', 'Otro']

const inputCls = 'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'
const labelCls = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

interface EmpleadoForm {
  nombre: string; apellido: string; cedula: string; cargo: string
  departamento: string; fechaIngreso: string; salarioBase: string
  tipoContrato: TipoContrato; email: string; telefono: string
  banco: Banco | ''; numeroCuenta: string
}

const FORM_EMPTY: EmpleadoForm = {
  nombre: '', apellido: '', cedula: '', cargo: '', departamento: '',
  fechaIngreso: '', salarioBase: '', tipoContrato: 'indefinido',
  email: '', telefono: '', banco: '', numeroCuenta: '',
}

function toForm(e: Empleado): EmpleadoForm {
  return {
    nombre: e.nombre, apellido: e.apellido, cedula: e.cedula,
    cargo: e.cargo, departamento: e.departamento, fechaIngreso: e.fechaIngreso,
    salarioBase: String(e.salarioBase), tipoContrato: e.tipoContrato,
    email: e.email ?? '', telefono: e.telefono ?? '',
    banco: e.banco ?? '', numeroCuenta: e.numeroCuenta ?? '',
  }
}

// ── Form drawer (crear o editar) ──────────────────────────────────────────────
function EmpleadoFormDrawer({
  mode, inicial, departamentos, onClose, onGuardar,
}: {
  mode: 'crear' | 'editar'
  inicial?: Empleado
  departamentos: string[]
  onClose: () => void
  onGuardar: (data: EmpleadoForm) => void
}) {
  const [form, setForm] = useState<EmpleadoForm>(inicial ? toForm(inicial) : FORM_EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof EmpleadoForm, string>>>({})

  function set(field: keyof EmpleadoForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.nombre.trim())       e.nombre       = 'Requerido'
    if (!form.apellido.trim())     e.apellido     = 'Requerido'
    if (!form.cedula.trim())       e.cedula       = 'Requerido'
    if (!form.cargo.trim())        e.cargo        = 'Requerido'
    if (!form.departamento.trim()) e.departamento = 'Requerido'
    if (!form.fechaIngreso)        e.fechaIngreso = 'Requerido'
    if (!form.salarioBase || isNaN(Number(form.salarioBase)) || Number(form.salarioBase) <= 0)
                                   e.salarioBase  = 'Monto válido requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onGuardar(form)
  }

  const deptoOpts = departamentos.filter(d => d !== 'Todos')
  const isEditar  = mode === 'editar'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-md overflow-y-auto bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isEditar ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {isEditar ? 'Modifica los datos del colaborador' : 'Complete los datos del nuevo colaborador'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1f2235] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 space-y-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre <span className="text-rose-500">*</span></label>
                  <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan" />
                  {errors.nombre && <p className="mt-1 text-xs text-rose-500">{errors.nombre}</p>}
                </div>
                <div>
                  <label className={labelCls}>Apellido <span className="text-rose-500">*</span></label>
                  <input className={inputCls} value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="Pérez" />
                  {errors.apellido && <p className="mt-1 text-xs text-rose-500">{errors.apellido}</p>}
                </div>
              </div>
              <div className="mt-3">
                <label className={labelCls}>Cédula <span className="text-rose-500">*</span></label>
                <input className={inputCls} value={form.cedula} onChange={e => set('cedula', e.target.value)} placeholder="001-1234567-8" />
                {errors.cedula && <p className="mt-1 text-xs text-rose-500">{errors.cedula}</p>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Correo electrónico</label>
                  <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@empresa.com" />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input className={inputCls} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="809-000-0000" />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cargo <span className="text-rose-500">*</span></label>
                  <input className={inputCls} value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Gerente" />
                  {errors.cargo && <p className="mt-1 text-xs text-rose-500">{errors.cargo}</p>}
                </div>
                <div>
                  <label className={labelCls}>Departamento <span className="text-rose-500">*</span></label>
                  <input list="deptos-list" className={inputCls} value={form.departamento}
                    onChange={e => set('departamento', e.target.value)} placeholder="Seleccionar o escribir" />
                  <datalist id="deptos-list">{deptoOpts.map(d => <option key={d} value={d} />)}</datalist>
                  {errors.departamento && <p className="mt-1 text-xs text-rose-500">{errors.departamento}</p>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha de Ingreso <span className="text-rose-500">*</span></label>
                  <input type="date" className={inputCls} value={form.fechaIngreso} onChange={e => set('fechaIngreso', e.target.value)} />
                  {errors.fechaIngreso && <p className="mt-1 text-xs text-rose-500">{errors.fechaIngreso}</p>}
                </div>
                <div>
                  <label className={labelCls}>Salario Base (RD$) <span className="text-rose-500">*</span></label>
                  <input type="number" min="0" className={inputCls} value={form.salarioBase}
                    onChange={e => set('salarioBase', e.target.value)} placeholder="25000" />
                  {errors.salarioBase && <p className="mt-1 text-xs text-rose-500">{errors.salarioBase}</p>}
                </div>
              </div>
              <div className="mt-3">
                <label className={labelCls}>Tipo de Contrato <span className="text-rose-500">*</span></label>
                <select className={inputCls} value={form.tipoContrato}
                  onChange={e => set('tipoContrato', e.target.value as TipoContrato)}>
                  <option value="indefinido">Indefinido</option>
                  <option value="tiempo_determinado">Tiempo Determinado</option>
                  <option value="obra_servicio">Obra o Servicio</option>
                </select>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Bancarios</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Banco</label>
                  <select className={inputCls} value={form.banco} onChange={e => set('banco', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N° de Cuenta</label>
                  <input className={inputCls} value={form.numeroCuenta}
                    onChange={e => set('numeroCuenta', e.target.value)} placeholder="0000000000" />
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors">
              {isEditar ? 'Guardar Cambios' : 'Guardar Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── View drawer ───────────────────────────────────────────────────────────────
function EmpleadoDrawer({
  empleado, onClose, onEditar, onToggleActivo, onEliminar,
}: {
  empleado: Empleado
  onClose: () => void
  onEditar: () => void
  onToggleActivo: () => void
  onEliminar: () => void
}) {
  const anos     = getAnosServicio(empleado.fechaIngreso)
  const cesantia = calcularCesantia(empleado.salarioBase, anos)
  const preaviso = calcularPreaviso(empleado.salarioBase, anos)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-md overflow-y-auto bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Ficha del Empleado</h2>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1f2235] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1B2980] text-lg font-bold text-white">
              {empleado.nombre[0]}{empleado.apellido[0]}
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
              <Badge className={`mt-1 ring-1 ${contratoBadgeClass(empleado.tipoContrato)}`}>
                {contratoLabel(empleado.tipoContrato)}
              </Badge>
            </div>
          </div>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Generales</h3>
            <div className="space-y-2.5">
              {[
                { icon: CreditCard, label: 'Cédula',      value: formatCedula(empleado.cedula) },
                { icon: Mail,       label: 'Correo',       value: empleado.email ?? '—' },
                { icon: Phone,      label: 'Teléfono',     value: empleado.telefono ?? '—' },
                { icon: Building2,  label: 'Departamento', value: empleado.departamento },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <row.icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">{row.label}</span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Fecha de Ingreso', value: formatDate(empleado.fechaIngreso) },
                { label: 'Antigüedad',       value: formatAnosServicio(anos) },
                { label: 'Salario Mensual',  value: formatRD(empleado.salarioBase, 0) },
                { label: 'Salario Anual',    value: formatRD(empleado.salarioBase * 12, 0) },
                { label: 'Banco',            value: empleado.banco ?? '—' },
                { label: 'N° Cuenta',        value: empleado.numeroCuenta ?? '—' },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase text-zinc-400 dark:text-zinc-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Derechos (Estimado Acumulado)
            </h3>
            <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
              Cálculo conforme a Ley 16-92 · Código de Trabajo
            </p>
            <div className="space-y-2">
              {[
                { label: 'Cesantía estimada', sub: 'Art. 80 — Auxilio de cesantía', value: cesantia, color: 'text-rose-600 dark:text-rose-400' },
                { label: 'Preaviso',          sub: 'Art. 76 — Desahucio',           value: preaviso, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Regalía Pascual',   sub: 'Art. 219 — 1/12 anual/mes',    value: empleado.salarioBase / 12, color: 'text-emerald-600 dark:text-emerald-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{r.sub}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${r.color}`}>{formatRD(r.value, 0)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <button onClick={onEliminar}
            className="rounded-lg border border-rose-200 dark:border-rose-800/50 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
            Eliminar
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onEditar}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button onClick={onToggleActivo}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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
  const [busqueda, setBusqueda]                   = useState('')
  const [departamento, setDepartamento]           = useState('Todos')
  const [mostrarInactivos, setMostrarInactivos]   = useState(false)
  const [empleadoSeleccionado, setEmpSeleccionado] = useState<Empleado | null>(null)
  const [mostrarNuevo, setMostrarNuevo]           = useState(false)
  const [editando, setEditando]                   = useState<Empleado | null>(null)
  const [toast, setToast]                         = useState<string | null>(null)

  // Abrir formulario si sidebar navegó con ?nuevo=1
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('nuevo=1')) {
      setMostrarNuevo(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const departamentos = ['Todos', ...new Set(empleados.map(e => e.departamento))]

  const filtrados = empleados.filter(e => {
    const nombre = fullName(e).toLowerCase()
    const matchBusqueda =
      nombre.includes(busqueda.toLowerCase()) ||
      e.cedula.includes(busqueda) ||
      e.cargo.toLowerCase().includes(busqueda.toLowerCase())
    const matchDepto  = departamento === 'Todos' || e.departamento === departamento
    const matchActivo = mostrarInactivos ? true : e.activo
    return matchBusqueda && matchDepto && matchActivo
  })

  function handleAdd(form: EmpleadoForm) {
    add({
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      cedula: form.cedula.trim().replace(/\D/g, ''),
      cargo: form.cargo.trim(), departamento: form.departamento.trim(),
      fechaIngreso: form.fechaIngreso, salarioBase: Number(form.salarioBase),
      tipoContrato: form.tipoContrato, activo: true,
      email: form.email.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      banco: form.banco || undefined,
      numeroCuenta: form.numeroCuenta.trim() || undefined,
      categoriaRiesgo: 'bajo',
    })
    setMostrarNuevo(false)
    setToast('Empleado registrado exitosamente ✓')
  }

  function handleEdit(form: EmpleadoForm) {
    if (!editando) return
    update(editando.id, {
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      cedula: form.cedula.trim().replace(/\D/g, ''),
      cargo: form.cargo.trim(), departamento: form.departamento.trim(),
      fechaIngreso: form.fechaIngreso, salarioBase: Number(form.salarioBase),
      tipoContrato: form.tipoContrato,
      email: form.email.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      banco: (form.banco as Banco) || undefined,
      numeroCuenta: form.numeroCuenta.trim() || undefined,
    })
    setEditando(null)
    setToast('Cambios guardados ✓')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Empleados"
        subtitle={`${empleados.filter(e => e.activo).length} activos · ${empleados.filter(e => !e.activo).length} inactivos`}
        actions={
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Filtros */}
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula o cargo…"
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

        {/* Tabla */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {['Empleado','Cédula','Departamento','Tipo Contrato','Ingreso'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Base</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filtrados.map(emp => (
                  <tr key={emp.id}
                    className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors cursor-pointer"
                    onClick={() => setEmpSeleccionado(emp)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${emp.activo ? 'bg-[#d5d9f4] text-[#151f66] dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-500'}`}>
                          {emp.nombre[0]}{emp.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">{formatCedula(emp.cedula)}</td>
                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{emp.departamento}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${contratoBadgeClass(emp.tipoContrato)}`}>
                        {contratoLabel(emp.tipoContrato)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{formatDate(emp.fechaIngreso)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(emp.salarioBase, 0)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={emp.activo ? 'success' : 'neutral'}>{emp.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    No se encontraron empleados con los filtros aplicados
                  </td></tr>
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
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm" />
          <EmpleadoDrawer
            empleado={empleadoSeleccionado}
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

      {/* Crear */}
      {mostrarNuevo && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm" />
          <EmpleadoFormDrawer
            mode="crear"
            departamentos={departamentos}
            onClose={() => setMostrarNuevo(false)}
            onGuardar={handleAdd}
          />
        </>
      )}

      {/* Editar */}
      {editando && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm" />
          <EmpleadoFormDrawer
            mode="editar"
            inicial={editando}
            departamentos={departamentos}
            onClose={() => setEditando(null)}
            onGuardar={handleEdit}
          />
        </>
      )}
    </div>
  )
}
