'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, X, Upload, Download, FileText, Camera, User, Info } from 'lucide-react'
import { CONTRATO_DGT_INFO, parseFechaLocal, hoyLocalISO } from '@/lib/utils'
import {
  BANCOS, AVATAR_COLORS, DOC_TIPOS, PAISES, getPais, formatDocNumber, calcularEdad,
  downloadBase64,
} from '@/lib/empleado-form'
import type { Pais, EmpForm } from '@/lib/empleado-form'
import { EmpleadoAvatar } from './EmpleadoAvatar'
import { fullName } from '@/lib/utils'
import type { Empleado, TipoContrato, TipoDocumento, Banco } from '@/types'

export const inputCls = 'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'
export const labelCls = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

// ── Flag image component ──────────────────────────────────────────────────────
export function FlagImg({ code, className = '' }: { code: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      alt={code}
      className={`h-4 w-6 rounded-sm object-cover shrink-0 ${className}`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

function ContratoDGTNote({ tipo }: { tipo: TipoContrato }) {
  const info = CONTRATO_DGT_INFO[tipo]
  if (!info) return null
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 px-3 py-2">
      <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">
        <strong>Formulario {info.formulario}</strong> ante la DGT · Plazo: {info.plazo}
      </p>
    </div>
  )
}

// ── Nationality selector (custom dropdown with flags) ─────────────────────────
function NacionalidadSelect({
  value, onChange,
}: { value: string; onChange: (code: string, pais: Pais | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = getPais(value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? PAISES.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
    : PAISES

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className={`${inputCls} flex items-center gap-2 text-left`}
      >
        {selected ? (
          <>
            <FlagImg code={selected.code} />
            <span className="flex-1">{selected.nombre}</span>
          </>
        ) : (
          <span className="flex-1 text-zinc-400 dark:text-zinc-500">— Seleccionar —</span>
        )}
        <svg className="h-4 w-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-[#252840]">
            <input
              autoFocus
              type="text"
              placeholder="Buscar país…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-lg bg-zinc-50 dark:bg-[#141722] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.map(p => (
              <li key={p.code}>
                <button
                  type="button"
                  onClick={() => { onChange(p.code, p); setOpen(false); setQuery('') }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-[#252840] transition-colors ${
                    value === p.code ? 'bg-indigo-50 dark:bg-indigo-950/30 text-[#1B2980] dark:text-indigo-300 font-medium' : 'text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <FlagImg code={p.code} className="w-7" />
                  <span className="flex-1 text-left">{p.nombre}</span>
                  {p.code === 'DO' && (
                    <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-medium">Cédula</span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500 text-center">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Supervisor selector (searchable, enabled only when dept is chosen) ────────
function SupervisorSelect({
  value, onChange, candidatos, disabled,
}: {
  value: string
  onChange: (id: string) => void
  candidatos: Empleado[]
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = candidatos.find(e => e.id === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? candidatos.filter(e => fullName(e).toLowerCase().includes(query.toLowerCase()) ||
        e.cargo.toLowerCase().includes(query.toLowerCase()))
    : candidatos

  const triggerCls = disabled
    ? 'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#16192a] px-3 py-2 text-sm text-zinc-400 dark:text-zinc-600 cursor-not-allowed flex items-center gap-2'
    : `${inputCls} flex items-center gap-2 text-left`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery('') } }}
        className={triggerCls}
      >
        {disabled ? (
          <span className="flex-1 italic text-zinc-400 dark:text-zinc-600">Seleccione primero un departamento</span>
        ) : selected ? (
          <>
            <EmpleadoAvatar emp={selected} size="sm" />
            <span className="flex-1 text-left">{fullName(selected)}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{selected.cargo}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="flex-1 text-zinc-400 dark:text-zinc-500">— Sin supervisor asignado —</span>
            <svg className="h-4 w-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-[#252840]">
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nombre o cargo…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-lg bg-zinc-50 dark:bg-[#141722] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#252840] transition-colors italic ${!value ? 'bg-zinc-50 dark:bg-[#252840]' : ''}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600">
                  <X className="h-3.5 w-3.5 text-zinc-400" />
                </span>
                <span>Sin supervisor asignado</span>
              </button>
            </li>
            {filtered.map(emp => (
              <li key={emp.id}>
                <button
                  type="button"
                  onClick={() => { onChange(emp.id); setOpen(false); setQuery('') }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-[#252840] transition-colors ${
                    value === emp.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
                  }`}
                >
                  <EmpleadoAvatar emp={emp} size="sm" />
                  <div className="flex-1 text-left">
                    <p className={`font-medium ${value === emp.id ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {fullName(emp)}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{emp.cargo} · {emp.departamento}</p>
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                No se encontraron empleados
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── File upload row ───────────────────────────────────────────────────────────
export function FileUploadRow({
  label, base64, filename, accept, onUpload, onClear,
}: {
  label: string; base64: string; filename: string; accept: string
  onUpload: (base64: string, name: string) => void; onClear: () => void
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
          <button type="button" onClick={() => downloadBase64(base64, filename)}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300" title="Descargar">
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

interface EmpleadoFormFieldsProps {
  form: EmpForm
  set: <K extends keyof EmpForm>(field: K, value: EmpForm[K]) => void
  errors: Partial<Record<keyof EmpForm, string>>
  departamentos: string[]
  supervisores: Empleado[]
  wide?: boolean
}

// ── Cuerpo del formulario de empleado — sin foto de encabezado/chrome de ventana,
// reutilizable tanto en el modal de Empleados como en flujos de alta embebidos
// (p. ej. el Asistente Guiado de Carga Inicial).
export function EmpleadoFormFields({
  form, set, errors, departamentos, supervisores, wide = false,
}: EmpleadoFormFieldsProps) {
  const fotoRef = useRef<HTMLInputElement>(null)

  function handleNacionalidad(code: string, pais: Pais | undefined) {
    set('nacionalidad', code)
    if (pais) {
      set('tipoDocumento', pais.docDefault)
      set('cedula', '')
    }
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('fotoPerfil', reader.result as string)
    reader.readAsDataURL(file)
  }

  const deptoOpts = departamentos.filter(d => d !== 'Todos')
  const docTipo = DOC_TIPOS.find(t => t.value === form.tipoDocumento)!
  const initials = `${form.nombre[0] ?? '?'}${form.apellido[0] ?? ''}`

  const diasDesdeIngreso = form.fechaIngreso
    ? (Date.now() - parseFechaLocal(form.fechaIngreso).getTime()) / (1000 * 3600 * 24)
    : 0
  const pareceMigracion = diasDesdeIngreso > 45

  return (
    <div className={`space-y-6 ${wide ? 'max-w-3xl mx-auto' : ''}`}>

      {/* Foto de perfil */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Foto de Perfil</h3>
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {form.fotoPerfil ? (
              <img src={form.fotoPerfil} alt="Foto" className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-[#252840]" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white ring-2 ring-zinc-200 dark:ring-[#252840]"
                style={{ backgroundColor: form.avatarColor }}>
                {initials}
              </div>
            )}
            {form.fotoPerfil && (
              <button type="button" onClick={() => set('fotoPerfil', '')}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
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
                  <button key={color} type="button" onClick={() => set('avatarColor', color)}
                    className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${form.avatarColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#141722] ring-zinc-400' : ''}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Datos Personales */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
        <div className="space-y-3">
          <div className={`grid gap-3 ${wide ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
            {wide && (
              <div>
                <label className={labelCls}>Fecha de Nacimiento</label>
                <input type="date" className={inputCls} value={form.fechaNacimiento}
                  onChange={e => set('fechaNacimiento', e.target.value)}
                  max={hoyLocalISO()} />
                {form.fechaNacimiento && (
                  <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{calcularEdad(form.fechaNacimiento)} años</p>
                )}
              </div>
            )}
          </div>

          {/* Nacionalidad — required, full width */}
          <div>
            <label className={labelCls}>
              <Globe className="inline h-3 w-3 mr-1 -mt-0.5" />
              Nacionalidad <span className="text-rose-500">*</span>
            </label>
            <NacionalidadSelect value={form.nacionalidad} onChange={handleNacionalidad} />
            {errors.nacionalidad && <p className="mt-1 text-xs text-rose-500">{errors.nacionalidad}</p>}
            {form.nacionalidad === 'DO' && (
              <p className="mt-1 text-[11px] text-indigo-500 dark:text-indigo-400">
                🇩🇴 Dominicano/a — se requiere Cédula de Identidad
              </p>
            )}
          </div>

          {!wide && (
            <div>
              <label className={labelCls}>Fecha de Nacimiento</label>
              <input type="date" className={inputCls} value={form.fechaNacimiento}
                onChange={e => set('fechaNacimiento', e.target.value)}
                max={hoyLocalISO()} />
              {form.fechaNacimiento && (
                <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{calcularEdad(form.fechaNacimiento)} años</p>
              )}
            </div>
          )}

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

      {/* Documento de Identidad */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Documento de Identidad</h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Tipo de documento <span className="text-rose-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {DOC_TIPOS.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { set('tipoDocumento', t.value); set('cedula', '') }}
                  disabled={form.nacionalidad === 'DO' && t.value !== 'cedula'}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.tipoDocumento === t.value
                      ? 'border-[#1B2980] bg-[#1B2980] text-white dark:border-indigo-600 dark:bg-indigo-600'
                      : 'border-zinc-200 dark:border-[#252840] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {form.nacionalidad === 'DO' && (
              <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                Los ciudadanos dominicanos deben identificarse con cédula
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>
              Número de {docTipo.label}<span className="text-rose-500"> *</span>
              {form.tipoDocumento === 'cedula' && (
                <span className="ml-1 text-zinc-400 font-normal">(11 dígitos)</span>
              )}
            </label>
            <input
              className={inputCls}
              value={form.cedula}
              onChange={e => set('cedula', form.tipoDocumento === 'cedula'
                ? e.target.value.replace(/\D/g, '').slice(0, 11)
                : e.target.value)}
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

      {/* Datos Laborales */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
        <div className="space-y-3">
          <div className={`grid gap-3 ${wide ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
            {wide && (
              <div>
                <label className={labelCls}>Tipo de Contrato <span className="text-rose-500">*</span></label>
                <select className={inputCls} value={form.tipoContrato}
                  onChange={e => set('tipoContrato', e.target.value as TipoContrato)}>
                  <option value="fijo">Fijo (Tiempo Indefinido)</option>
                  <option value="temporal">Temporal</option>
                  <option value="estacional">Estacional / Temporada</option>
                  <option value="ocasional">Móvil / Ocasional</option>
                  <option value="pasante">Pasante</option>
                  <option value="aprendiz">Aprendiz</option>
                  <option value="eventual">Eventual (Obra/Servicio)</option>
                </select>
                <ContratoDGTNote tipo={form.tipoContrato} />
              </div>
            )}
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
          {!wide && (
            <div>
              <label className={labelCls}>Tipo de Contrato <span className="text-rose-500">*</span></label>
              <select className={inputCls} value={form.tipoContrato}
                onChange={e => set('tipoContrato', e.target.value as TipoContrato)}>
                <option value="fijo">Fijo (Tiempo Indefinido)</option>
                <option value="temporal">Temporal</option>
                <option value="estacional">Estacional / Temporada</option>
                <option value="ocasional">Móvil / Ocasional</option>
                <option value="pasante">Pasante</option>
                <option value="aprendiz">Aprendiz</option>
                <option value="eventual">Eventual (Obra/Servicio)</option>
              </select>
              <ContratoDGTNote tipo={form.tipoContrato} />
            </div>
          )}
          <div>
            <label className={labelCls}>
              Supervisor Directo
              {!form.departamento && (
                <span className="ml-1.5 text-amber-500 dark:text-amber-400 font-normal normal-case tracking-normal">
                  — seleccione un departamento primero
                </span>
              )}
            </label>
            <SupervisorSelect
              value={form.supervisorId}
              onChange={id => set('supervisorId', id)}
              candidatos={supervisores}
              disabled={!form.departamento.trim()}
            />
          </div>
          <div>
            <label className="flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.regimenIntermitente}
                onChange={e => set('regimenIntermitente', e.target.checked)}
                className="h-4 w-4 rounded accent-[#1B2980]"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Régimen de trabajo intermitente</span>
            </label>
            {form.regimenIntermitente && (
              <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">
                  <strong>Resolución 04-93 MdT</strong> — jornada de hasta 10h/día y 60h/semana
                  sin generar horas extras bajo esos umbrales (porteros, serenos, guardianes,
                  ascensoristas, mozos/camareros, barberos/manicuristas, empleados de bombas de
                  gasolina). El salario diario de vacaciones se calcula ÷26 en vez de ÷23.83.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Aporte Voluntario a AFP — adicional al 2.87%/7.10% obligatorio */}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Aporte Voluntario a AFP
        </h3>
        <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Opcional — % adicional sobre el salario cotizable AFP, aparte del 2.87%/7.10% obligatorio.
        </p>
        <div className={`grid gap-3 ${wide ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <div>
            <label className={labelCls}>% Adicional del Empleado</label>
            <input type="number" min="0" max="100" step="0.01" className={inputCls}
              value={form.aporteVoluntarioAFPEmpleadoPct}
              onChange={e => set('aporteVoluntarioAFPEmpleadoPct', e.target.value)}
              placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>% Adicional de la Empresa (beneficio)</label>
            <input type="number" min="0" max="100" step="0.01" className={inputCls}
              value={form.aporteVoluntarioAFPEmpresaPct}
              onChange={e => set('aporteVoluntarioAFPEmpresaPct', e.target.value)}
              placeholder="0" />
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          El aporte del empleado se descuenta después del ISR — no reduce su base imponible
          (carta DGII 2022), a diferencia del aporte obligatorio.
        </p>
      </section>

      {/* Grossing-up — empresa asume AFP/SFS/ISR del empleado */}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Empresa Asume ISR/TSS del Empleado
        </h3>
        <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Opcional — % de AFP+SFS+ISR retenidos al empleado que la empresa absorbe como beneficio.
        </p>
        <div>
          <label className={labelCls}>% Absorbido por la Empresa (Grossing-up)</label>
          <input type="number" min="0" max="100" step="0.01" className={inputCls}
            value={form.grossingUpPct}
            onChange={e => set('grossingUpPct', e.target.value)}
            placeholder="0" />
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          La retención y remesa a TSS/DGII no cambia — la empresa reembolsa ese monto al
          empleado vía el neto, absorbiéndolo como costo adicional propio.
        </p>
      </section>

      {/* Retención consolidada de ISR con otro(s) empleador(es) */}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Ingreso de Otro Empleador
        </h3>
        <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Opcional — si el empleado también recibe ingresos de otro empleador, esto ubica el
          tramo de ISR correcto sin afectar TSS ni el neto que paga esta empresa.
        </p>
        <div>
          <label className={labelCls}>Ingreso Mensual de Otro Empleador (RD$)</label>
          <input type="number" min="0" step="0.01" className={inputCls}
            value={form.ingresoOtroEmpleadorMensual}
            onChange={e => set('ingresoOtroEmpleadorMensual', e.target.value)}
            placeholder="0" />
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          Solo consolida la base para ubicar el tramo ISR — esta empresa nunca retiene el ISR
          del ingreso ajeno, únicamente la porción proporcional a lo que ella misma paga.
        </p>
      </section>

      {/* Saldos Iniciales — empleados con historial previo a Cielo Cloud */}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Saldos Iniciales
        </h3>
        <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Solo si este empleado ya trabajaba en la empresa antes de usar Cielo Cloud.
          {pareceMigracion && (
            <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
              La fecha de ingreso sugiere que aplica — complétalos para no partir de cero.
            </span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Vacaciones Pendientes (días)</label>
            <input type="number" min="0" step="0.5" className={inputCls}
              value={form.saldoVacacionesInicial}
              onChange={e => set('saldoVacacionesInicial', e.target.value)}
              placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Regalía Pagada Este Año (RD$)</label>
            <input type="number" min="0" className={inputCls}
              value={form.regaliaPagadaEsteAnio}
              onChange={e => set('regaliaPagadaEsteAnio', e.target.value)}
              placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Salario Histórico de Referencia (RD$)</label>
            <input type="number" min="0" className={inputCls}
              value={form.salarioHistoricoReferencia}
              onChange={e => set('salarioHistoricoReferencia', e.target.value)}
              placeholder="Opcional" />
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          El salario histórico se usa para Cesantía/Preaviso/Asistencia Económica solo
          mientras el empleado no acumule 12 meses de nómina procesada en Cielo Cloud —
          después se recalcula con datos reales del sistema.
        </p>
      </section>

      {/* Datos Bancarios */}
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

      {/* Contrato Laboral */}
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
  )
}
