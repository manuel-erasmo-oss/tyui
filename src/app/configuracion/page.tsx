'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { SALARIO_MINIMO, TASAS_TSS, TOPE_COTIZABLE_AFP, TOPE_COTIZABLE_SFS, TOPE_COTIZABLE_SRL } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import { Save, Settings, Info, Building2, FlaskConical, AlertTriangle, ImagePlus, Trash2 } from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { Toast } from '@/components/ui/Toast'
import { cargarDatosDemo } from '@/lib/seed-data'
import type { Empresa, CategoriaEmpresa, SectorEmpresa, RolUsuario } from '@/types'

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

export default function ConfiguracionPage() {
  const { empresa, guardar } = useEmpresa()
  const [form, setForm]         = useState<Empresa>(empresa)
  const [showToast, setShowToast] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(empresa)
  }, [empresa])

  function handleCargarDemo() {
    cargarDatosDemo()
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

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Configuración" subtitle="Perfil de empresa y parámetros fiscales vigentes" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Company profile card */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
              <Building2 className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Perfil de la Empresa</h2>
          </div>

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
              <label className="flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3.5 py-2.5 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={form.zonaFranca ?? false}
                  onChange={e => setForm(prev => ({ ...prev, zonaFranca: e.target.checked }))}
                  className="h-4 w-4 rounded accent-[#1B2980]"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Opera bajo régimen de zona franca</span>
              </label>

              {/* Sector Principal */}
              <div>
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
              <div>
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

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Guardar datos
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Demo data loader */}
        <section>
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
        </section>

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

        {/* Separator */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Parámetros Fiscales Vigentes
          </span>
          <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
        </div>

        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 flex items-center gap-3">
          <Info className="h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
          <p className="text-xs text-[#151f66] dark:text-indigo-200">
            Los parámetros mostrados reflejan la legislación vigente en la República Dominicana.
            Actualice estos valores cuando la DGII, CNSS o el Comité Nacional de Salarios emitan nuevas resoluciones.
          </p>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
              <Settings className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tasas TSS — Tesorería de la Seguridad Social</h2>
          </div>
          <ParamTable rows={PARAMS_TSS} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
              <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tramos ISR Asalariados — DGII</h2>
          </div>
          <ParamTable rows={PARAMS_ISR} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salarios Mínimos Nacionales — Sector Privado No Sectorizado</h2>
          </div>
          <ParamTable rows={PARAMS_SALARIOS} />
        </section>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Cielo Cloud v0.1.0 · Parámetros actualizados a 2024 · República Dominicana
        </p>
      </div>

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
