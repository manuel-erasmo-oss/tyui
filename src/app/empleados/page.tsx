'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, ChevronRight, Building2, Mail, Phone, X, Pencil,
  Upload, Download, FileText, Camera, User, Calendar, CreditCard,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularCesantia, calcularPreaviso, getAnosServicio } from '@/lib/dominican-labor'
import {
  formatRD, formatDate, formatAnosServicio,
  fullName, contratoBadgeClass, contratoLabel,
} from '@/lib/utils'
import type { Empleado, TipoContrato, Banco, TipoDocumento } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const BANCOS: Banco[] = ['Banco Popular', 'BanReservas', 'Scotiabank', 'BHD León', 'Banistmo', 'Otro']

const AVATAR_COLORS = [
  '#1B2980', '#059669', '#D97706', '#E11D48', '#7C3AED', '#0891B2',
]

const DOC_TIPOS: { value: TipoDocumento; label: string; placeholder: string }[] = [
  { value: 'cedula',          label: 'Cédula',             placeholder: '00112345678' },
  { value: 'pasaporte',       label: 'Pasaporte',          placeholder: 'A1234567' },
  { value: 'residencia',      label: 'Residencia',         placeholder: 'RES-2024-00001' },
  { value: 'permiso_trabajo', label: 'Permiso de trabajo', placeholder: 'PT-2024-00001' },
]

const inputCls = 'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'
const labelCls = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDocNumber(num: string, tipo?: TipoDocumento): string {
  if ((tipo ?? 'cedula') === 'cedula') {
    const d = num.replace(/\D/g, '')
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
  }
  return num.toUpperCase()
}

function labelTipoDoc(tipo?: TipoDocumento): string {
  return DOC_TIPOS.find(t => t.value === (tipo ?? 'cedula'))?.label ?? 'Cédula'
}

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  }
  return map[ext] ?? 'application/octet-stream'
}

