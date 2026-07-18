'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { SALARIO_MINIMO, TASAS_TSS, TOPE_COTIZABLE_AFP, TOPE_COTIZABLE_SFS, TOPE_COTIZABLE_SRL, CONCEPTOS_LEY } from '@/lib/dominican-labor'
import { formatRD, formatDate, formatRelativeTime, cn } from '@/lib/utils'
import {
  Save, Info, Building2, FlaskConical, AlertTriangle, ImagePlus, Trash2, History,
  Wallet, ShieldCheck, SlidersHorizontal, Mail, PartyPopper, Plus, Search, ChevronRight,
  MapPin, Phone, UserCircle2, Landmark, Percent, Coins, LayoutGrid, CalendarDays,
  Pencil, X, CheckCircle2, CircleAlert, Clock,
} from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { useEmpleados } from '@/lib/empleados-context'
import { useAuth } from '@/lib/auth-context'
import { useFeriados } from '@/lib/feriados-context'
import { useConceptosPersonalizados } from '@/lib/conceptos-personalizados-context'
import { Toast } from '@/components/ui/Toast'
import { cargarDatosDemo } from '@/lib/seed-data'
import { ConfiguracionInicialFlow } from '@/components/carga-inicial/ConfiguracionInicialFlow'
import { PLACEHOLDERS_COMPROBANTE, plantillaComprobanteDefault } from '@/lib/comprobante-email'
import {
  UMBRAL_ENDEUDAMIENTO_DEFAULT, UMBRAL_VARIACION_BRUTO_DEFAULT,
  type Empresa, type CategoriaEmpresa, type SectorEmpresa, type RolUsuario, type ConceptoPersonalizado, type CierreFiscal,
} from '@/types'

// ─── Parámetros legales de referencia (solo lectura) ───────────────────────

interface ParamRow {
  label: string
  value: string
  descripcion: string
  fuente: string
}

const PARAMS_TSS: ParamRow[] = [
  { label: 'AFP Empleado', value: `${(TASAS_TSS.afpEmpleado * 100).toFixed(2)}%`, descripcion: 'Descuento al empleado para fondo de pensiones', fuente: 'CNSS — Ley 87-01' },
  { label: 'AFP Empleador', value: `${(TASAS_TSS.afpEmpleador * 100).toFixed(2)}%`, descripcion: 'Aporte patronal al fondo de pensiones', fuente: 'CNSS — Ley 87-01' },
  { label: 'SFS Empleado', value: `${(TASAS_TSS.sfsEmpleado * 100).toFixed(2)}%`, descripcion: 'Descuento al empleado para salud familiar', fuente: 'CNSS — Ley 87-01' },
  { label: 'SFS Empleador', value: `${(TASAS_TSS.sfsEmpleador * 100).toFixed(2)}%`, descripcion: 'Aporte patronal al seguro familiar de salud', fuente: 'CNSS — Ley 87-01' },
  { label: 'SRL Categoría I', value: `${(TASAS_TSS.srlCategoriaI * 100).toFixed(2)}%`, descripcion: 'Seguro de Riesgos Laborales — oficinas y comercio (solo empleador)', fuente: 'CNSS — Ley 87-01' },
  { label: 'SRL Categoría II', value: `${(TASAS_TSS.srlCategoriaII * 100).toFixed(2)}%`, descripcion: 'Seguro de Riesgos Laborales — industria liviana (solo empleador)', fuente: 'CNSS — Ley 87-01' },
  { label: 'SRL Categoría III', value: `${(TASAS_TSS.srlCategoriaIII * 100).toFixed(2)}%`, descripcion: 'Seguro de Riesgos Laborales — industria pesada (solo empleador)', fuente: 'CNSS — Ley 87-01' },
  { label: 'SRL Categoría IV', value: `${(TASAS_TSS.srlCategoriaIV * 100).toFixed(2)}%`, descripcion: 'Seguro de Riesgos Laborales — construcción y minería, alto riesgo (solo empleador)', fuente: 'CNSS — Ley 87-01' },
  { label: 'Infotep', value: `${(TASAS_TSS.infotepEmpleador * 100).toFixed(2)}%`, descripcion: 'Aporte obligatorio del empleador para formación técnico-profesional', fuente: 'INFOTEP — Ley 116-80' },
  { label: 'Tope Cotizable AFP', value: formatRD(TOPE_COTIZABLE_AFP), descripcion: '20 veces el salario mínimo cotizable TSS', fuente: 'CNSS — Resolución 079-2025' },
  { label: 'Tope Cotizable SFS', value: formatRD(TOPE_COTIZABLE_SFS), descripcion: '10 veces el salario mínimo cotizable TSS', fuente: 'CNSS — Resolución 079-2025' },
  { label: 'Tope Cotizable SRL', value: formatRD(TOPE_COTIZABLE_SRL), descripcion: '4 veces el salario mínimo cotizable TSS', fuente: 'CNSS — Resolución 079-2025' },
]

