import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Botón primario compartido — CTA principal de cada página (crear/procesar).
// Mismo tratamiento de elevación que ya usan las pantallas de auth
// (gradiente de marca + lift al hover), ahora disponible para el resto de
// la app. No se aplica a botones compactos dentro de tablas (mínimo color
// en tablas es un principio de diseño ya establecido).
export const BTN_PRIMARY =
  'flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-lg hover:shadow-[#1B2980]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm'

// Namespacea una key de localStorage por usuario (UID de Firebase), para que
// cada cuenta tenga sus propios datos y nunca comparta estado con otra cuenta
// en el mismo navegador.
export function scopedKey(base: string, uid?: string | null): string {
  return uid ? `${base}::${uid}` : base
}

// Format as Dominican Peso
export function formatRD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

// Format number with thousands separator
export function formatNum(n: number, decimals = 2): string {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

// Format Dominican cédula: 001-1234567-8
export function formatCedula(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return raw
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}

// Full name helper
export function fullName(emp: { nombre: string; apellido: string }): string {
  return `${emp.nombre} ${emp.apellido}`
}

// Parsea una fecha SOLO-FECHA ("YYYY-MM-DD", como la que produce cualquier
// <input type="date">) como MEDIANOCHE LOCAL, no UTC. `new Date("2026-06-17")`
// nativo la interpreta como medianoche UTC — en cualquier zona horaria detrás
// de UTC (Rep. Dominicana, UTC-4, siempre) eso cae en el día calendario
// ANTERIOR (16 de junio, 8pm) tan pronto se le pide cualquier componente
// local (getDate/getMonth/getFullYear/getDay, o toLocaleDateString) — bug
// real reportado por el usuario: un empleado creado con fecha de ingreso
// "17 de junio" se mostraba y calculaba como "16 de junio". Si el string
// trae componente de hora (timestamp completo, ej. fechaGeneracion,
// CuotaPago.fecha), se deja el parseo nativo intacto — esos SÍ representan
// un instante real, no una fecha ambigua.
export function parseFechaLocal(iso: string): Date {
  if (!iso) return new Date(NaN)
  if (iso.includes('T')) return new Date(iso)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return new Date(iso)
  return new Date(y, m - 1, d)
}

// "Hoy" como "YYYY-MM-DD" en hora LOCAL — para prellenar <input type="date">
// o comparar contra otras fechas solo-fecha. `new Date().toISOString().split('T')[0]`
// (patrón usado antes en varios formularios) tiene el mismo bug pero al
// revés: convierte el instante actual a UTC antes de cortar la fecha — en
// Rep. Dominicana (UTC-4), cualquier hora local desde las 8pm en adelante ya
// es "mañana" en UTC, así que un formulario abierto de noche prellenaba la
// fecha de MAÑANA en vez de hoy.
export function hoyLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Format date as "15 jun 2024"
export function formatDate(isoDate: string): string {
  return parseFechaLocal(isoDate).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Month/year label "junio 2026"
export function formatPeriodo(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('es-DO', {
    month: 'long',
    year: 'numeric',
  })
}

// Relative time label "hace 3 días" / "hace unos segundos"
export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return 'hace unos segundos'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin === 1 ? '' : 's'}`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `hace ${diffHr} hora${diffHr === 1 ? '' : 's'}`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `hace ${diffDay} día${diffDay === 1 ? '' : 's'}`
  return formatDate(isoDate)
}

// Años de servicio formatted
export function formatAnosServicio(anos: number): string {
  if (anos < 1 / 12) return 'Menos de 1 mes'
  if (anos < 1) {
    const meses = Math.floor(anos * 12)
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  }
  const a = Math.floor(anos)
  const m = Math.floor((anos - a) * 12)
  const aLabel = `${a} ${a === 1 ? 'año' : 'años'}`
  return m > 0 ? `${aLabel} y ${m} ${m === 1 ? 'mes' : 'meses'}` : aLabel
}

// Color class for tipo contrato badge
export function contratoBadgeClass(tipo: string): string {
  switch (tipo) {
    case 'fijo':       return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'temporal':   return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'estacional': return 'bg-sky-50 text-sky-700 ring-sky-200'
    case 'ocasional':  return 'bg-violet-50 text-violet-700 ring-violet-200'
    case 'pasante':    return 'bg-cyan-50 text-cyan-700 ring-cyan-200'
    case 'aprendiz':   return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200'
    case 'eventual':   return 'bg-orange-50 text-orange-700 ring-orange-200'
    default:           return 'bg-zinc-50 text-zinc-700 ring-zinc-200'
  }
}

export function contratoLabel(tipo: string): string {
  switch (tipo) {
    case 'fijo':       return 'Fijo (Indefinido)'
    case 'temporal':   return 'Temporal'
    case 'estacional': return 'Estacional'
    case 'ocasional':  return 'Móvil / Ocasional'
    case 'pasante':    return 'Pasante'
    case 'aprendiz':   return 'Aprendiz'
    case 'eventual':   return 'Eventual (Obra/Servicio)'
    default:           return tipo
  }
}

// Formulario DGT y plazo legal de registro según tipo de contrato
// (Dirección General de Trabajo — solo los tipos con plazo documentado)
export const CONTRATO_DGT_INFO: Partial<Record<string, { formulario: string; plazo: string }>> = {
  fijo: {
    formulario: 'DGT-3 (registro) / DGT-4 (cambios)',
    plazo: 'Registro: 15 días desde inicio de operaciones · Renovación anual antes del 15 de enero · Cambios: primeros 5 días del mes siguiente',
  },
  estacional: {
    formulario: 'DGT-11',
    plazo: 'Primeros 15 días de iniciada la temporada',
  },
  ocasional: {
    formulario: 'DGT-5',
    plazo: 'Primeros 5 días del mes siguiente a la terminación',
  },
  aprendiz: {
    formulario: 'DGT-10',
    plazo: 'Contrato de aprendizaje (Art. 251–257, Código de Trabajo)',
  },
}
