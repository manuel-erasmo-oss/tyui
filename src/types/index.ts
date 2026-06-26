export type TipoContrato = 'indefinido' | 'tiempo_determinado' | 'obra_servicio'
export type CategoriaRiesgoSRL = 'bajo' | 'medio' | 'alto'
export type TipoDocumento = 'cedula' | 'pasaporte' | 'residencia' | 'permiso_trabajo'
export type Banco =
  | 'Banco Popular'
  | 'BanReservas'
  | 'Scotiabank'
  | 'BHD León'
  | 'Banistmo'
  | 'Otro'

export type TipoPeriodo = 'mensual' | 'quincenal'
export type EstadoPeriodo = 'procesada' | 'cerrada'

export type ConceptoAjuste =
  | 'horas_extras_35'
  | 'horas_extras_100'
  | 'comision'
  | 'bono'
  | 'prestamo'
  | 'otro_ingreso'
  | 'otro_descuento'

export interface AjusteLinea {
  id: string
  tipo: 'ingreso' | 'deduccion'
  concepto: ConceptoAjuste
  descripcion: string
  valor: number
  prestamoId?: string
}

export interface Empleado {
  id: string
  nombre: string
  apellido: string
  cedula: string               // document number (cédula, pasaporte, residencia, permiso)
  tipoDocumento?: TipoDocumento  // default 'cedula' for backward compat
  fechaNacimiento?: string     // ISO date string
  supervisorId?: string        // employee ID of direct supervisor
  fotoPerfil?: string          // full data URL (data:image/...;base64,...) for <img src>
  avatarColor?: string         // hex color for initials avatar background
  documentoIdentidad?: string  // base64-encoded identity document scan (PDF or image)
  documentoIdentidadNombre?: string
  contratoLaboral?: string     // base64-encoded signed contract (PDF)
  contratoLaboralNombre?: string
  cargo: string
  departamento: string
  fechaIngreso: string         // ISO date string
  salarioBase: number          // Monthly salary in RD$
  tipoContrato: TipoContrato
  activo: boolean
  email?: string
  telefono?: string
  numeroCuenta?: string
  banco?: Banco
  categoriaRiesgo?: CategoriaRiesgoSRL
}

export interface ResultadoNomina {
  empleadoId: string

  // Ingresos
  salarioBruto: number
  importeHE35: number
  importeHE100: number
  totalHorasExtras: number
  bonificaciones: number
  comisiones: number
  totalBruto: number

  // TSS base
  salarioCotizable: number

  // Descuentos empleado
  afpEmpleado: number
  sfsEmpleado: number
  isrMensual: number
  otrosDescuentos: number
  totalDescuentos: number

  // Neto
  salarioNeto: number

  // Aportes empleador
  afpEmpleador: number
  sfsEmpleador: number
  srlEmpleador: number
  totalAportesEmpleador: number

  // Costo total empleador
  totalCostoEmpleador: number

  // Provisiones
  regaliaPascual: number
  vacacionesMensualesDias: number
  vacacionesMensualesValor: number

  // Desvinculación (informativo)
  anosServicio: number
}

export interface ParametrosNomina {
  diasTrabajados?: number
  diasLaborablesMes?: number
  horasExtras35?: number
  horasExtras100?: number
  bonificaciones?: number
  comisiones?: number
  otrosDescuentos?: number
  categoriaRiesgo?: CategoriaRiesgoSRL
}

export interface PeriodoNomina {
  id: string
  tipo: TipoPeriodo
  quincena?: 1 | 2
  mes: number
  anio: number
  estado: EstadoPeriodo
  fechaGeneracion: string
  totalEmpleados: number
  totales: {
    bruto: number
    descuentos: number
    neto: number
    aportes: number
    isr: number
    costoTotal: number
  }
  ajustesPorEmpleado?: Record<string, AjusteLinea[]>
}

export interface ResumenNomina {
  periodo: string
  totalEmpleados: number
  totalBruto: number
  totalDescuentosEmpleados: number
  totalAportesEmpleador: number
  totalISRRetenido: number
  totalAFPEmpleados: number
  totalSFSEmpleados: number
  totalNeto: number
  totalCostoEmpresa: number
  totalRegaliaPascual: number
}

export interface Empresa {
  nombre: string
  rnc: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
  representanteLegal: string
  modalidadNomina?: 'mensual' | 'quincenal'
}

export type EstadoPrestamo = 'activo' | 'pagado' | 'cancelado'

export interface CuotaPago {
  id: string
  periodoId?: string
  fecha: string
  montoPagado: number
  esLiquidacion: boolean
}

export interface Prestamo {
  id: string
  empleadoId: string
  monto: number
  saldoPendiente: number
  tasaInteres: number
  cuotas: number
  cuotaBase: number
  frecuencia: 'mensual' | 'quincenal'
  fechaOtorgamiento: string
  fechaFin?: string
  estado: EstadoPrestamo
  pagos: CuotaPago[]
  notas?: string
  documentoSolicitud?: string  // base64-encoded PDF
  documentoNombre?: string     // original filename
}