const PARAMS_ISR: ParamRow[] = [
  { label: 'Tramo I', value: 'Exento', descripcion: 'Hasta RD$ 416,220.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo II', value: '15%', descripcion: 'RD$ 416,220.01 a RD$ 624,329.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo III', value: '20%', descripcion: 'RD$ 624,329.01 a RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo IV', value: '25%', descripcion: 'Más de RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
]

const PARAMS_SALARIOS: ParamRow[] = [
  { label: 'Grandes Empresas', value: formatRD(SALARIO_MINIMO.grandesEmpresas), descripcion: 'Más de 50 trabajadores o capital > RD$ 2M', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Mediana Empresa', value: formatRD(SALARIO_MINIMO.medianaEmpresa), descripcion: '20 a 49 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Pequeñas Empresas', value: formatRD(SALARIO_MINIMO.pequeñasEmpresas), descripcion: '10 a 19 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Microempresas', value: formatRD(SALARIO_MINIMO.microempresas), descripcion: 'Menos de 10 trabajadores', fuente: 'Res. 079-2025 — vigente desde 01-feb-2026' },
  { label: 'Zona Franca', value: formatRD(SALARIO_MINIMO.zonaFranca), descripcion: 'Trabajadores en zonas francas industriales', fuente: 'Comité Nac. de Salarios' },
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
        <tbody className="divide-y divide-zinc-200 dark:divide-[#252840] bg-white dark:bg-[#141722]">
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

// Sí/No compacto para las columnas de afecta ISR/TSS — verde cuando suma a
// la base, gris cuando no la toca.
function SiNoBadge({ value }: { value: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
      value
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
        : 'bg-zinc-100 text-zinc-500 dark:bg-[#1a1d2e] dark:text-zinc-500',
    )}>
      {value ? 'Sí' : 'No'}
    </span>
  )
}

// Tabla de referencia — el tratamiento REAL de ISR/TSS de cada concepto de
// ley, tal como ya lo calcula el motor (CONCEPTOS_LEY se genera a partir de
// dominican-labor.ts, no es una fuente independiente que pueda desincronizarse).
function ConceptosLeyTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concepto</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Afecta ISR</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Afecta TSS</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Base legal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-[#252840] bg-white dark:bg-[#141722]">
          {CONCEPTOS_LEY.map(c => (
            <tr key={c.concepto} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]">
              <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{c.nombre}</td>
              <td className="px-4 py-3">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                  c.tipo === 'ingreso'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50'
                    : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/50',
                )}>
                  {c.tipo === 'ingreso' ? 'Ingreso' : 'Deducción'}
                </span>
              </td>
              <td className="px-4 py-3 text-center"><SiNoBadge value={c.afectaISR} /></td>
              <td className="px-4 py-3 text-center"><SiNoBadge value={c.afectaTSS} /></td>
              <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs">{c.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'

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

const CIERRES_FISCALES: { value: CierreFiscal; label: string; descripcion: string }[] = [
  { value: 'diciembre',  label: '31 de diciembre', descripcion: 'Año calendario — el más común' },
  { value: 'marzo',      label: '31 de marzo',      descripcion: 'Ejercicio abril–marzo' },
  { value: 'junio',      label: '30 de junio',      descripcion: 'Ejercicio julio–junio' },
  { value: 'septiembre', label: '30 de septiembre', descripcion: 'Ejercicio octubre–septiembre' },
]

const ROLES_USUARIO: { value: RolUsuario; label: string }[] = [
  { value: 'dueño',    label: 'Dueño / Gerente General' },
  { value: 'contador', label: 'Contador / Enc. Nómina' },
  { value: 'rrhh',     label: 'Recursos Humanos' },
  { value: 'otro',     label: 'Otro' },
]

// ─── Estructura de navegación ───────────────────────────────────────────────
// Rail persistente a la izquierda + panel de contenido a la derecha — el
// patrón de "hub" con navegación de página completa se reemplaza por una
// experiencia continua de una sola pantalla (Stripe/Vercel/Linear), con un
// solo punto de guardado (barra flotante) en vez de un botón por sección.
type Vista = 'resumen' | 'empresa' | 'nomina' | 'conceptos' | 'reglas' | 'datos' | 'legal'

interface Seccion {
  id: Exclude<Vista, 'resumen'>
  icon: LucideIcon
  titulo: string
  descripcion: string
  grupo: 'negocio' | 'sistema'
  keywords: string[]
}

const SECCIONES: Seccion[] = [
  {
    id: 'empresa',
    icon: Building2,
    titulo: 'Empresa',
    descripcion: 'Identidad, contacto y clasificación legal',
    grupo: 'negocio',
    keywords: ['logo', 'rnc', 'direccion', 'telefono', 'email', 'representante legal', 'categoria', 'sector', 'zona franca', 'rol'],
  },
  {
    id: 'nomina',
    icon: Wallet,
    titulo: 'Nómina',
    descripcion: 'Modalidad de pago, moneda y feriados',
    grupo: 'negocio',
    keywords: ['mensual', 'quincenal', 'usd', 'dolares', 'feriados', 'tasa de cambio', 'horas extra'],
  },
  {
    id: 'conceptos',
    icon: Coins,
    titulo: 'Ingresos y Deducciones',
    descripcion: 'Catálogo de conceptos que afectan ISR y TSS',
    grupo: 'negocio',
    keywords: ['ingreso', 'deduccion', 'descuento', 'concepto', 'isr', 'tss', 'catalogo', 'personalizado', 'bono', 'comision'],
  },
  {
    id: 'reglas',
    icon: SlidersHorizontal,
    titulo: 'Reglas de Negocio',
    descripcion: 'Umbrales de alerta y plantilla de correo',
    grupo: 'negocio',
    keywords: ['umbral', 'endeudamiento', 'variacion', 'correo', 'plantilla', 'comprobante', 'alerta'],
  },
  {
    id: 'datos',
    icon: History,
    titulo: 'Datos y Migración',
    descripcion: 'Saldos iniciales y datos de demostración',
    grupo: 'sistema',
    keywords: ['migracion', 'saldos iniciales', 'demo', 'excel', 'importar', 'asistente'],
  },
  {
    id: 'legal',
    icon: ShieldCheck,
    titulo: 'Cumplimiento Legal',
    descripcion: 'Tasas TSS, tramos ISR y salarios mínimos',
    grupo: 'sistema',
    keywords: ['tss', 'isr', 'dgii', 'cnss', 'salario minimo', 'infotep'],
  },
]

const GRUPO_LABEL: Record<Seccion['grupo'], string> = { negocio: 'Tu Negocio', sistema: 'Sistema' }

function NavItem({ icon: Icon, titulo, descripcion, active, onClick }: {
  icon: LucideIcon; titulo: string; descripcion: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        active ? 'bg-[#eef0fb] dark:bg-indigo-950/40' : 'hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          active
            ? 'bg-[#1B2980] text-white shadow-sm shadow-[#1B2980]/30'
            : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', active ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300')}>
          {titulo}
        </span>
        <span className="block truncate text-[11px] text-zinc-400 dark:text-zinc-500">{descripcion}</span>
      </span>
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1B2980] dark:bg-indigo-400" />}
    </button>
  )
}