function downloadBase64(base64: string, filename: string) {
  const mime = getMime(filename)
  const byteStr = atob(base64)
  const ab = new ArrayBuffer(byteStr.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
  const blob = new Blob([ab], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Shared avatar component ───────────────────────────────────────────────────
function EmpleadoAvatar({
  emp, size = 'md', className = '',
}: { emp: Empleado; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm'
  if (emp.fotoPerfil) {
    return (
      <img
        src={emp.fotoPerfil}
        alt={fullName(emp)}
        className={`${dim} rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ backgroundColor: emp.avatarColor ?? (emp.activo ? '#1B2980' : '#6b7280') }}
    >
      {emp.nombre[0]}{emp.apellido[0]}
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────
interface EmpForm {
  nombre: string; apellido: string
  tipoDocumento: TipoDocumento; cedula: string
  fechaNacimiento: string
  email: string; telefono: string
  cargo: string; departamento: string
  fechaIngreso: string; salarioBase: string
  tipoContrato: TipoContrato
  supervisorId: string
  banco: Banco | ''; numeroCuenta: string
  avatarColor: string
  fotoPerfil: string         // full data URL or empty
  documentoIdentidad: string // base64 content
  documentoIdentidadNombre: string
  contratoLaboral: string    // base64 content
  contratoLaboralNombre: string
}

const EMPTY: EmpForm = {
  nombre: '', apellido: '', tipoDocumento: 'cedula', cedula: '',
  fechaNacimiento: '', email: '', telefono: '',
  cargo: '', departamento: '', fechaIngreso: '', salarioBase: '',
  tipoContrato: 'indefinido', supervisorId: '',
  banco: '', numeroCuenta: '', avatarColor: '#1B2980',
  fotoPerfil: '', documentoIdentidad: '', documentoIdentidadNombre: '',
  contratoLaboral: '', contratoLaboralNombre: '',
}

function toForm(e: Empleado): EmpForm {
  return {
    nombre: e.nombre, apellido: e.apellido,
    tipoDocumento: e.tipoDocumento ?? 'cedula', cedula: e.cedula,
    fechaNacimiento: e.fechaNacimiento ?? '',
    email: e.email ?? '', telefono: e.telefono ?? '',
    cargo: e.cargo, departamento: e.departamento,
    fechaIngreso: e.fechaIngreso, salarioBase: String(e.salarioBase),
    tipoContrato: e.tipoContrato, supervisorId: e.supervisorId ?? '',
    banco: e.banco ?? '', numeroCuenta: e.numeroCuenta ?? '',
    avatarColor: e.avatarColor ?? '#1B2980',
    fotoPerfil: e.fotoPerfil ?? '',
    documentoIdentidad: e.documentoIdentidad ?? '',
    documentoIdentidadNombre: e.documentoIdentidadNombre ?? '',
    contratoLaboral: e.contratoLaboral ?? '',
    contratoLaboralNombre: e.contratoLaboralNombre ?? '',
  }
}

// ── File upload helper ────────────────────────────────────────────────────────
function FileUploadRow({
  label, base64, filename, accept, onUpload, onClear,
}: {
  label: string
  base64: string
  filename: string
  accept: string
  onUpload: (base64: string, name: string) => void
  onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      onUpload(result.split(',')[1], file.name)
    }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {base64 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
          <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="flex-1 truncate text-xs text-emerald-700 dark:text-emerald-300">{filename}</span>
          <button
            type="button"
            onClick={() => downloadBase64(base64, filename)}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"
            title="Descargar"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClear} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors">
          <Upload className="h-4 w-4 shrink-0" />
          <span>Adjuntar archivo…</span>
          <input ref={ref} type="file" accept={accept} className="sr-only" onChange={handleChange} />
        </label>
      )}
    </div>
  )
}

// ── Form Drawer ───────────────────────────────────────────────────────────────
function EmpleadoFormDrawer({
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
  const [form, setForm] = useState<EmpForm>(inicial ? toForm(inicial) : EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof EmpForm, string>>>({})
  const fotoRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof EmpForm>(field: K, value: EmpForm[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.nombre.trim())       e.nombre       = 'Requerido'
    if (!form.apellido.trim())     e.apellido     = 'Requerido'
    if (!form.cargo.trim())        e.cargo        = 'Requerido'
    if (!form.departamento.trim()) e.departamento = 'Requerido'
    if (!form.fechaIngreso)        e.fechaIngreso = 'Requerido'
    if (!form.salarioBase || isNaN(Number(form.salarioBase)) || Number(form.salarioBase) <= 0)
      e.salarioBase = 'Monto válido requerido'
    if (!form.cedula.trim()) {
      e.cedula = 'Requerido'
    } else if (form.tipoDocumento === 'cedula') {
      const digits = form.cedula.replace(/\D/g, '')
      if (digits.length !== 11) e.cedula = 'La cédula debe tener exactamente 11 dígitos'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onGuardar(form)
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('fotoPerfil', reader.result as string)
    reader.readAsDataURL(file)
  }

  const deptoOpts = departamentos.filter(d => d !== 'Todos')
  const supervisores = todosEmpleados.filter(e => e.id !== selfId && e.activo)
  const docTipo = DOC_TIPOS.find(t => t.value === form.tipoDocumento)!
  const initials = `${form.nombre[0] ?? '?'}${form.apellido[0] ?? ''}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {mode === 'editar' ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {mode === 'editar' ? 'Modifica los datos del colaborador' : 'Complete los datos del nuevo colaborador'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1f2235] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 space-y-6">

            {/* ── Foto de perfil ──────────────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Foto de Perfil</h3>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="relative shrink-0">
                  {form.fotoPerfil ? (
                    <img
                      src={form.fotoPerfil}
                      alt="Foto de perfil"
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-[#252840]"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white ring-2 ring-zinc-200 dark:ring-[#252840]"
                      style={{ backgroundColor: form.avatarColor }}
                    >
                      {initials}
                    </div>
                  )}
                  {form.fotoPerfil && (
                    <button
                      type="button"
                      onClick={() => set('fotoPerfil', '')}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors w-fit">
                    <Camera className="h-3.5 w-3.5" />
                    {form.fotoPerfil ? 'Cambiar foto' : 'Subir foto'}
                    <input ref={fotoRef} type="file" accept="image/*" className="sr-only" onChange={handleFotoChange} />
                  </label>
                  <div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5">Color de avatar (si no hay foto)</p>
                    <div className="flex gap-2">
                      {AVATAR_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => set('avatarColor', color)}
                          className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${form.avatarColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#141722] ring-zinc-400' : ''}`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Datos Personales ────────────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nombre <span className="text-rose-500">*</span></label>
                    <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan" />
                    {errors.nombre && <p className="mt-1 text-xs text-rose-500">{errors.nombre}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Apellido <span className="text-rose-500">*</span></label>
                    <input className={inputCls} value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="Pérez García" />
                    {errors.apellido && <p className="mt-1 text-xs text-rose-500">{errors.apellido}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fecha de Nacimiento</label>
                  <input type="date" className={inputCls} value={form.fechaNacimiento}
                    onChange={e => set('fechaNacimiento', e.target.value)}
                    max={new Date().toISOString().split('T')[0]} />
                  {form.fechaNacimiento && (
                    <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      {calcularEdad(form.fechaNacimiento)} años
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Correo electrónico</label>
                    <input type="email" className={inputCls} value={form.email}
                      onChange={e => set('email', e.target.value)} placeholder="juan@empresa.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input className={inputCls} value={form.telefono}
                      onChange={e => set('telefono', e.target.value)} placeholder="809-000-0000" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Documento de Identidad ──────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Documento de Identidad</h3>
              <div className="space-y-3">
                {/* Type selector */}
                <div>
                  <label className={labelCls}>Tipo de documento <span className="text-rose-500">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {DOC_TIPOS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { set('tipoDocumento', t.value); set('cedula', '') }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          form.tipoDocumento === t.value
                            ? 'border-[#1B2980] bg-[#1B2980] text-white dark:border-indigo-600 dark:bg-indigo-600'
                            : 'border-zinc-200 dark:border-[#252840] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number */}
                <div>
                  <label className={labelCls}>
                    Número de {docTipo.label}
                    <span className="text-rose-500"> *</span>
                    {form.tipoDocumento === 'cedula' && (
                      <span className="ml-1 text-zinc-400 font-normal">(11 dígitos)</span>
                    )}
                  </label>
                  <input
                    className={inputCls}
                    value={form.cedula}
                    onChange={e => set('cedula', form.tipoDocumento === 'cedula' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
                    placeholder={docTipo.placeholder}
                    inputMode={form.tipoDocumento === 'cedula' ? 'numeric' : 'text'}
                  />
                  {errors.cedula
                    ? <p className="mt-1 text-xs text-rose-500">{errors.cedula}</p>
                    : form.tipoDocumento === 'cedula' && form.cedula.length > 0 && (
                      <p className={`mt-1 text-[11px] ${form.cedula.length === 11 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        {form.cedula.length}/11 dígitos
                        {form.cedula.length === 11 && ` · ${formatDocNumber(form.cedula, 'cedula')}`}
                      </p>
                    )}
                </div>

                {/* Document scan */}
                <FileUploadRow
                  label={`Escaneo de ${docTipo.label} (PDF o imagen)`}
                  base64={form.documentoIdentidad}
                  filename={form.documentoIdentidadNombre}
                  accept=".pdf,image/*"
                  onUpload={(b64, name) => { set('documentoIdentidad', b64); set('documentoIdentidadNombre', name) }}
                  onClear={() => { set('documentoIdentidad', ''); set('documentoIdentidadNombre', '') }}
                />
              </div>
            </section>

            {/* ── Datos Laborales ─────────────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Cargo <span className="text-rose-500">*</span></label>
                    <input className={inputCls} value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Gerente de Ventas" />
                    {errors.cargo && <p className="mt-1 text-xs text-rose-500">{errors.cargo}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Departamento <span className="text-rose-500">*</span></label>
                    <input list="deptos-list" className={inputCls} value={form.departamento}
                      onChange={e => set('departamento', e.target.value)} placeholder="Ventas" />
                    <datalist id="deptos-list">{deptoOpts.map(d => <option key={d} value={d} />)}</datalist>
                    {errors.departamento && <p className="mt-1 text-xs text-rose-500">{errors.departamento}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Fecha de Ingreso <span className="text-rose-500">*</span></label>
                    <input type="date" className={inputCls} value={form.fechaIngreso}
                      onChange={e => set('fechaIngreso', e.target.value)} />
                    {errors.fechaIngreso && <p className="mt-1 text-xs text-rose-500">{errors.fechaIngreso}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Salario Base (RD$) <span className="text-rose-500">*</span></label>
                    <input type="number" min="0" className={inputCls} value={form.salarioBase}
                      onChange={e => set('salarioBase', e.target.value)} placeholder="25000" />
                    {errors.salarioBase && <p className="mt-1 text-xs text-rose-500">{errors.salarioBase}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Tipo de Contrato <span className="text-rose-500">*</span></label>
                  <select className={inputCls} value={form.tipoContrato}
                    onChange={e => set('tipoContrato', e.target.value as TipoContrato)}>
                    <option value="indefinido">Indefinido</option>
                    <option value="tiempo_determinado">Tiempo Determinado</option>
                    <option value="obra_servicio">Obra o Servicio</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Supervisor Directo</label>
                  <select className={inputCls} value={form.supervisorId}
                    onChange={e => set('supervisorId', e.target.value)}>
                    <option value="">— Sin supervisor asignado —</option>
                    {supervisores.map(s => (
                      <option key={s.id} value={s.id}>{fullName(s)} · {s.cargo}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* ── Datos Bancarios ─────────────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Bancarios</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Banco</label>
                  <select className={inputCls} value={form.banco} onChange={e => set('banco', e.target.value as Banco | '')}>
                    <option value="">— Seleccionar —</option>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N° de Cuenta</label>
                  <input className={inputCls} value={form.numeroCuenta}
                    onChange={e => set('numeroCuenta', e.target.value)} placeholder="000-000000-0" />
                </div>
              </div>
            </section>

            {/* ── Contrato Laboral ────────────────────────────────────────── */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Contrato Laboral</h3>
              <FileUploadRow
                label="Contrato firmado (PDF)"
                base64={form.contratoLaboral}
                filename={form.contratoLaboralNombre}
                accept=".pdf,application/pdf"
                onUpload={(b64, name) => { set('contratoLaboral', b64); set('contratoLaboralNombre', name) }}
                onClear={() => { set('contratoLaboral', ''); set('contratoLaboralNombre', '') }}
              />
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                El documento se almacena localmente en este dispositivo.
              </p>
            </section>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors">
              {mode === 'editar' ? 'Guardar Cambios' : 'Registrar Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── View Drawer ───────────────────────────────────────────────────────────────
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
  const anos     = getAnosServicio(empleado.fechaIngreso)
  const cesantia = calcularCesantia(empleado.salarioBase, anos)
  const preaviso = calcularPreaviso(empleado.salarioBase, anos)
  const supervisor = todosEmpleados.find(e => e.id === empleado.supervisorId)

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
          {/* Header */}
          <div className="flex items-center gap-4">
            <EmpleadoAvatar emp={empleado} size="lg" />
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge className={`ring-1 ${contratoBadgeClass(empleado.tipoContrato)}`}>
                  {contratoLabel(empleado.tipoContrato)}
                </Badge>
                <Badge variant={empleado.activo ? 'success' : 'neutral'}>
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Personal data */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
            <div className="space-y-2.5">
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
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{empleado.email}</span>
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
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fullName(supervisor)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Labor data */}
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

          {/* Documents */}
          {(empleado.documentoIdentidad || empleado.contratoLaboral) && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Documentos</h3>
              <div className="space-y-2">
                {empleado.documentoIdentidad && empleado.documentoIdentidadNombre && (
                  <button
                    type="button"
                    onClick={() => downloadBase64(empleado.documentoIdentidad!, empleado.documentoIdentidadNombre!)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                  >
                    <FileText className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{labelTipoDoc(empleado.tipoDocumento)} — escaneo</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.documentoIdentidadNombre}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  </button>
                )}
                {empleado.contratoLaboral && empleado.contratoLaboralNombre && (
                  <button
                    type="button"
                    onClick={() => downloadBase64(empleado.contratoLaboral!, empleado.contratoLaboralNombre!)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                  >
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Contrato Laboral</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.contratoLaboralNombre}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Derechos */}
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
                { label: 'Regalía Pascual',   sub: 'Art. 219 — 1/12 anual/mes',     value: empleado.salarioBase / 12, color: 'text-emerald-600 dark:text-emerald-400' },
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

  // Keep the view drawer in sync if the list updates while it's open
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

  function formToEmpleado(form: EmpForm): Omit<Empleado, 'id' | 'activo'> {
    return {
      nombre:          form.nombre.trim(),
      apellido:        form.apellido.trim(),
      cedula:          form.tipoDocumento === 'cedula'
                         ? form.cedula.replace(/\D/g, '')
                         : form.cedula.trim().toUpperCase(),
      tipoDocumento:   form.tipoDocumento,
      fechaNacimiento: form.fechaNacimiento || undefined,
      supervisorId:    form.supervisorId || undefined,
      avatarColor:     form.avatarColor,
      fotoPerfil:      form.fotoPerfil || undefined,
      documentoIdentidad:      form.documentoIdentidad || undefined,
      documentoIdentidadNombre: form.documentoIdentidadNombre || undefined,
      contratoLaboral:         form.contratoLaboral || undefined,
      contratoLaboralNombre:   form.contratoLaboralNombre || undefined,
      cargo:           form.cargo.trim(),
      departamento:    form.departamento.trim(),
      fechaIngreso:    form.fechaIngreso,
      salarioBase:     Number(form.salarioBase),
      tipoContrato:    form.tipoContrato,
      email:           form.email.trim() || undefined,
      telefono:        form.telefono.trim() || undefined,
      banco:           (form.banco as Banco) || undefined,
      numeroCuenta:    form.numeroCuenta.trim() || undefined,
      categoriaRiesgo: 'bajo',
    }
  }

  function handleAdd(form: EmpForm) {
    add({ ...formToEmpleado(form), activo: true })
    setMostrarNuevo(false)
    setToast('Empleado registrado exitosamente')
  }

  function handleEdit(form: EmpForm) {
    if (!editando) return
    update(editando.id, formToEmpleado(form))
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
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
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

        {/* Table */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {['Empleado', 'Documento', 'Departamento', 'Tipo Contrato', 'Ingreso'].map(h => (
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
                        <EmpleadoAvatar emp={emp} size="sm" />
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{formatDocNumber(emp.cedula, emp.tipoDocumento)}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{labelTipoDoc(emp.tipoDocumento)}</p>
                    </td>
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

      {/* Crear */}
      {mostrarNuevo && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm" />
          <EmpleadoFormDrawer
            mode="crear"
            departamentos={departamentos}
            todosEmpleados={empleados}
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
