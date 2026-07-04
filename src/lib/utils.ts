import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
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

// Format date as "15 jun 2024"
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-DO', {
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
