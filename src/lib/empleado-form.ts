import type { Empleado, TipoDocumento, TipoContrato, Banco, SectorEmpresa } from '@/types'
import { getCategoriaSRLPorSector } from './dominican-labor'

// ── Constants ─────────────────────────────────────────────────────────────────
export const BANCOS: Banco[] = ['Banco Popular', 'BanReservas', 'Scotiabank', 'BHD León', 'Banistmo', 'Otro']

export const AVATAR_COLORS = ['#1B2980', '#059669', '#D97706', '#E11D48', '#7C3AED', '#0891B2']

export const DOC_TIPOS: { value: TipoDocumento; label: string; placeholder: string }[] = [
  { value: 'cedula',          label: 'Cédula',             placeholder: '00112345678' },
  { value: 'pasaporte',       label: 'Pasaporte',          placeholder: 'A1234567' },
  { value: 'residencia',      label: 'Residencia',         placeholder: 'RES-2024-00001' },
  { value: 'permiso_trabajo', label: 'Permiso de trabajo', placeholder: 'PT-2024-00001' },
]

export interface Pais {
  code: string
  nombre: string
  bandera: string
  docDefault: TipoDocumento
}

export const PAISES: Pais[] = [
  // ── Caribe / República Dominicana primero ──────────────────────────────────
  { code: 'DO', nombre: 'República Dominicana',    bandera: '🇩🇴', docDefault: 'cedula' },
  { code: 'HT', nombre: 'Haití',                   bandera: '🇭🇹', docDefault: 'pasaporte' },
  { code: 'CU', nombre: 'Cuba',                    bandera: '🇨🇺', docDefault: 'pasaporte' },
  { code: 'PR', nombre: 'Puerto Rico',             bandera: '🇵🇷', docDefault: 'pasaporte' },
  { code: 'JM', nombre: 'Jamaica',                 bandera: '🇯🇲', docDefault: 'pasaporte' },
  { code: 'TT', nombre: 'Trinidad y Tobago',       bandera: '🇹🇹', docDefault: 'pasaporte' },
  { code: 'BB', nombre: 'Barbados',                bandera: '🇧🇧', docDefault: 'pasaporte' },
  { code: 'BS', nombre: 'Bahamas',                 bandera: '🇧🇸', docDefault: 'pasaporte' },
  { code: 'AG', nombre: 'Antigua y Barbuda',       bandera: '🇦🇬', docDefault: 'pasaporte' },
  { code: 'DM', nombre: 'Dominica',                bandera: '🇩🇲', docDefault: 'pasaporte' },
  { code: 'GD', nombre: 'Granada',                 bandera: '🇬🇩', docDefault: 'pasaporte' },
  { code: 'LC', nombre: 'Santa Lucía',             bandera: '🇱🇨', docDefault: 'pasaporte' },
  { code: 'VC', nombre: 'San Vicente y Granadinas',bandera: '🇻🇨', docDefault: 'pasaporte' },
  { code: 'KN', nombre: 'San Cristóbal y Nieves',  bandera: '🇰🇳', docDefault: 'pasaporte' },
  // ── América Central ────────────────────────────────────────────────────────
  { code: 'GT', nombre: 'Guatemala',               bandera: '🇬🇹', docDefault: 'pasaporte' },
  { code: 'HN', nombre: 'Honduras',                bandera: '🇭🇳', docDefault: 'pasaporte' },
  { code: 'SV', nombre: 'El Salvador',             bandera: '🇸🇻', docDefault: 'pasaporte' },
  { code: 'NI', nombre: 'Nicaragua',               bandera: '🇳🇮', docDefault: 'pasaporte' },
  { code: 'CR', nombre: 'Costa Rica',              bandera: '🇨🇷', docDefault: 'pasaporte' },
  { code: 'PA', nombre: 'Panamá',                  bandera: '🇵🇦', docDefault: 'pasaporte' },
  { code: 'BZ', nombre: 'Belice',                  bandera: '🇧🇿', docDefault: 'pasaporte' },
  // ── América del Sur ────────────────────────────────────────────────────────
  { code: 'CO', nombre: 'Colombia',                bandera: '🇨🇴', docDefault: 'pasaporte' },
  { code: 'VE', nombre: 'Venezuela',               bandera: '🇻🇪', docDefault: 'pasaporte' },
  { code: 'BR', nombre: 'Brasil',                  bandera: '🇧🇷', docDefault: 'pasaporte' },
  { code: 'AR', nombre: 'Argentina',               bandera: '🇦🇷', docDefault: 'pasaporte' },
  { code: 'CL', nombre: 'Chile',                   bandera: '🇨🇱', docDefault: 'pasaporte' },
  { code: 'PE', nombre: 'Perú',                    bandera: '🇵🇪', docDefault: 'pasaporte' },
  { code: 'EC', nombre: 'Ecuador',                 bandera: '🇪🇨', docDefault: 'pasaporte' },
  { code: 'BO', nombre: 'Bolivia',                 bandera: '🇧🇴', docDefault: 'pasaporte' },
  { code: 'PY', nombre: 'Paraguay',                bandera: '🇵🇾', docDefault: 'pasaporte' },
  { code: 'UY', nombre: 'Uruguay',                 bandera: '🇺🇾', docDefault: 'pasaporte' },
  { code: 'GY', nombre: 'Guyana',                  bandera: '🇬🇾', docDefault: 'pasaporte' },
  { code: 'SR', nombre: 'Surinam',                 bandera: '🇸🇷', docDefault: 'pasaporte' },
  // ── América del Norte ──────────────────────────────────────────────────────
  { code: 'MX', nombre: 'México',                  bandera: '🇲🇽', docDefault: 'pasaporte' },
  { code: 'US', nombre: 'Estados Unidos',          bandera: '🇺🇸', docDefault: 'pasaporte' },
  { code: 'CA', nombre: 'Canadá',                  bandera: '🇨🇦', docDefault: 'pasaporte' },
  // ── Europa ─────────────────────────────────────────────────────────────────
  { code: 'ES', nombre: 'España',                  bandera: '🇪🇸', docDefault: 'pasaporte' },
  { code: 'PT', nombre: 'Portugal',                bandera: '🇵🇹', docDefault: 'pasaporte' },
  { code: 'IT', nombre: 'Italia',                  bandera: '🇮🇹', docDefault: 'pasaporte' },
  { code: 'FR', nombre: 'Francia',                 bandera: '🇫🇷', docDefault: 'pasaporte' },
  { code: 'DE', nombre: 'Alemania',                bandera: '🇩🇪', docDefault: 'pasaporte' },
  { code: 'GB', nombre: 'Reino Unido',             bandera: '🇬🇧', docDefault: 'pasaporte' },
  { code: 'NL', nombre: 'Países Bajos',            bandera: '🇳🇱', docDefault: 'pasaporte' },
  { code: 'BE', nombre: 'Bélgica',                 bandera: '🇧🇪', docDefault: 'pasaporte' },
  { code: 'CH', nombre: 'Suiza',                   bandera: '🇨🇭', docDefault: 'pasaporte' },
  { code: 'AT', nombre: 'Austria',                 bandera: '🇦🇹', docDefault: 'pasaporte' },
  { code: 'SE', nombre: 'Suecia',                  bandera: '🇸🇪', docDefault: 'pasaporte' },
  { code: 'NO', nombre: 'Noruega',                 bandera: '🇳🇴', docDefault: 'pasaporte' },
  { code: 'DK', nombre: 'Dinamarca',               bandera: '🇩🇰', docDefault: 'pasaporte' },
  { code: 'FI', nombre: 'Finlandia',               bandera: '🇫🇮', docDefault: 'pasaporte' },
  { code: 'IE', nombre: 'Irlanda',                 bandera: '🇮🇪', docDefault: 'pasaporte' },
  { code: 'PL', nombre: 'Polonia',                 bandera: '🇵🇱', docDefault: 'pasaporte' },
  { code: 'CZ', nombre: 'República Checa',         bandera: '🇨🇿', docDefault: 'pasaporte' },
  { code: 'RO', nombre: 'Rumania',                 bandera: '🇷🇴', docDefault: 'pasaporte' },
  { code: 'HU', nombre: 'Hungría',                 bandera: '🇭🇺', docDefault: 'pasaporte' },
  { code: 'GR', nombre: 'Grecia',                  bandera: '🇬🇷', docDefault: 'pasaporte' },
  { code: 'TR', nombre: 'Turquía',                 bandera: '🇹🇷', docDefault: 'pasaporte' },
  { code: 'UA', nombre: 'Ucrania',                 bandera: '🇺🇦', docDefault: 'pasaporte' },
  { code: 'RU', nombre: 'Rusia',                   bandera: '🇷🇺', docDefault: 'pasaporte' },
  // ── Oriente Medio ──────────────────────────────────────────────────────────
  { code: 'LB', nombre: 'Líbano',                  bandera: '🇱🇧', docDefault: 'pasaporte' },
  { code: 'SY', nombre: 'Siria',                   bandera: '🇸🇾', docDefault: 'pasaporte' },
  { code: 'JO', nombre: 'Jordania',                bandera: '🇯🇴', docDefault: 'pasaporte' },
  { code: 'IL', nombre: 'Israel',                  bandera: '🇮🇱', docDefault: 'pasaporte' },
  { code: 'SA', nombre: 'Arabia Saudita',          bandera: '🇸🇦', docDefault: 'pasaporte' },
  { code: 'AE', nombre: 'Emiratos Árabes Unidos',  bandera: '🇦🇪', docDefault: 'pasaporte' },
  { code: 'KW', nombre: 'Kuwait',                  bandera: '🇰🇼', docDefault: 'pasaporte' },
  { code: 'QA', nombre: 'Catar',                   bandera: '🇶🇦', docDefault: 'pasaporte' },
  { code: 'IQ', nombre: 'Irak',                    bandera: '🇮🇶', docDefault: 'pasaporte' },
  { code: 'IR', nombre: 'Irán',                    bandera: '🇮🇷', docDefault: 'pasaporte' },
  // ── África ─────────────────────────────────────────────────────────────────
  { code: 'EG', nombre: 'Egipto',                  bandera: '🇪🇬', docDefault: 'pasaporte' },
  { code: 'MA', nombre: 'Marruecos',               bandera: '🇲🇦', docDefault: 'pasaporte' },
  { code: 'DZ', nombre: 'Argelia',                 bandera: '🇩🇿', docDefault: 'pasaporte' },
  { code: 'TN', nombre: 'Túnez',                   bandera: '🇹🇳', docDefault: 'pasaporte' },
  { code: 'NG', nombre: 'Nigeria',                 bandera: '🇳🇬', docDefault: 'pasaporte' },
  { code: 'GH', nombre: 'Ghana',                   bandera: '🇬🇭', docDefault: 'pasaporte' },
  { code: 'SN', nombre: 'Senegal',                 bandera: '🇸🇳', docDefault: 'pasaporte' },
  { code: 'CI', nombre: 'Costa de Marfil',         bandera: '🇨🇮', docDefault: 'pasaporte' },
  { code: 'CM', nombre: 'Camerún',                 bandera: '🇨🇲', docDefault: 'pasaporte' },
  { code: 'ET', nombre: 'Etiopía',                 bandera: '🇪🇹', docDefault: 'pasaporte' },
  { code: 'KE', nombre: 'Kenia',                   bandera: '🇰🇪', docDefault: 'pasaporte' },
  { code: 'TZ', nombre: 'Tanzania',                bandera: '🇹🇿', docDefault: 'pasaporte' },
  { code: 'ZA', nombre: 'Sudáfrica',               bandera: '🇿🇦', docDefault: 'pasaporte' },
  { code: 'AO', nombre: 'Angola',                  bandera: '🇦🇴', docDefault: 'pasaporte' },
  { code: 'MZ', nombre: 'Mozambique',              bandera: '🇲🇿', docDefault: 'pasaporte' },
  // ── Asia ───────────────────────────────────────────────────────────────────
  { code: 'IN', nombre: 'India',                   bandera: '🇮🇳', docDefault: 'pasaporte' },
  { code: 'PK', nombre: 'Pakistán',                bandera: '🇵🇰', docDefault: 'pasaporte' },
  { code: 'BD', nombre: 'Bangladesh',              bandera: '🇧🇩', docDefault: 'pasaporte' },
  { code: 'CN', nombre: 'China',                   bandera: '🇨🇳', docDefault: 'pasaporte' },
  { code: 'JP', nombre: 'Japón',                   bandera: '🇯🇵', docDefault: 'pasaporte' },
  { code: 'KR', nombre: 'Corea del Sur',           bandera: '🇰🇷', docDefault: 'pasaporte' },
  { code: 'TW', nombre: 'Taiwán',                  bandera: '🇹🇼', docDefault: 'pasaporte' },
  { code: 'HK', nombre: 'Hong Kong',               bandera: '🇭🇰', docDefault: 'pasaporte' },
  { code: 'SG', nombre: 'Singapur',                bandera: '🇸🇬', docDefault: 'pasaporte' },
  { code: 'MY', nombre: 'Malasia',                 bandera: '🇲🇾', docDefault: 'pasaporte' },
  { code: 'ID', nombre: 'Indonesia',               bandera: '🇮🇩', docDefault: 'pasaporte' },
  { code: 'PH', nombre: 'Filipinas',               bandera: '🇵🇭', docDefault: 'pasaporte' },
  { code: 'TH', nombre: 'Tailandia',               bandera: '🇹🇭', docDefault: 'pasaporte' },
  { code: 'VN', nombre: 'Vietnam',                 bandera: '🇻🇳', docDefault: 'pasaporte' },
  // ── Oceanía ────────────────────────────────────────────────────────────────
  { code: 'AU', nombre: 'Australia',               bandera: '🇦🇺', docDefault: 'pasaporte' },
  { code: 'NZ', nombre: 'Nueva Zelanda',           bandera: '🇳🇿', docDefault: 'pasaporte' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getPais(code: string): Pais | undefined {
  return PAISES.find(p => p.code === code)
}

export function formatDocNumber(num: string, tipo?: TipoDocumento): string {
  if ((tipo ?? 'cedula') === 'cedula') {
    const d = num.replace(/\D/g, '')
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
  }
  return num.toUpperCase()
}

export function labelTipoDoc(tipo?: TipoDocumento): string {
  return DOC_TIPOS.find(t => t.value === (tipo ?? 'cedula'))?.label ?? 'Cédula'
}

export function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function downloadBase64(base64: string, filename: string) {
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

// ── Form state ────────────────────────────────────────────────────────────────
export interface EmpForm {
  nombre: string; apellido: string
  nacionalidad: string
  tipoDocumento: TipoDocumento; cedula: string
  fechaNacimiento: string
  email: string; telefono: string
  cargo: string; departamento: string
  fechaIngreso: string; salarioBase: string
  tipoContrato: TipoContrato
  supervisorId: string
  banco: Banco | ''; numeroCuenta: string
  avatarColor: string
  fotoPerfil: string
  documentoIdentidad: string
  documentoIdentidadNombre: string
  contratoLaboral: string
  contratoLaboralNombre: string
  regimenIntermitente: boolean
  saldoVacacionesInicial: string
  regaliaPagadaEsteAnio: string
  salarioHistoricoReferencia: string
  aporteVoluntarioAFPEmpleadoPct: string
  aporteVoluntarioAFPEmpresaPct: string
  grossingUpPct: string
}

export const EMPTY_EMP_FORM: EmpForm = {
  nombre: '', apellido: '', nacionalidad: 'DO',
  tipoDocumento: 'cedula', cedula: '',
  fechaNacimiento: '', email: '', telefono: '',
  cargo: '', departamento: '', fechaIngreso: '', salarioBase: '',
  tipoContrato: 'fijo', supervisorId: '',
  banco: '', numeroCuenta: '', avatarColor: '#1B2980',
  fotoPerfil: '', documentoIdentidad: '', documentoIdentidadNombre: '',
  contratoLaboral: '', contratoLaboralNombre: '',
  regimenIntermitente: false,
  saldoVacacionesInicial: '', regaliaPagadaEsteAnio: '', salarioHistoricoReferencia: '',
  aporteVoluntarioAFPEmpleadoPct: '', aporteVoluntarioAFPEmpresaPct: '',
  grossingUpPct: '',
}

export function toEmpForm(e: Empleado): EmpForm {
  return {
    nombre: e.nombre, apellido: e.apellido,
    nacionalidad: e.nacionalidad ?? 'DO',
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
    regimenIntermitente: e.regimenIntermitente ?? false,
    saldoVacacionesInicial: e.saldoVacacionesInicial != null ? String(e.saldoVacacionesInicial) : '',
    regaliaPagadaEsteAnio: e.regaliaPagadaEsteAnio != null ? String(e.regaliaPagadaEsteAnio) : '',
    salarioHistoricoReferencia: e.salarioHistoricoReferencia != null ? String(e.salarioHistoricoReferencia) : '',
    aporteVoluntarioAFPEmpleadoPct: e.aporteVoluntarioAFPEmpleadoPct != null ? String(e.aporteVoluntarioAFPEmpleadoPct) : '',
    aporteVoluntarioAFPEmpresaPct: e.aporteVoluntarioAFPEmpresaPct != null ? String(e.aporteVoluntarioAFPEmpresaPct) : '',
    grossingUpPct: e.grossingUpPct != null ? String(e.grossingUpPct) : '',
  }
}

export function formToEmpleado(form: EmpForm, sectorEmpresa?: SectorEmpresa): Omit<Empleado, 'id' | 'activo'> {
  return {
    nombre:          form.nombre.trim(),
    apellido:        form.apellido.trim(),
    cedula:          form.tipoDocumento === 'cedula'
                       ? form.cedula.replace(/\D/g, '')
                       : form.cedula.trim().toUpperCase(),
    tipoDocumento:   form.tipoDocumento,
    nacionalidad:    form.nacionalidad || undefined,
    fechaNacimiento: form.fechaNacimiento || undefined,
    supervisorId:    form.supervisorId || undefined,
    avatarColor:     form.avatarColor,
    fotoPerfil:      form.fotoPerfil || undefined,
    documentoIdentidad:       form.documentoIdentidad || undefined,
    documentoIdentidadNombre: form.documentoIdentidadNombre || undefined,
    contratoLaboral:          form.contratoLaboral || undefined,
    contratoLaboralNombre:    form.contratoLaboralNombre || undefined,
    cargo:           form.cargo.trim(),
    departamento:    form.departamento.trim(),
    fechaIngreso:    form.fechaIngreso,
    salarioBase:     Number(form.salarioBase),
    tipoContrato:    form.tipoContrato,
    email:           form.email.trim() || undefined,
    telefono:        form.telefono.trim() || undefined,
    banco:           (form.banco as Banco) || undefined,
    numeroCuenta:    form.numeroCuenta.trim() || undefined,
    categoriaRiesgo: getCategoriaSRLPorSector(sectorEmpresa),
    regimenIntermitente: form.regimenIntermitente,
    saldoVacacionesInicial:     form.saldoVacacionesInicial     ? Number(form.saldoVacacionesInicial)     : undefined,
    regaliaPagadaEsteAnio:      form.regaliaPagadaEsteAnio      ? Number(form.regaliaPagadaEsteAnio)      : undefined,
    salarioHistoricoReferencia: form.salarioHistoricoReferencia ? Number(form.salarioHistoricoReferencia) : undefined,
    aporteVoluntarioAFPEmpleadoPct: form.aporteVoluntarioAFPEmpleadoPct ? Number(form.aporteVoluntarioAFPEmpleadoPct) : undefined,
    aporteVoluntarioAFPEmpresaPct:  form.aporteVoluntarioAFPEmpresaPct  ? Number(form.aporteVoluntarioAFPEmpresaPct)  : undefined,
    grossingUpPct:                  form.grossingUpPct                 ? Number(form.grossingUpPct)                  : undefined,
  }
}

export function validateEmpForm(form: EmpForm): Partial<Record<keyof EmpForm, string>> {
  const e: Partial<Record<keyof EmpForm, string>> = {}
  if (!form.nombre.trim())       e.nombre       = 'Requerido'
  if (!form.apellido.trim())     e.apellido     = 'Requerido'
  if (!form.nacionalidad)        e.nacionalidad = 'Requerido'
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
  return e
}
