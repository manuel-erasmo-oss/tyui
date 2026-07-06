export type TipoContrato =
  | 'fijo'         // Tiempo indefinido — DGT-3 (registro) / DGT-4 (cambios)
  | 'temporal'     // Tiempo determinado — Art. 33 Código de Trabajo
  | 'estacional'   // Estacional / temporada — DGT-11
  | 'ocasional'    // Móvil / ocasional — DGT-5
  | 'pasante'      // Pasantía
  | 'aprendiz'     // Aprendiz — DGT-10 (Art. 251-257)
  | 'eventual'     // Obra o servicio determinado — Art. 33/74
export type CategoriaRiesgoSRL = 'I' | 'II' | 'III' | 'IV'
export type TipoDocumento = 'cedula' | 'pasaporte' | 'residencia' | 'permiso_trabajo'
export type Banco =
  | 'Banco Popular'
  | 'BanReservas'
  | 'Scotiabank'
  | 'BHD León'
  | 'Banistmo'
  | 'Otro'

export type TipoPeriodo = 'mensual' | 'quincenal'
export type EstadoPeriodo = 'en_proceso' | 'procesada' | 'cerrada'

export type ConceptoAjuste =
  | 'horas_extras_35'
  | 'horas_extras_100'
  | 'recargo_nocturno'
  | 'comision'
  | 'bono'
  | 'prestamo'
  | 'dependiente_sfs'
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

export type ParentescoDependiente =
  | 'hijo_mayor_18_no_estudiante'
  | 'hijo_mayor_21'
  | 'padre_titular'
  | 'madre_titular'
  | 'padre_conyuge'
  | 'madre_conyuge'

export interface Dependiente {
  id: string
  nombre: string
  apellido: string
  cedula?: string
  parentesco: ParentescoDependiente
  fechaNacimiento?: string
}

export interface Empleado {
  id: string
  nombre: string
  apellido: string
  cedula: string               // document number (cédula, pasaporte, residencia, permiso)
  tipoDocumento?: TipoDocumento  // default 'cedula' for backward compat
  nacionalidad?: string        // ISO 3166-1 alpha-2 (e.g. 'DO', 'US')
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
  dependientes?: Dependiente[]
  // Régimen de trabajo intermitente (Resolución 04-93 MdT): jornada de hasta
  // 10h/día y 60h/semana sin generar horas extras bajo los umbrales ordinarios
  // (8h/día, 44h/semana). Aplica a porteros, serenos, guardianes, ascensoristas,
  // mozos/camareros, barberos/manicuristas, empleados de bombas de gasolina, etc.
  // Cambia el divisor del salario diario (26 en vez de 23.83).
  regimenIntermitente?: boolean

  // ─── Saldos iniciales (empleados con historial previo a Cielo Cloud) ───────
  // Se capturan una vez, al migrar un empleado con antigüedad real, para que
  // los cálculos no asuman "cero historial" solo porque el sistema es nuevo.
  saldoVacacionesInicial?: number      // días de vacaciones pendientes reconocidos a la fecha de la carga
  regaliaPagadaEsteAnio?: number       // monto de regalía ya pagado en el año en curso, antes de la migración
  salarioHistoricoReferencia?: number  // salario promedio de referencia (Cesantía/Preaviso/Asistencia Económica)
                                        // mientras se acumulan 12 meses reales de nómina procesada en el sistema
  saldosInicialesRevisado?: boolean    // true una vez que el Asistente de Carga Inicial confirmó este
                                        // empleado (con datos o marcado "no aplica, empleado nuevo")

  // ─── Suspensión de contrato ─────────────────────────────────────────────────
  // Distinto de `activo: false` (liquidación/desvinculación definitiva): el
  // empleado sigue vinculado (conserva antigüedad, sigue en el roster, puede
  // reactivarse) pero no cobra nómina ni acumula vacaciones/regalía mientras
  // dura la suspensión — licencia médica no cubierta, suspensión disciplinaria,
  // permiso sin sueldo extendido, etc. (Arts. 51-53 Código de Trabajo).
  suspendido?: boolean
  fechaSuspension?: string    // ISO date — inicio de la suspensión vigente
  motivoSuspension?: string   // texto libre (ej. "Licencia médica no cubierta")

  // ─── Aporte voluntario a AFP ────────────────────────────────────────────────
  // % adicional sobre el 2.87%/7.10% obligatorio (Ley 87-01). A diferencia del
  // aporte obligatorio, el aporte voluntario del EMPLEADO no reduce la base
  // imponible del ISR — se descuenta después de calcular la retención (carta
  // DGII 2022). El aporte de la EMPRESA (si iguala como beneficio) es un costo
  // adicional para el empleador, no afecta el neto del empleado.
  aporteVoluntarioAFPEmpleadoPct?: number  // % sobre el salario cotizable AFP
  aporteVoluntarioAFPEmpresaPct?: number   // % adicional que la empresa aporta como beneficio

  // ─── Grossing-up: empresa asume ISR/TSS del empleado ───────────────────────
  // % de (AFP+SFS+ISR retenidos al empleado) que la empresa absorbe como
  // beneficio adicional. La retención/remesa a TSS/DGII no cambia (se sigue
  // calculando y reportando igual); lo que cambia es que la empresa reembolsa
  // ese monto al empleado vía el neto, financiándolo como costo adicional.
  grossingUpPct?: number
}

export interface ResultadoNomina {
  empleadoId: string

  // Ingresos
  salarioBruto: number
  importeHE35: number
  importeHE100: number
  totalHorasExtras: number
  importeNocturno: number
  bonificaciones: number
  comisiones: number
  totalBruto: number

  // TSS base
  salarioCotizable: number