function SettingsCard({ icon: Icon, title, description, tone = 'default', children }: {
  icon?: LucideIcon; title?: string; description?: string; tone?: 'default' | 'violet'; children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white dark:bg-[#141722] p-6',
        tone === 'violet' ? 'border-violet-200 dark:border-violet-800/40' : 'border-zinc-200/70 dark:border-[#252840]',
      )}
    >
      {title && (
        <div className="mb-5 flex items-start gap-3">
          {Icon && (
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                tone === 'violet'
                  ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                  : 'bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// Tarjeta colapsable con resumen de solo lectura + botón "Editar" que expande
// el formulario in situ — el patrón que usan QuickBooks/SAP en vez de dejar
// formularios largos siempre abiertos. `isEmpty` fuerza el estado abierto la
// primera vez (empresa recién creada, nada que resumir todavía).
function CollapsibleCard({ icon: Icon, title, description, summary, isEmpty, children }: {
  icon?: LucideIcon; title: string; description?: string; summary: React.ReactNode; isEmpty?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!isEmpty)
  return (
    <div className="rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-2.5 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#252840] transition-colors"
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {open ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {open ? <div className="mt-5">{children}</div> : <div className="mt-4 pl-11">{summary}</div>}
    </div>
  )
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3.5 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-[#1B2980]' : 'bg-zinc-300 dark:bg-zinc-700')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
    </label>
  )
}

// El RNC dominicano de empresa tiene 9 dígitos; una cédula (persona física
// con negocio de único dueño) tiene 11 — aceptamos ambos formatos. Solo
// informativo, nunca bloquea el guardado.
function rncEsValido(rnc: string): boolean {
  const digitos = rnc.replace(/\D/g, '')
  return digitos.length === 9 || digitos.length === 11
}

function FieldInput({ icon: Icon, className, ...props }: { icon?: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />}
      <input {...props} className={cn(INPUT_CLASS, Icon && 'pl-9', className)} />
    </div>
  )
}

function ThresholdSlider({ id, label, value, onChange, hint, min = 1, max = 100 }: {
  id: string; label: string; value: number; onChange: (n: number) => void; hint: string; min?: number; max?: number
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
        <span className="rounded-md bg-[#eef0fb] dark:bg-indigo-950/40 px-2 py-0.5 text-xs font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">
          {value}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-[#252840] accent-[#1B2980]
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#1B2980] [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:shadow-[#1B2980]/40 dark:[&::-webkit-slider-thumb]:border-[#141722]
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#1B2980]"
      />
      <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</p>
    </div>
  )
}

interface ChecklistItem { label: string; done: boolean; sublabel: string; onClick: () => void; icon: LucideIcon }

export default function ConfiguracionPage() {
  const { empresa, guardar } = useEmpresa()
  const { empleadosActivos } = useEmpleados()
  const { user } = useAuth()
  const { getFeriados, agregarFeriado, eliminarFeriado } = useFeriados()
  const { conceptosActivos: conceptosPersonalizados, crear: crearConcepto, actualizar: actualizarConcepto, eliminar: eliminarConcepto } = useConceptosPersonalizados()
  const [vista, setVista]       = useState<Vista>('resumen')
  const [query, setQuery]       = useState('')
  const [form, setForm]         = useState<Empresa>(empresa)
  const [showToast, setShowToast] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [nuevaFechaFeriado, setNuevaFechaFeriado] = useState('')
  const [nuevoNombreFeriado, setNuevoNombreFeriado] = useState('')
  // ── Catálogo de Ingresos y Deducciones ──────────────────────────────────────
  const [toastConceptos, setToastConceptos] = useState<string | null>(null)
  const [mostrarFormConcepto, setMostrarFormConcepto] = useState(false)
  const [editandoConceptoId, setEditandoConceptoId] = useState<string | null>(null)
  const [conceptoNombre, setConceptoNombre] = useState('')
  const [conceptoTipo, setConceptoTipo] = useState<'ingreso' | 'deduccion'>('ingreso')
  const [conceptoISR, setConceptoISR] = useState(true)
  const [conceptoTSS, setConceptoTSS] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const anioActual = new Date().getFullYear()
  const feriados = getFeriados(anioActual)

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(empresa), [form, empresa])
  const esVistaFormulario = vista === 'empresa' || vista === 'nomina' || vista === 'reglas'

  useEffect(() => {
    setForm(empresa)
  }, [empresa])

  function irA(id: Vista) {
    setVista(id)
    setQuery('')
  }

  function handleAgregarFeriado(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaFechaFeriado || !nuevoNombreFeriado.trim()) return
    agregarFeriado(anioActual, nuevaFechaFeriado, nuevoNombreFeriado.trim())
    setNuevaFechaFeriado('')
    setNuevoNombreFeriado('')
  }

  function handleCargarDemo() {
    cargarDatosDemo(user?.uid)
    window.location.reload()
  }

  // ── Catálogo de Ingresos y Deducciones ──────────────────────────────────────
  function resetFormConcepto() {
    setMostrarFormConcepto(false)
    setEditandoConceptoId(null)
    setConceptoNombre('')
    setConceptoTipo('ingreso')
    setConceptoISR(true)
    setConceptoTSS(true)
  }

  function abrirNuevoConcepto() {
    resetFormConcepto()
    setMostrarFormConcepto(true)
  }

  function abrirEditarConcepto(c: ConceptoPersonalizado) {
    setEditandoConceptoId(c.id)
    setConceptoNombre(c.nombre)
    setConceptoTipo(c.tipo)
    setConceptoISR(c.afectaISR)
    setConceptoTSS(c.afectaTSS)
    setMostrarFormConcepto(true)
  }

  function handleGuardarConcepto() {
    const nombre = conceptoNombre.trim()
    if (!nombre) { setToastConceptos('Indique un nombre para el concepto'); return }
    if (editandoConceptoId) {
      actualizarConcepto(editandoConceptoId, { nombre, tipo: conceptoTipo, afectaISR: conceptoISR, afectaTSS: conceptoTSS })
      setToastConceptos(`Concepto "${nombre}" actualizado`)
    } else {
      crearConcepto({ nombre, tipo: conceptoTipo, afectaISR: conceptoISR, afectaTSS: conceptoTSS })
      setToastConceptos(`Concepto "${nombre}" creado`)
    }
    resetFormConcepto()
  }

  function handleEliminarConcepto(c: ConceptoPersonalizado) {
    eliminarConcepto(c.id)
    setToastConceptos(`Concepto "${c.nombre}" eliminado del catálogo`)
    if (editandoConceptoId === c.id) resetFormConcepto()
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

  function handleSave() {
    guardar(form)
    setShowToast(true)
  }

  function handleDiscard() {
    setForm(empresa)
  }

  // ─── Búsqueda dentro de Configuración ─────────────────────────────────────
  const queryNorm = query.trim().toLowerCase()
  const seccionesFiltradas = queryNorm
    ? SECCIONES.filter(s => `${s.titulo} ${s.descripcion} ${s.keywords.join(' ')}`.toLowerCase().includes(queryNorm))
    : SECCIONES
  const negocioFiltrado = seccionesFiltradas.filter(s => s.grupo === 'negocio')
  const sistemaFiltrado = seccionesFiltradas.filter(s => s.grupo === 'sistema')

  const seccionActual = SECCIONES.find(s => s.id === vista)

  // ─── Panel de Resumen — completitud real + pendientes accionables ─────────
  // Nada de esto repite la barra lateral (que solo describe QUÉ hay en cada
  // sección) — aquí se calcula el ESTADO real de los datos de la empresa.
  const camposEmpresa = [empresa.nombre, empresa.rnc, empresa.ciudad, empresa.direccion, empresa.telefono, empresa.email, empresa.representanteLegal]
  const camposCompletos = camposEmpresa.filter(Boolean).length
  const empleadosConSaldoPendiente = empleadosActivos.filter(e => e.saldosInicialesRevisado !== true).length

  const checklist: ChecklistItem[] = [
    {
      label: 'Completa el perfil de tu empresa',
      sublabel: `${camposCompletos}/${camposEmpresa.length} campos completos`,
      done: camposCompletos === camposEmpresa.length,
      onClick: () => irA('empresa'),
      icon: Building2,
    },
    {
      label: 'Sube el logo de tu empresa',
      sublabel: 'Aparece en PDFs y comprobantes de pago',
      done: !!empresa.logo,
      onClick: () => irA('empresa'),
      icon: ImagePlus,
    },
    {
      label: `Registra los feriados nacionales de ${anioActual}`,
      sublabel: 'Alimenta el aviso de H.E. 100% en Procesar Nómina',
      done: feriados.length > 0,
      onClick: () => irA('nomina'),
      icon: PartyPopper,
    },
    {
      label: 'Revisa los saldos iniciales de tus empleados',
      sublabel: empleadosConSaldoPendiente > 0
        ? `${empleadosConSaldoPendiente} empleado${empleadosConSaldoPendiente === 1 ? '' : 's'} sin revisar`
        : 'Todos los empleados están al día',
      done: empleadosConSaldoPendiente === 0,
      onClick: () => irA('datos'),
      icon: History,
    },
  ]
  const pendientes = checklist.filter(c => !c.done)
  const completitudPct = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Configuración" subtitle="Administra los ajustes de tu empresa" />

      {/* Selector de sección — solo móvil, la barra lateral persistente vive en escritorio */}
      <div className="md:hidden flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-2.5">
        <button
          onClick={() => irA('resumen')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            vista === 'resumen' ? 'bg-[#1B2980] text-white' : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-600 dark:text-zinc-400',
          )}
        >
          Resumen
        </button>
        {SECCIONES.map(s => (
          <button
            key={s.id}
            onClick={() => irA(s.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              vista === s.id ? 'bg-[#1B2980] text-white' : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-600 dark:text-zinc-400',
            )}
          >
            {s.titulo}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden bg-zinc-50 dark:bg-[#0d0f1a]">
        {/* ── Rail de navegación persistente (escritorio) ─────────────────── */}
        <aside className="hidden md:flex w-72 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722]">
          <div className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en configuración…"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] py-2 pl-8 pr-3 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <nav className="flex-1 px-2 pb-4">
            {!queryNorm && (
              <NavItem
                icon={LayoutGrid}
                titulo="Resumen"
                descripcion="Vista general de tu cuenta"
                active={vista === 'resumen'}
                onClick={() => irA('resumen')}
              />
            )}

            {!queryNorm && <div className="my-3 h-px bg-zinc-100 dark:bg-[#1d2035]" />}

            {negocioFiltrado.length > 0 && (
              <div className="space-y-0.5">
                {!queryNorm && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                    {GRUPO_LABEL.negocio}
                  </p>
                )}
                {negocioFiltrado.map(s => (
                  <NavItem key={s.id} icon={s.icon} titulo={s.titulo} descripcion={s.descripcion} active={vista === s.id} onClick={() => irA(s.id)} />
                ))}
              </div>
            )}

            {sistemaFiltrado.length > 0 && (
              <div className="mt-3 space-y-0.5">
                {!queryNorm && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                    {GRUPO_LABEL.sistema}
                  </p>
                )}
                {sistemaFiltrado.map(s => (
                  <NavItem key={s.id} icon={s.icon} titulo={s.titulo} descripcion={s.descripcion} active={vista === s.id} onClick={() => irA(s.id)} />
                ))}
              </div>
            )}

            {queryNorm && seccionesFiltradas.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">Sin resultados para “{query}”</p>
            )}
          </nav>

          <div className="border-t border-zinc-100 dark:border-[#1d2035] p-4">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Cielo Cloud v0.1.0 · República Dominicana</p>
          </div>
        </aside>

        {/* ── Panel de contenido ───────────────────────────────────────────── */}
        <div className="relative flex flex-1 min-w-0 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-8 pb-28">

              {/* ── Resumen ─────────────────────────────────────────────────── */}
              {vista === 'resumen' && (
                <div className="animate-content-in" key="resumen">
                  {/* Perfil + anillo de completitud */}
                  <div className="mb-5 overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-gradient-to-br from-white to-[#f7f8fd] dark:from-[#141722] dark:to-[#161a2c] p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e]">
                          {empresa.logo ? (
                            <img src={empresa.logo} alt="Logo" className="h-full w-full object-contain p-1.5" />
                          ) : (
                            <Building2 className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
                          )}
                        </div>
                        <div className="min-w-0 sm:hidden">
                          <p className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">{empresa.nombre || 'Tu empresa'}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {empresa.rnc || 'RNC sin registrar'} · {empresa.ciudad || 'Ciudad sin registrar'}
                          </p>
                        </div>
                      </div>
                      <div className="hidden min-w-0 flex-1 sm:block">
                        <p className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">{empresa.nombre || 'Tu empresa'}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {empresa.rnc || 'RNC sin registrar'} · {empresa.ciudad || 'Ciudad sin registrar'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                          <Clock className="h-3 w-3" />
                          {empresa.actualizadoEn ? `Actualizado ${formatRelativeTime(empresa.actualizadoEn)}` : 'Aún sin guardar cambios'}
                        </p>
                      </div>

                      {/* Anillo de completitud — conic-gradient, sin librería de charts */}
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#252840]">
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{ background: `conic-gradient(#1B2980 ${completitudPct * 3.6}deg, transparent 0deg)` }}
                          />
                          <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white dark:bg-[#141722]">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{completitudPct}%</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-right">configuración<br className="hidden sm:block" /> completa</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 sm:hidden">
                      <Clock className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {empresa.actualizadoEn ? `Actualizado ${formatRelativeTime(empresa.actualizadoEn)}` : 'Aún sin guardar cambios'}
                      </p>
                    </div>
                  </div>

                  {/* Pendientes accionables — el contenido real del Resumen, no una copia del rail */}
                  <div className="rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
                    <div className="mb-4 flex items-center gap-2">
                      {pendientes.length === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <CircleAlert className="h-4 w-4 text-amber-500" />
                      )}
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {pendientes.length === 0 ? 'Todo en orden' : `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'} por revisar`}
                      </h3>
                    </div>

                    {pendientes.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                        Tu configuración está al día — no hay ningún pendiente activo.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-200 dark:divide-[#252840] overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                        {pendientes.map(item => (
                          <li key={item.label}>
                            <button
                              onClick={item.onClick}
                              className="flex w-full items-center gap-3 bg-white dark:bg-[#141722] px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                                <item.icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>
                                <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">{item.sublabel}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {vista !== 'resumen' && seccionActual && (
                <>
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      {GRUPO_LABEL[seccionActual.grupo]}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">{seccionActual.titulo}</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{seccionActual.descripcion}</p>
                  </div>

                  <div key={vista} className="space-y-5 animate-content-in">

                    {/* ── Empresa ─────────────────────────────────────────────── */}
                    {vista === 'empresa' && (
                      <>
                        <CollapsibleCard
                          icon={Building2}
                          title="Identidad"
                          description="Nombre legal, RNC y logo de tu empresa."
                          isEmpty={!form.nombre && !form.rnc}
                          summary={
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e]">
                                {form.logo ? (
                                  <img src={form.logo} alt="Logo" className="h-full w-full object-contain p-1" />
                                ) : (
                                  <Building2 className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{form.nombre || 'Sin nombre registrado'}</p>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">{form.rnc || 'RNC sin registrar'}</p>
                              </div>
                            </div>
                          }
                        >
                          <div className="space-y-4">
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

                            <div>
                              <label htmlFor="nombre" className={LABEL_CLASS}>Nombre de la empresa</label>
                              <FieldInput
                                id="nombre"
                                name="nombre"
                                type="text"
                                icon={Building2}
                                value={form.nombre}
                                onChange={handleChange}
                                placeholder="Ej. Distribuciones del Caribe, SRL"
                              />
                            </div>

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
                              {form.rnc && (
                                <p className={cn(
                                  'mt-1.5 flex items-center gap-1.5 text-[11px]',
                                  rncEsValido(form.rnc) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                                )}>
                                  {rncEsValido(form.rnc) ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                                  {rncEsValido(form.rnc) ? 'Formato válido (9 u 11 dígitos)' : 'Verifica el formato — debe tener 9 dígitos (RNC) u 11 (cédula)'}
                                </p>
                              )}
                            </div>
                          </div>
                        </CollapsibleCard>

                        <CollapsibleCard
                          icon={MapPin}
                          title="Ubicación y Contacto"
                          description="Cómo te encuentran y cómo te contactan."
                          isEmpty={!form.ciudad && !form.telefono && !form.email}
                          summary={
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              {[form.ciudad, form.telefono, form.email, form.representanteLegal].filter(Boolean).join(' · ') || 'Sin datos de contacto registrados'}
                            </p>
                          }
                        >
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label htmlFor="ciudad" className={LABEL_CLASS}>Ciudad</label>
                                <FieldInput id="ciudad" name="ciudad" type="text" icon={MapPin} value={form.ciudad} onChange={handleChange} placeholder="Ej. Santo Domingo" />
                              </div>
                              <div>
                                <label htmlFor="telefono" className={LABEL_CLASS}>Teléfono</label>
                                <FieldInput id="telefono" name="telefono" type="text" icon={Phone} value={form.telefono} onChange={handleChange} placeholder="Ej. 809-555-1234" />
                              </div>
                            </div>
                            <div>
                              <label htmlFor="direccion" className={LABEL_CLASS}>Dirección</label>
                              <FieldInput id="direccion" name="direccion" type="text" icon={MapPin} value={form.direccion} onChange={handleChange} placeholder="Ej. Av. Winston Churchill #1099, Piantini" />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                                <FieldInput id="email" name="email" type="email" icon={Mail} value={form.email} onChange={handleChange} placeholder="Ej. admin@empresa.com" />
                              </div>
                              <div>
                                <label htmlFor="representanteLegal" className={LABEL_CLASS}>Representante Legal</label>
                                <FieldInput id="representanteLegal" name="representanteLegal" type="text" icon={UserCircle2} value={form.representanteLegal} onChange={handleChange} placeholder="Ej. María García Pérez" />
                              </div>
                            </div>
                          </div>
                        </CollapsibleCard>

                        <SettingsCard icon={ShieldCheck} title="Clasificación para Nómina" description="Determina el salario mínimo aplicable y la categoría SRL por defecto.">
                          <div className="space-y-5">
                            <div>
                              <label className={LABEL_CLASS}>Categoría de la empresa</label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {CATEGORIAS_EMPRESA.map(cat => (
                                  <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, categoriaEmpresa: cat.value }))}
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-left transition-colors',
                                      form.categoriaEmpresa === cat.value
                                        ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                                        : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#252840]',
                                    )}
                                  >
                                    <p className={cn('text-xs font-semibold', form.categoriaEmpresa === cat.value ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300')}>
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

                            <ToggleSwitch
                              checked={form.zonaFranca ?? false}
                              onChange={v => setForm(prev => ({ ...prev, zonaFranca: v }))}
                              label="Opera bajo régimen de zona franca"
                            />

                            <div>
                              <label className={LABEL_CLASS}>Sector principal de operación</label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {SECTORES_EMPRESA.map(s => (
                                  <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, sectorEmpresa: s.value }))}
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-left transition-colors',
                                      form.sectorEmpresa === s.value
                                        ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                                        : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#252840]',
                                    )}
                                  >
                                    <p className={cn('text-xs font-semibold', form.sectorEmpresa === s.value ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300')}>
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

                            <div>
                              <label className={LABEL_CLASS}>Cierre de ejercicio fiscal</label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {CIERRES_FISCALES.map(c => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, cierreFiscal: c.value }))}
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-left transition-colors',
                                      (form.cierreFiscal ?? 'diciembre') === c.value
                                        ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                                        : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#252840]',
                                    )}
                                  >
                                    <p className={cn('text-xs font-semibold', (form.cierreFiscal ?? 'diciembre') === c.value ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300')}>
                                      {c.label}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{c.descripcion}</p>
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                Determina la ventana de la Bonificación por Utilidades (Art. 223) y su plazo legal
                                de pago — 90 a 120 días después del cierre (Art. 224).
                              </p>
                            </div>
                          </div>
                        </SettingsCard>

                        <SettingsCard icon={UserCircle2} title="Tu Rol" description="Ayuda a personalizar la experiencia del sistema.">
                          <div className="flex flex-wrap gap-2">
                            {ROLES_USUARIO.map(r => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, rolUsuario: r.value }))}
                                className={cn(
                                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                  form.rolUsuario === r.value
                                    ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30 text-[#1B2980] dark:text-indigo-300'
                                    : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#252840]',
                                )}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </SettingsCard>
                      </>
                    )}

                    {/* ── Nómina ──────────────────────────────────────────────── */}
                    {vista === 'nomina' && (
                      <>
                        <CollapsibleCard
                          icon={Wallet}
                          title="Modalidad y Moneda"
                          description="Cómo se procesa y se presenta tu nómina."
                          summary={
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              {(form.modalidadNomina ?? 'mensual') === 'mensual' ? 'Mensual' : 'Quincenal'}
                              {form.tasaCambioUSD ? ` · RD$${form.tasaCambioUSD} por USD` : ' · Sin tasa USD configurada'}
                            </p>
                          }
                        >
                          <div className="space-y-5">
                            <div>
                              <label className={LABEL_CLASS}>Modalidad de pago de nómina</label>
                              <div className="flex w-fit overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                                {(['mensual', 'quincenal'] as const).map(m => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, modalidadNomina: m }))}
                                    className={cn(
                                      'px-5 py-2 text-sm font-medium capitalize transition-colors',
                                      (form.modalidadNomina ?? 'mensual') === m
                                        ? 'bg-[#1B2980] text-white'
                                        : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]',
                                    )}
                                  >
                                    {m === 'mensual' ? 'Mensual' : 'Quincenal'}
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                                Esta configuración define el tipo de período predeterminado al crear nóminas.
                              </p>
                            </div>

                            <div>
                              <label htmlFor="tasaCambioUSD" className={LABEL_CLASS}>Tasa de Cambio (RD$ por USD)</label>
                              <FieldInput
                                id="tasaCambioUSD"
                                type="number"
                                icon={Coins}
                                min="0"
                                step="0.01"
                                value={form.tasaCambioUSD ?? ''}
                                onChange={e => setForm(prev => ({ ...prev, tasaCambioUSD: e.target.value ? Number(e.target.value) : undefined }))}
                                placeholder="Ej. 60.50"
                                className="max-w-xs"
                              />
                              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                                Opcional — habilita el selector RD$/USD en Procesar Nómina. Es solo una
                                conversión de visualización manual (sin conexión a un servicio de tasas en
                                vivo); el motor de cálculo, la retención de ISR/TSS y todos los reportes
                                siguen calculándose y remitiéndose en RD$ sin excepción.
                              </p>
                            </div>
                          </div>
                        </CollapsibleCard>

                        <SettingsCard icon={PartyPopper} title={`Feriados Nacionales — ${anioActual}`} description="Alimenta el aviso de clasificación H.E. 100% en Procesar Nómina.">
                          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                            Registra las fechas confirmadas de los feriados nacionales de este año. Se usan como
                            recordatorio automático al cargar horas extra en Procesar Nómina — el sistema avisa si
                            el mes tiene un feriado registrado, para clasificar las horas correctamente entre
                            H.E. 35% y H.E. 100% (Art. 203).
                          </p>

                          <form onSubmit={handleAgregarFeriado} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="flex-1">
                              <label className={LABEL_CLASS}>Fecha</label>
                              <FieldInput type="date" icon={CalendarDays} value={nuevaFechaFeriado} onChange={e => setNuevaFechaFeriado(e.target.value)} />
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
                              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B2980] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#151f66] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
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
                            <ul className="divide-y divide-zinc-200 dark:divide-[#252840] overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                              {feriados.map(f => (
                                <li key={f.id} className="flex items-center justify-between gap-3 bg-white dark:bg-[#141722] px-3 py-2.5">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
                                      <PartyPopper className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">{f.nombre}</p>
                                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(f.fecha)}</p>
                                    </div>
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
                        </SettingsCard>
                      </>
                    )}

                    {/* ── Ingresos y Deducciones ──────────────────────────────── */}
                    {vista === 'conceptos' && (
                      <>
                        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
                          <Info className="h-4 w-4 shrink-0 text-[#1B2980] dark:text-indigo-300" />
                          <p className="text-xs text-[#151f66] dark:text-indigo-200">
                            Los conceptos de ley ya calculan correctamente ISR y TSS según la
                            legislación dominicana vigente y no son editables. El catálogo de la
                            empresa le permite agregar ingresos o deducciones propios — al
                            usarlos en Nómina, afectan de verdad el cálculo de ISR y/o TSS según
                            lo que indique aquí.
                          </p>
                        </div>

                        <SettingsCard icon={ShieldCheck} title="Conceptos de Ley" description="Horas extra, comisiones, préstamos, etc. — solo lectura.">
                          <ConceptosLeyTable />
                        </SettingsCard>

                        <SettingsCard icon={Coins} title="Catálogo de la Empresa" description="Ingresos y deducciones adicionales que usted define.">
                          {conceptosPersonalizados.length === 0 && !mostrarFormConcepto && (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                              Todavía no ha agregado ningún concepto propio. Use el botón de abajo
                              para crear el primero — por ejemplo, "Bono de Transporte" o
                              "Descuento de Comedor".
                            </p>
                          )}

                          {conceptosPersonalizados.length > 0 && (
                            <div className="mb-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840]">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concepto</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Afecta ISR</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Afecta TSS</th>
                                    <th className="px-4 py-3" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840] bg-white dark:bg-[#141722]">
                                  {conceptosPersonalizados.map(c => (
                                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]">
                                      <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{c.nombre}</td>
                                      <td className="px-4 py-3">
                                        <span className={cn(
                                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                                          c.tipo === 'ingreso'
                                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50'
                                            : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/50',
                                        )}>
                                          {c.tipo === 'ingreso' ? 'Ingreso' : 'Deducción'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-center"><SiNoBadge value={c.tipo === 'ingreso' && c.afectaISR} /></td>
                                      <td className="px-4 py-3 text-center"><SiNoBadge value={c.tipo === 'ingreso' && c.afectaTSS} /></td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => abrirEditarConcepto(c)}
                                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-[#1a1d2e] dark:hover:text-zinc-200 transition-colors"
                                            title="Editar"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleEliminarConcepto(c)}
                                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                                            title="Quitar del catálogo"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {mostrarFormConcepto ? (
                            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                                {editandoConceptoId ? 'Editar concepto' : 'Nuevo concepto'}
                              </p>
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo</label>
                                  <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                                    <button
                                      onClick={() => setConceptoTipo('ingreso')}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${conceptoTipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Ingreso
                                    </button>
                                    <button
                                      onClick={() => setConceptoTipo('deduccion')}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${conceptoTipo === 'deduccion' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Deducción
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre</label>
                                  <input
                                    type="text"
                                    value={conceptoNombre}
                                    onChange={e => setConceptoNombre(e.target.value)}
                                    placeholder={conceptoTipo === 'ingreso' ? 'Ej. Bono de Transporte' : 'Ej. Descuento de Comedor'}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  />
                                </div>

                                {conceptoTipo === 'ingreso' ? (
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Afecta</label>
                                    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5">
                                      <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                                        <input type="checkbox" checked={conceptoISR} onChange={e => setConceptoISR(e.target.checked)} className="accent-[#1B2980]" />
                                        ISR
                                      </label>
                                      <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                                        <input type="checkbox" checked={conceptoTSS} onChange={e => setConceptoTSS(e.target.checked)} className="accent-[#1B2980]" />
                                        TSS
                                      </label>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-[220px]">
                                    Las deducciones siempre se descuentan del neto, después de calcular ISR y TSS — nunca reducen esas bases.
                                  </p>
                                )}

                                <div className="flex gap-2 self-end">
                                  <button
                                    onClick={handleGuardarConcepto}
                                    disabled={!conceptoNombre.trim()}
                                    className="rounded-lg bg-[#1B2980] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {editandoConceptoId ? 'Guardar' : 'Agregar'}
                                  </button>
                                  <button
                                    onClick={resetFormConcepto}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={abrirNuevoConcepto}
                              className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-[#33395a] px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:border-[#1B2980] hover:text-[#1B2980] dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              Nuevo concepto
                            </button>
                          )}
                        </SettingsCard>
                      </>
                    )}

                    {/* ── Reglas de Negocio ───────────────────────────────────── */}
                    {vista === 'reglas' && (
                      <>
                        <SettingsCard icon={SlidersHorizontal} title="Umbrales de Alerta" description="Criterio interno — nunca bloquean una acción, solo encienden una alerta visual.">
                          <div className="space-y-5">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Estos umbrales son criterio interno de tu empresa — no son topes establecidos por el
                              Código de Trabajo. Ajústalos a tu propio nivel de tolerancia.
                            </p>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                              <ThresholdSlider
                                id="umbralEndeudamientoPct"
                                label="Endeudamiento / descuentos discrecionales"
                                value={form.umbralEndeudamientoPct ?? UMBRAL_ENDEUDAMIENTO_DEFAULT}
                                onChange={n => setForm(prev => ({ ...prev, umbralEndeudamientoPct: n }))}
                                hint="Se usa en Préstamos (Capacidad de Pago) y en la auditoría pre-cierre de Nómina."
                              />
                              <ThresholdSlider
                                id="umbralVariacionBrutoPct"
                                label="Variación de nómina vs. mes anterior"
                                value={form.umbralVariacionBrutoPct ?? UMBRAL_VARIACION_BRUTO_DEFAULT}
                                onChange={n => setForm(prev => ({ ...prev, umbralVariacionBrutoPct: n }))}
                                hint="Avisa en la auditoría pre-cierre cuando el bruto de un empleado varía más de este %."
                              />
                            </div>
                          </div>
                        </SettingsCard>

                        <CollapsibleCard
                          icon={Mail}
                          title="Plantilla de Correo — Comprobantes de Pago"
                          description="El mensaje que se pre-llena al enviar comprobantes desde Procesar Nómina."
                          summary={
                            <p className="truncate text-sm italic text-zinc-600 dark:text-zinc-400">
                              “{form.plantillaComprobanteAsunto ?? plantillaComprobanteDefault().asunto}”
                            </p>
                          }
                        >
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
                            <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                              Variables disponibles (se reemplazan por cada empleado al enviar):{' '}
                              {PLACEHOLDERS_COMPROBANTE.map(p => p.token).join(', ')}
                            </p>
                          </div>
                        </CollapsibleCard>
                      </>
                    )}

                    {/* ── Datos y Migración ───────────────────────────────────── */}
                    {vista === 'datos' && (
                      <>
                        <SettingsCard icon={History} title="Configuración Inicial" description="Carga el historial de una empresa que ya operaba antes de Cielo Cloud.">
                          <ConfiguracionInicialFlow />
                        </SettingsCard>

                        <SettingsCard icon={FlaskConical} title="Datos de Demostración" description="Prueba el sistema con un escenario completo y realista." tone="violet">
                          <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
                            Carga un escenario completo de demostración con 7 empleados, 2 préstamos activos y 4 períodos de nómina
                            cerrados (Marzo–Junio 2026), calculados conforme a la legislación vigente.
                          </p>
                          <ul className="mb-4 mt-2 list-inside list-disc space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
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
                        </SettingsCard>
                      </>
                    )}

                    {/* ── Cumplimiento Legal ──────────────────────────────────── */}
                    {vista === 'legal' && (
                      <>
                        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
                          <Info className="h-4 w-4 shrink-0 text-[#1B2980] dark:text-indigo-300" />
                          <p className="text-xs text-[#151f66] dark:text-indigo-200">
                            Los parámetros mostrados reflejan la legislación vigente en la República Dominicana.
                            Actualice estos valores cuando la DGII, CNSS o el Comité Nacional de Salarios emitan nuevas resoluciones.
                          </p>
                        </div>

                        <SettingsCard icon={Landmark} title="Tasas TSS" description="Tesorería de la Seguridad Social — CNSS.">
                          <ParamTable rows={PARAMS_TSS} />
                        </SettingsCard>

                        <SettingsCard icon={Percent} title="Tramos ISR Asalariados" description="Dirección General de Impuestos Internos — DGII.">
                          <ParamTable rows={PARAMS_ISR} />
                        </SettingsCard>

                        <SettingsCard icon={Coins} title="Salarios Mínimos Nacionales" description="Sector privado no sectorizado.">
                          <ParamTable rows={PARAMS_SALARIOS} />
                        </SettingsCard>
                      </>
                    )}

                  </div>
                </>
              )}
            </div>
          </main>

          {/* ── Barra flotante de cambios sin guardar ───────────────────────── */}
          {isDirty && esVistaFormulario && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-5">
              <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white/95 dark:bg-[#141722]/95 px-5 py-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md animate-modal-in">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Cambios sin guardar
                </div>
                <div className="h-4 w-px bg-zinc-200 dark:bg-[#252840]" />
                <button
                  onClick={handleDiscard}
                  className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1B2980] px-4 py-2 text-xs font-semibold text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar cambios
                </button>
              </div>
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
      {toastConceptos && (
        <Toast
          message={toastConceptos}
          type="success"
          onClose={() => setToastConceptos(null)}
        />
      )}
    </div>
  )
}
