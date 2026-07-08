'use client'

import { useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { SALARIO_MINIMO, TASAS_TSS, TOPE_COTIZABLE_AFP, TOPE_COTIZABLE_SFS, TOPE_COTIZABLE_SRL } from '@/lib/dominican-labor'
import { formatRD, formatDate } from '@/lib/utils'
import {
  Save, Info, Building2, FlaskConical, AlertTriangle, ImagePlus, Trash2, History,
  Wallet, ShieldCheck, ArrowLeft, ArrowRight, SlidersHorizontal, Mail, PartyPopper, Plus,
} from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { useAuth } from '@/lib/auth-context'
import { useFeriados } from '@/lib/feriados-context'
import { Toast } from '@/components/ui/Toast'
import { cargarDatosDemo } from '@/lib/seed-data'
import { ConfiguracionInicialFlow } from '@/components/carga-inicial/ConfiguracionInicialFlow'
import { PLACEHOLDERS_COMPROBANTE, plantillaComprobanteDefault } from '@/lib/comprobante-email'
import {
  UMBRAL_ENDEUDAMIENTO_DEFAULT, UMBRAL_VARIACION_BRUTO_DEFAULT,
  type Empresa, type CategoriaEmpresa, type SectorEmpresa, type RolUsuario,
} from '@/types'

interface ParamRow {
  label: string
  value: string
  descripcion: string
  fuente: string
}

const PARAMS_TSS: ParamRow[] = [
  {
    label: 'AFP Empleado',
    value: `${(TASAS_TSS.afpEmpleado * 100).toFixed(2)}%`,
    descripcion: 'Descuento al empleado para fondo de pensiones',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'AFP Empleador',
    value: `${(TASAS_TSS.afpEmpleador * 100).toFixed(2)}%`,
    descripcion: 'Aporte patronal al fondo de pensiones',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SFS Empleado',
    value: `${(TASAS_TSS.sfsEmpleado * 100).toFixed(2)}%`,
    descripcion: 'Descuento al empleado para salud familiar',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SFS Empleador',
    value: `${(TASAS_TSS.sfsEmpleador * 100).toFixed(2)}%`,
    descripcion: 'Aporte patronal al seguro familiar de salud',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Categoría I',
    value: `${(TASAS_TSS.srlCategoriaI * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — oficinas y comercio (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Categoría II',
    value: `${(TASAS_TSS.srlCategoriaII * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — industria liviana (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Categoría III',
    value: `${(TASAS_TSS.srlCategoriaIII * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — industria pesada (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Categoría IV',
    value: `${(TASAS_TSS.srlCategoriaIV * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — construcción y minería, alto riesgo (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'Infotep',
    value: `${(TASAS_TSS.infotepEmpleador * 100).toFixed(2)}%`,
    descripcion: 'Aporte obligatorio del empleador para formación técnico-profesional',
    fuente: 'INFOTEP — Ley 116-80',
  },
  {
    label: 'Tope Cotizable AFP',
    value: formatRD(TOPE_COTIZABLE_AFP, 0),
    descripcion: '20 veces el salario mínimo cotizable TSS',
    fuente: 'CNSS — Resolución 079-2025',
  },
  {
    label: 'Tope Cotizable SFS',
    value: formatRD(TOPE_COTIZABLE_SFS, 0),
    descripcion: '10 veces el salario mínimo cotizable TSS',
    fuente: 'CNSS — Resolución 079-2025',
  },
  {
    label: 'Tope Cotizable SRL',
    value: formatRD(TOPE_COTIZABLE_SRL, 0),
    descripcion: '4 veces el salario mínimo cotizable TSS',
    fuente: 'CNSS — Resolución 079-2025',
  },
]

const PARAMS_ISR: ParamRow[] = [
  { label: 'Tramo I', value: 'Exento', descripcion: 'Hasta RD$ 416,220.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo II', value: '15%', descripcion: 'RD$ 416,220.01 a RD$ 624,329.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo III', value: '20%', descripcion: 'RD$ 624,329.01 a RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo IV', value: '25%', descripcion: 'Más de RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
]

const PARAMS_SALARIOS: ParamRow[] = [
  { label: 'Grandes Empresas', value: formatRD(SALARIO_MINIMO.grandesEmpresas, 0), descripcion: 'Más de 50 trabajadores o capital > RD$ 2M', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Mediana Empresa', value: formatRD(SALARIO_MINIMO.medianaEmpresa, 0), descripcion: '20 a 49 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Pequeñas Empresas', value: formatRD(SALARIO_MINIMO.pequeñasEmpresas, 0), descripcion: '10 a 19 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Microempresas', value: formatRD(SALARIO_MINIMO.microempresas, 0), descripcion: 'Menos de 10 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Zona Franca', value: formatRD(SALARIO_MINIMO.zonaFranca, 0), descripcion: 'Trabajadores en zonas francas industriales', fuente: 'Comité Nac. de Salarios' },
]

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Parámetro</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Descripción</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035] bg-white dark:bg-[#141722]">
          {rows.map(row => (
            <tr key={row.label} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]">
              <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.label}</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-[#151f66] dark:text-indigo-300">{row.value}</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">{row.descripcion}</td>
              <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs">{row.fuente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'

const LABEL_CLASS = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

const CATEGORIAS_EMPRESA: { value: CategoriaEmpresa; label: string; descripcion: string }[] = [
  { value: 'micro',   label: 'Micro',   descripcion: '< 10 trabajadores' },
  { value: 'pequeña', label: 'Pequeña', descripcion: '10–19 trabajadores' },
  { value: 'mediana', label: 'Mediana', descripcion: '20–49 trabajadores' },
  { value: 'grande',  label: 'Grande',  descripcion: '50+ trabajadores o capital > RD$2M' },
]

const SECTORES_EMPRESA: { value: SectorEmpresa; label: string; descripcion: string }[] = [
  { value: 'oficinas_comercio',    label: 'Oficinas y Comercio',    descripcion: 'SRL Cat. I — 1.10%' },
  { value: 'industria_liviana',    label: 'Industria Liviana',      descripcion: 'SRL Cat. II — 1.15%' },
  { value: 'industria_pesada',     label: 'Industria Pesada',       descripcion: 'SRL Cat. III — 1.20%' },
  { value: 'construccion_mineria', label: 'Construcción y Minería', descripcion: 'SRL Cat. IV — 1.30%' },
]

const ROLES_USUARIO: { value: RolUsuario; label: string }[] = [
  { value: 'dueño',    label: 'Dueño / Gerente General' },
  { value: 'contador', label: 'Contador / Enc. Nómina' },
  { value: 'rrhh',     label: 'Recursos Humanos' },
  { value: 'otro',     label: 'Otro' },
]

// ─── Hub de categorías ──────────────────────────────────────────────────────
// Cada categoría agrupa configuración que responde a una pregunta distinta —
// evita el problema de un solo formulario largo donde identidad de empresa,
// clasificación legal, preferencias de nómina y datos de migración quedan
// todos mezclados sin jerarquía.
type Vista = 'hub' | 'empresa' | 'nomina' | 'reglas' | 'datos' | 'legal'

interface CategoriaConfig {
  id: Exclude<Vista, 'hub'>
  icon: LucideIcon
  titulo: string
  pregunta: string
  descripcion: string
  items: string[]
}

const CATEGORIAS: CategoriaConfig[] = [
  {
    id: 'empresa',
    icon: Building2,
    titulo: 'Empresa',
    pregunta: 'Quién eres',
    descripcion: 'Identidad legal, contacto y clasificación de tu empresa para efectos de nómina.',
    items: ['Perfil, logo y datos de contacto', 'Categoría, sector y zona franca', 'Tu rol en la empresa'],
  },
  {
    id: 'nomina',
    icon: Wallet,
    titulo: 'Nómina',
    pregunta: 'Cómo pagas',
    descripcion: 'Configuración operativa de cómo se procesa y se presenta tu nómina.',
    items: ['Modalidad de pago (mensual/quincenal)', 'Moneda de presentación (RD$/USD)', 'Calendario de feriados nacionales'],
  },
  {
    id: 'reglas',
    icon: SlidersHorizontal,
    titulo: 'Reglas de Negocio',
    pregunta: 'Cómo decides tú',
    descripcion: 'Umbrales de alerta internos y la plantilla de correo con la que le hablas a tus empleados — ajústalos a tu propio criterio.',
    items: ['Umbral de endeudamiento/descuentos', 'Umbral de variación de nómina', 'Plantilla de correo de comprobantes'],
  },
  {
    id: 'datos',
    icon: History,
    titulo: 'Datos y Migración',
    pregunta: 'De dónde vienes',
    descripcion: 'Carga el historial de una empresa que ya operaba antes de Cielo Cloud, o prueba el sistema con datos de ejemplo.',
    items: ['Configuración inicial (saldos previos)', 'Datos de demostración'],
  },
  {
    id: 'legal',
    icon: ShieldCheck,
    titulo: 'Cumplimiento Legal',
    pregunta: 'Qué exige la ley',
    descripcion: 'Parámetros fiscales vigentes en República Dominicana — el motor de cálculo ya los aplica automáticamente.',
    items: ['Tasas TSS (CNSS)', 'Tramos ISR (DGII)', 'Salarios mínimos nacionales'],
  },
]

function CategoriaCard({ cat, onClick }: { cat: CategoriaConfig; onClick: () => void }) {
  const Icon = cat.icon
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1B2980]/30 dark:hover:border-indigo-500/40 hover:shadow-[0_20px_40px_-16px_rgba(27,41,128,0.25)] dark:hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-[#1B2980]/10 to-transparent blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-indigo-500/10" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="relative mb-5 inline-flex">
            <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-lg dark:bg-indigo-500/25" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <span className="mt-1 shrink-0 rounded-full bg-[#eef0fb] dark:bg-indigo-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-400">
            {cat.pregunta}
          </span>
        </div>
        <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{cat.titulo}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{cat.descripcion}</p>
        <ul className="mt-4 space-y-1.5">
          {cat.items.map(item => (
            <li key={item} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#1B2980]/40 dark:bg-indigo-500/50" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#1B2980] dark:text-indigo-400">
          Configurar
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  )
}

function VolverBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Configuración
    </button>
  )
}

export default function ConfiguracionPage() {
  const { empresa, guardar } = useEmpresa()
  const { user } = useAuth()
  const { getFeriados, agregarFeriado, eliminarFeriado } = useFeriados()
  const [vista, setVista]       = useState<Vista>('hub')
  const [form, setForm]         = useState<Empresa>(empresa)
  const [showToast, setShowToast] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [nuevaFechaFeriado, setNuevaFechaFeriado] = useState('')
  const [nuevoNombreFeriado, setNuevoNombreFeriado] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const anioActual = new Date().getFullYear()
  const feriados = getFeriados(anioActual)

  function handleAgregarFeriado(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaFechaFeriado || !nuevoNombreFeriado.trim()) return
    agregarFeriado(anioActual, nuevaFechaFeriado, nuevoNombreFeriado.trim())
    setNuevaFechaFeriado('')
    setNuevoNombreFeriado('')
  }

  useEffect(() => {
    setForm(empresa)
  }, [empresa])

  function handleCargarDemo() {
    cargarDatosDemo(user?.uid)
    window.location.reload()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setLogoError('El archivo supera los 3 MB.')
      return
    }
    setLogoError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      const img = new window.Image()
      img.onload = () => {
        const MAX = 320
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        setForm(prev => ({ ...prev, logo: canvas.toDataURL('image/jpeg', 0.88) }))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    guardar(form)
    setShowToast(true)
  }

  // ─── Hub — pantalla principal ──────────────────────────────────────────────
  if (vista === 'hub') {
    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header title="Configuración" subtitle="Ajustes de tu empresa, agrupados por categoría" />
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-[#0d0f1a]">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CATEGORIAS.map(cat => (
                <CategoriaCard key={cat.id} cat={cat} onClick={() => setVista(cat.id)} />
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Cielo Cloud v0.1.0 · Parámetros actualizados a 2024 · República Dominicana
            </p>
          </div>
        </div>
      </div>
    )
  }

  const catActual = CATEGORIAS.find(c => c.id === vista)!

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title={catActual.titulo} subtitle={catActual.descripcion} actions={<VolverBtn onClick={() => setVista('hub')} />} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">
        <div className="mx-auto w-full max-w-3xl space-y-5">

          {/* ── Empresa ─────────────────────────────────────────────────── */}
          {vista === 'empresa' && (
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
              <form onSubmit={handleSave} className="space-y-4">
                {/* Logo */}
                <div>
                  <label className={LABEL_CLASS}>Logo de la empresa</label>
                  <div className="flex items-center gap-5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] transition-colors hover:border-[#1B2980] dark:hover:border-indigo-500"
                    >
                      {form.logo ? (
                        <img src={form.logo} alt="Logo" className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-zinc-300 dark:text-zinc-600">
                          <Building2 className="h-7 w-7" />
                          <span className="text-[9px] font-semibold uppercase tracking-widest">Logo</span>
                        </div>
                      )}
                    </button>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#252840] transition-colors"
                      >
                        <ImagePlus className="h-4 w-4" />
                        {form.logo ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      {form.logo && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, logo: undefined }))}
                          className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800/40 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar logo
                        </button>
                      )}
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">
                        JPG, PNG · Máx. 3 MB<br />
                        Se ajusta automáticamente para PDFs y comprobantes.
                      </p>
                      {logoError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{logoError}</p>}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>

                {/* Nombre */}
                <div>
                  <label htmlFor="nombre" className={LABEL_CLASS}>Nombre de la empresa</label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej. Distribuciones del Caribe, SRL"
                    className={INPUT_CLASS}
                  />
                </div>

                {/* RNC + Ciudad */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rnc" className={LABEL_CLASS}>RNC</label>
                    <input
                      id="rnc"
                      name="rnc"
                      type="text"
                      value={form.rnc}
                      onChange={handleChange}
                      placeholder="Ej. 101-12345-6"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="ciudad" className={LABEL_CLASS}>Ciudad</label>
                    <input
                      id="ciudad"
                      name="ciudad"
                      type="text"
                      value={form.ciudad}
                      onChange={handleChange}
                      placeholder="Ej. Santo Domingo"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label htmlFor="direccion" className={LABEL_CLASS}>Dirección</label>
                  <input
                    id="direccion"
                    name="direccion"
                    type="text"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Ej. Av. Winston Churchill #1099, Piantini"
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Teléfono + Email */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="telefono" className={LABEL_CLASS}>Teléfono</label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="text"
                      value={form.telefono}
                      onChange={handleChange}
                      placeholder="Ej. 809-555-1234"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Ej. admin@empresa.com"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* Representante Legal */}
                <div>
                  <label htmlFor="representanteLegal" className={LABEL_CLASS}>Representante Legal</label>
                  <input
                    id="representanteLegal"
                    name="representanteLegal"
                    type="text"
                    value={form.representanteLegal}
                    onChange={handleChange}
                    placeholder="Ej. María García Pérez"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Clasificación para efectos de nómina
                  </p>

                  {/* Categoría de Empresa */}
                  <div>
                    <label className={LABEL_CLASS}>Categoría de la empresa</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {CATEGORIAS_EMPRESA.map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, categoriaEmpresa: cat.value }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            form.categoriaEmpresa === cat.value
                              ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                              : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#252840]'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${
                            form.categoriaEmpresa === cat.value
                              ? 'text-[#1B2980] dark:text-indigo-300'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}>
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{cat.descripcion}</p>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      Determina el salario mínimo legal aplicable (Res. 079-2025) y las alertas del Dashboard cuando
                      un empleado gana menos de lo establecido. Actualízala si tu empresa crece de categoría.
                    </p>
                  </div>

                  {/* Zona Franca */}
                  <label className="mt-4 flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3.5 py-2.5 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={form.zonaFranca ?? false}
                      onChange={e => setForm(prev => ({ ...prev, zonaFranca: e.target.checked }))}
                      className="h-4 w-4 rounded accent-[#1B2980]"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Opera bajo régimen de zona franca</span>
                  </label>

                  {/* Sector Principal */}
                  <div className="mt-4">
                    <label className={LABEL_CLASS}>Sector principal de operación</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SECTORES_EMPRESA.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, sectorEmpresa: s.value }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            form.sectorEmpresa === s.value
                              ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                              : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#252840]'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${
                            form.sectorEmpresa === s.value
                              ? 'text-[#1B2980] dark:text-indigo-300'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}>
                            {s.label}
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{s.descripcion}</p>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      Define la categoría de riesgo laboral (SRL) sugerida por defecto para los nuevos empleados que agregues.
                    </p>
                  </div>

                  {/* Rol del usuario */}
                  <div className="mt-4">
                    <label className={LABEL_CLASS}>Tu rol en la empresa</label>
                    <div className="flex flex-wrap gap-2">
                      {ROLES_USUARIO.map(r => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, rolUsuario: r.value }))}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            form.rolUsuario === r.value
                              ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30 text-[#1B2980] dark:text-indigo-300'
                              : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#252840]'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Guardar cambios
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Nómina ──────────────────────────────────────────────────── */}
          {vista === 'nomina' && (
            <div className="space-y-5">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
              <form onSubmit={handleSave} className="space-y-5">
                {/* Modalidad de Nómina */}
                <div>
                  <label className={LABEL_CLASS}>Modalidad de pago de nómina</label>
                  <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840] w-fit">
                    {(['mensual', 'quincenal'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, modalidadNomina: m }))}
                        className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                          (form.modalidadNomina ?? 'mensual') === m
                            ? 'bg-[#1B2980] text-white'
                            : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                        }`}
                      >
                        {m === 'mensual' ? 'Mensual' : 'Quincenal'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    Esta configuración define el tipo de período predeterminado al crear nóminas.
                  </p>
                </div>

                {/* Tasa de Cambio USD — presentación, nunca base de cálculo */}
                <div>
                  <label htmlFor="tasaCambioUSD" className={LABEL_CLASS}>Tasa de Cambio (RD$ por USD)</label>
                  <input
                    id="tasaCambioUSD"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tasaCambioUSD ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, tasaCambioUSD: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Ej. 60.50"
                    className="w-full max-w-xs rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    Opcional — habilita el selector RD$/USD en Procesar Nómina. Es solo una
                    conversión de visualización manual (sin conexión a un servicio de tasas en
                    vivo); el motor de cálculo, la retención de ISR/TSS y todos los reportes
                    siguen calculándose y remitiéndose en RD$ sin excepción.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Guardar cambios
                  </button>
                </div>
              </form>
            </div>

            {/* Calendario de feriados nacionales — se guarda solo, sin pasar por "Guardar cambios" */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
              <div className="flex items-center gap-2">
                <PartyPopper className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Feriados Nacionales — {anioActual}</h3>
              </div>
              <p className="mt-1 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                Registra las fechas confirmadas de los feriados nacionales de este año. Se usan como
                recordatorio automático al cargar horas extra en Procesar Nómina — el sistema avisa si
                el mes tiene un feriado registrado, para clasificar las horas correctamente entre
                H.E. 35% y H.E. 100% (Art. 203).
              </p>

              <form onSubmit={handleAgregarFeriado} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className={LABEL_CLASS}>Fecha</label>
                  <input
                    type="date"
                    value={nuevaFechaFeriado}
                    onChange={e => setNuevaFechaFeriado(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex-[2]">
                  <label className={LABEL_CLASS}>Nombre del feriado</label>
                  <input
                    type="text"
                    value={nuevoNombreFeriado}
                    onChange={e => setNuevoNombreFeriado(e.target.value)}
                    placeholder="Ej. Día de la Independencia"
                    className={INPUT_CLASS}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!nuevaFechaFeriado || !nuevoNombreFeriado.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2980] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </form>

              {feriados.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 dark:border-[#252840] px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  Aún no has confirmado ningún feriado para {anioActual}.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-[#1d2035] overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                  {feriados.map(f => (
                    <li key={f.id} className="flex items-center justify-between gap-3 bg-white dark:bg-[#141722] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{f.nombre}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(f.fecha)}</p>
                      </div>
                      <button
                        onClick={() => eliminarFeriado(anioActual, f.id)}
                        className="shrink-0 rounded-lg p-1.5 text-zinc-300 dark:text-zinc-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>
          )}

          {/* ── Reglas de Negocio ───────────────────────────────────────── */}
          {vista === 'reglas' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Umbrales de Alerta</h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-3">
                    Estos umbrales son criterio interno de tu empresa — no son topes establecidos por el
                    Código de Trabajo. Nunca bloquean una acción, solo encienden una alerta visual para
                    que la revises antes de continuar.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="umbralEndeudamientoPct" className={LABEL_CLASS}>
                        Umbral de endeudamiento / descuentos discrecionales (%)
                      </label>
                      <input
                        id="umbralEndeudamientoPct"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={form.umbralEndeudamientoPct ?? UMBRAL_ENDEUDAMIENTO_DEFAULT}
                        onChange={e => setForm(prev => ({ ...prev, umbralEndeudamientoPct: e.target.value ? Number(e.target.value) : undefined }))}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Se usa en Préstamos (Capacidad de Pago) y en la auditoría pre-cierre de
                        Nómina (descuentos discrecionales que superan este % del bruto).
                      </p>
                    </div>
                    <div>
                      <label htmlFor="umbralVariacionBrutoPct" className={LABEL_CLASS}>
                        Umbral de variación de nómina vs. mes anterior (%)
                      </label>
                      <input
                        id="umbralVariacionBrutoPct"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={form.umbralVariacionBrutoPct ?? UMBRAL_VARIACION_BRUTO_DEFAULT}
                        onChange={e => setForm(prev => ({ ...prev, umbralVariacionBrutoPct: e.target.value ? Number(e.target.value) : undefined }))}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Se usa en la auditoría pre-cierre de Nómina — avisa cuando el bruto de un
                        empleado sube o baja más de este % respecto al período anterior.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Plantilla de Correo — Comprobantes de Pago</h3>
                    </div>
                    <p className="mt-1 mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                      El mensaje que se pre-llena al enviar comprobantes de pago desde Procesar Nómina.
                      Personalízalo una vez aquí — antes se reiniciaba al texto de fábrica cada vez que
                      abrías esa pantalla.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="plantillaComprobanteAsunto" className={LABEL_CLASS}>Asunto</label>
                        <input
                          id="plantillaComprobanteAsunto"
                          type="text"
                          value={form.plantillaComprobanteAsunto ?? plantillaComprobanteDefault().asunto}
                          onChange={e => setForm(prev => ({ ...prev, plantillaComprobanteAsunto: e.target.value }))}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="plantillaComprobanteCuerpo" className={LABEL_CLASS}>Cuerpo del correo</label>
                        <textarea
                          id="plantillaComprobanteCuerpo"
                          rows={8}
                          value={form.plantillaComprobanteCuerpo ?? plantillaComprobanteDefault().cuerpo}
                          onChange={e => setForm(prev => ({ ...prev, plantillaComprobanteCuerpo: e.target.value }))}
                          className={`${INPUT_CLASS} font-mono text-xs`}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        Variables disponibles (se reemplazan por cada empleado al enviar):{' '}
                        {PLACEHOLDERS_COMPROBANTE.map(p => p.token).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Datos y Migración ───────────────────────────────────────── */}
          {vista === 'datos' && (
            <div className="space-y-5">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                    <History className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Configuración Inicial</h2>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
                  <ConfiguracionInicialFlow />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
                    <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos de Demostración</h2>
                </div>
                <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-white dark:bg-[#141722] p-5">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    Carga un escenario completo de demostración con 7 empleados, 2 préstamos activos y 4 períodos de nómina
                    cerrados (Marzo–Junio 2026), calculados conforme a la legislación vigente.
                  </p>
                  <ul className="mb-4 mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400 list-disc list-inside">
                    <li>Carlos Rodríguez — préstamo RD$80,000 (4 cuotas pagadas, saldo RD$53,333.32)</li>
                    <li>Ana Martínez — préstamo RD$18,000 (2 cuotas pagadas, saldo RD$12,000)</li>
                    <li>Bono de desempeño en Abril para María González (impacto en ISR)</li>
                    <li>Comisión en Junio para Luisa Reyes (eleva su base gravable a tramo II)</li>
                  </ul>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDemo(true)}
                      className="flex items-center gap-2 rounded-lg border border-violet-300 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                    >
                      <FlaskConical className="h-4 w-4" />
                      Cargar Datos Demo
                    </button>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      Reemplaza todos los datos actuales. La página se recargará automáticamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Cumplimiento Legal ──────────────────────────────────────── */}
          {vista === 'legal' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 flex items-center gap-3">
                <Info className="h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
                <p className="text-xs text-[#151f66] dark:text-indigo-200">
                  Los parámetros mostrados reflejan la legislación vigente en la República Dominicana.
                  Actualice estos valores cuando la DGII, CNSS o el Comité Nacional de Salarios emitan nuevas resoluciones.
                </p>
              </div>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tasas TSS — Tesorería de la Seguridad Social</h2>
                <ParamTable rows={PARAMS_TSS} />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tramos ISR Asalariados — DGII</h2>
                <ParamTable rows={PARAMS_ISR} />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salarios Mínimos Nacionales — Sector Privado No Sectorizado</h2>
                <ParamTable rows={PARAMS_SALARIOS} />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Confirm demo dialog */}
      {confirmDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl animate-modal-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿Cargar datos demo?</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Esto reemplazará todos los datos actuales (empleados, préstamos, períodos y empresa)
                  con el escenario de demostración. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDemo(false)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCargarDemo}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                Sí, cargar demo
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <Toast
          message="Datos guardados"
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