  // Descuentos empleado
  afpEmpleado: number
  sfsEmpleado: number
  isrMensual: number
  sfsDependientes: number
  otrosDescuentos: number
  aporteVoluntarioAFPEmpleado: number  // no reduce la base imponible del ISR (post-retención)
  totalDescuentos: number

  // Grossing-up (empresa asume ISR/TSS) — se reembolsa al empleado vía el neto
  grossingUpEmpresa: number

  // Neto
  salarioNeto: number

  // Aportes empleador
  afpEmpleador: number
  sfsEmpleador: number
  srlEmpleador: number
  infotepEmpleador: number
  aporteVoluntarioAFPEmpresa: number   // aporte adicional voluntario de la empresa (beneficio)
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
  horasNocturnas?: number
  bonificaciones?: number
  comisiones?: number
  sfsDependientes?: number
  otrosDescuentos?: number
  categoriaRiesgo?: CategoriaRiesgoSRL
}

// Registro de auditoría cada vez que se reabre (desposteo) un período que ya
// estaba en 'procesada' o 'cerrada' — permite rastrear quién y cuándo deshizo
// un cierre, ya que el sistema no tiene roles de acceso multiusuario (cada
// cuenta es de un solo usuario) para restringir la acción a nivel de permisos.
export interface BitacoraDesposteo {
  fecha: string             // ISO timestamp de cuándo se reabrió
  usuarioEmail: string
  estadoAnterior: EstadoPeriodo
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
  empleadosProcesados?: string[]
  bitacoraDesposteos?: BitacoraDesposteo[]
  pagada?: boolean       // true una vez confirmada la transferencia ACH del período cerrado
  fechaPago?: string     // fecha en que se confirmó el pago (ISO date), solo si pagada === true
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

export type CategoriaEmpresa = 'micro' | 'pequeña' | 'mediana' | 'grande'

// Sector principal de operación — determina la categoría SRL por defecto de los empleados
export type SectorEmpresa = 'oficinas_comercio' | 'industria_liviana' | 'industria_pesada' | 'construccion_mineria'

// Rol de quien administra el sistema — personaliza copy/enfoque, no restringe acceso
export type RolUsuario = 'dueño' | 'contador' | 'rrhh' | 'otro'

export type RangoEmpleados = '1-9' | '10-19' | '20-49' | '50+'

export interface Empresa {
  nombre: string
  rnc: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
  representanteLegal: string
  modalidadNomina?: 'mensual' | 'quincenal'
  logo?: string // base64 data URL
  categoriaEmpresa?: CategoriaEmpresa // define el salario mínimo aplicable (Res. 079-2025)
  sectorEmpresa?: SectorEmpresa
  numeroEmpleadosAprox?: RangoEmpleados
  zonaFranca?: boolean // opera bajo régimen de zona franca — salario mínimo distinto
  rolUsuario?: RolUsuario
  onboardingCompleto?: boolean
  configuracionInicialOfrecida?: boolean  // true una vez que se le presentó (y resolvió, con o sin
                                           // datos) la invitación a cargar saldos iniciales tras el onboarding
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
  // 'avance' (default 'prestamo' para registros previos a este campo): adelanto
  // de salario sin interés, deducido completo en el siguiente período — usa el
  // mismo motor de otorgar/registrarPago/liquidación, solo cambia la etiqueta
  // y el formulario simplificado con el que se otorga.
  tipo?: 'prestamo' | 'avance'
}

// ─── Licencias remuneradas ────────────────────────────────────────────────────
// matrimonial/fallecimiento/alumbramiento: días fijos, pagados 100% por el
// empleador vía nómina normal.
// enfermedad_comun/accidente_laboral/maternidad: "licencias con subsidio" —
// días variables (según certificado médico), con un % de subsidio que paga o
// reembolsa SISALRIL/ARL (no Cielo Cloud, que no desembolsa ese subsidio,
// solo lo registra como referencia) más un "disfrute de sueldo" opcional que
// el empleador puede otorgar como beneficio adicional pagado vía nómina.
export type TipoLicencia =
  | 'matrimonial' | 'fallecimiento' | 'alumbramiento'
  | 'enfermedad_comun' | 'accidente_laboral' | 'maternidad'

export interface Licencia {
  id: string
  empleadoId: string
  tipo: TipoLicencia
  fechaInicio: string   // ISO date string
  fechaFin: string      // ISO date string, calculada automáticamente
  dias: number          // días calendario — fijo según tipo, o capturado del certificado médico
  montoPagado: number   // lo que efectivamente paga el EMPLEADOR vía nómina por este concepto
  notas?: string

  // Solo licencias con subsidio (enfermedad_comun / accidente_laboral / maternidad):
  modalidadEnfermedad?: 'ambulatoria' | 'hospitalaria'  // solo enfermedad_comun — define 60%/40%
  disfruteSueldo?: boolean        // beneficio adicional: el empleador decide pagar el sueldo completo
  montoSubsidioEstimado?: number  // estimado de lo que SISALRIL/ARL paga o reembolsa — informativo
}

// ─── Liquidación de empleados (desvinculación) ───────────────────────────────
export type MotivoLiquidacion =
  | 'renuncia'
  | 'despido_sin_causa'
  | 'despido_con_causa'
  | 'mutuo_acuerdo'
  | 'vencimiento_contrato'

export interface RegistroLiquidacion {
  id: string
  empleadoId: string
  motivo: MotivoLiquidacion
  fechaTerminacion: string   // fecha que el usuario eligió como fecha de salida
  fechaRegistro: string      // ISO timestamp de cuándo se registró la liquidación en el sistema
  anosServicio: number
  cesantia: number
  preaviso: number
  asistenciaEconomica: number
  vacaciones: number
  regalia: number
  totalPrestamosDescontados: number
  totalPagado: number
}
