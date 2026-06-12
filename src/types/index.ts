export type TipoContrato = 'indefinido' | 'tiempo_determinado' | 'obra_servicio'
export type CategoriaRiesgoSRL = 'bajo' | 'medio' | 'alto'
export type Banco =
  | 'Banco Popular'
  | 'BanReservas'
  | 'Scotiabank'
  | 'BHD León'
  | 'Banistmo'
  | 'Otro'

export interface Empleado {
  id: string
  nombre: string
  apellido: string
  cedula: string          // Dominican cédula: 001-1234567-8
  cargo: string
  departamento: string
  fechaIngreso: string    // ISO date string
  salarioBase: number     // Monthly salary in RD$
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
