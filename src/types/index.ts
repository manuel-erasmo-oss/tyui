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

export type TipoPeriodo = 'mensual' | 'quincenal' | 'regalia' | 'bonificacion'
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
  | 'personalizado'  // ver ConceptoPersonalizado — catálogo configurable en Configuración

export interface AjusteLinea {
  id: string
  tipo: 'ingreso' | 'deduccion'
  concepto: ConceptoAjuste
  descripcion: string
  valor: number
  prestamoId?: string
  // ─── Solo presentes cuando concepto === 'personalizado' ────────────────────
  // Snapshot del concepto del catálogo AL MOMENTO de agregar el ajuste (no una
  // referencia viva) — así, editar o desactivar el concepto después nunca
  // altera nóminas ya registradas con este ajuste. Para deducciones,
  // afectaISR/afectaTSS siempre son false (una deducción personalizada nunca
  // reduce la base de ISR ni de TSS — solo el neto, igual que "Otro Desc.").
  conceptoPersonalizadoId?: string
  conceptoPersonalizadoNombre?: string
  afectaISR?: boolean
  afectaTSS?: boolean
}

// ─── Catálogo configurable de ingresos y deducciones ─────────────────────────
// Los 9 conceptos de ConceptoAjuste (horas extra, comisión, bono, préstamo,
// etc.) son de ley — su tratamiento de ISR/TSS ya está implementado
// correctamente en dominican-labor.ts y NO es editable por el usuario. Este
// catálogo permite agregar conceptos ADICIONALES propios de cada empresa
// (ej. "Bono de transporte", "Descuento de comedor"), indicando si afectan
// ISR y/o TSS (solo aplica a ingresos — ver nota arriba sobre deducciones).
export interface ConceptoPersonalizado {
  id: string
  nombre: string
  tipo: 'ingreso' | 'deduccion'
  afectaISR: boolean  // solo relevante si tipo === 'ingreso'
  afectaTSS: boolean  // solo relevante si tipo === 'ingreso'
  activo: boolean      // desactivar en vez de borrar — no rompe ajustes históricos
  creadoEn: string     // ISO date
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
  // Monto de regalía ya pagado, vigente SOLO para el año en `regaliaPagadaAnio`
  // (ver regaliaPagadaVigente() en dominican-labor.ts). Dos orígenes posibles:
  // (1) carga inicial/migración — monto pagado antes de Cielo Cloud, capturado
  // a mano en el Asistente/Importador; (2) el período de nómina de Regalía
  // Pascual (tipo 'regalia') lo estampa automáticamente al procesar el pago,
  // "reiniciando" el acumulado a cero de cara al resto del año. Sin
  // regaliaPagadaAnio (registros previos a este campo) se asume vigente solo
  // para el año calendario actual — así el descuento deja de aplicar solo al
  // llegar el año siguiente, sin necesidad de migrar datos existentes.
  regaliaPagadaEsteAnio?: number
  regaliaPagadaAnio?: number
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
  // Historial completo de suspensiones (no solo la vigente) — reactivar() ya
  // no puede darse el lujo de olvidar la anterior: sin esto, un empleado
  // suspendido y luego reactivado hace años queda indistinguible de uno que
  // nunca estuvo suspendido, lo que generaba falsos positivos en la alerta
  // de "posible pago retroactivo pendiente" (alertas.ts) para meses donde
  // sí estuvo legítimamente ausente por una suspensión ya resuelta.
  historialSuspensiones?: { fechaInicio: string; fechaFin?: string; motivo?: string }[]

  // ─── Salida pendiente de liquidar ───────────────────────────────────────────
  // Se marca al dar de baja a un empleado desde Empleados — ANTES de calcular
  // sus prestaciones en Liquidación. Distinto de `activo: false` (que solo se
  // pone al FINALIZAR la liquidación, no antes): mientras salidaPendiente es
  // true, el empleado sigue en empleadosActivos (sigue siendo seleccionable en
  // Liquidación, conserva su roster/historial) pero sale de empleadosEnNomina
  // (deja de acumular nómina nueva — ya se está yendo).
  salidaPendiente?: boolean
  fechaSalidaPendiente?: string           // fecha de salida capturada al marcar la baja
  motivoSalidaPendiente?: MotivoLiquidacion
  // Cómo se pagarán los días trabajados del período aún no cubiertos por una
  // nómina cerrada (la mayoría de las salidas ocurren a mitad de quincena/mes):
  // 'nomina' los prorratea en el próximo período de Nómina que cubra
  // fechaSalidaPendiente (mismo mecanismo que el prorrateo por suspensión);
  // 'liquidacion' los agrega como línea aparte —con AFP/SFS/ISR calculados,
  // a diferencia de las prestaciones exentas— al finalizar en Liquidación.
  pagoDiasTrabajadosPendiente?: 'nomina' | 'liquidacion'

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

  // ─── Retención consolidada de ISR con otro(s) empleador(es) ────────────────
  // Ingreso bruto mensual que el empleado recibe de OTRO empleador. Solo
  // afecta qué tramo de ISR le corresponde a este ingreso (base consolidada
  // temporal) — nunca la base de TSS ni el neto que paga este empleador.
  ingresoOtroEmpleadorMensual?: number
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
  ingresosPersonalizados: number  // suma de ajustes con concepto personalizado (catálogo configurable)
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
  vacacionesGoce: number  // valor de los días de vacaciones tomados (disfrute) dentro de este período (ya incluido en totalBruto)
  vacacionesVendidas: number  // pago extra por venta de vacaciones dentro de este período (ya incluido en totalBruto)
  totalDescuentos: number

  // Grossing-up (empresa asume ISR/TSS) — se reembolsa al empleado vía el neto
  grossingUpEmpresa: number

  // Saldo a favor del empleado (ISR retenido de más en años anteriores) —
  // se aplica automáticamente contra el ISR calculado de este período
  saldoISRAplicado: number

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
  // ─── Ingresos personalizados (catálogo configurable) ───────────────────────
  // `Total` va siempre a totalBruto (dinero que el empleado efectivamente
  // recibe). `GravablesISR`/`CotizablesTSS` son subconjuntos de ese mismo
  // total — solo la porción cuyo concepto tiene el flag correspondiente
  // activo se suma a la base de ISR y/o TSS respectivamente.
  ingresosPersonalizadosTotal?: number
  ingresosPersonalizadosGravablesISR?: number
  ingresosPersonalizadosCotizablesTSS?: number
  // ─── Goce de vacaciones dentro del período (Disfrute de Vacaciones) ───────
  // Monto YA calculado y escalado por el llamador (nomina/page.tsx) para el
  // período específico que se está calculando — a diferencia de
  // horas extra/bonificaciones (que el usuario entra directo por período),
  // este valor se deriva automáticamente de los días laborables tomados que
  // caen dentro del rango de fechas del período. Se suma a totalBrutoLegado
  // (cotizable TSS + gravable ISR, salario ordinario — Art. 178) y sigue el
  // mismo tratamiento de "halving" quincenal que bonificaciones/comisiones.
  vacacionesGoce?: number
  // ─── Venta de vacaciones ────────────────────────────────────────────────
  // A diferencia de vacacionesGoce (sustituye el salario del período que el
  // empleado NO trabajó), esto es un pago EXTRA sobre el salario normal
  // completo — el empleado sigue trabajando, solo cambia días de descanso
  // futuro por dinero ahora. Mismo tratamiento fiscal (cotizable/gravable),
  // pero se muestra como línea propia para no confundir "goce" con "venta".
  vacacionesVendidas?: number
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
  // Snapshot inmutable del ResultadoNomina REALMENTE calculado y pagado a cada
  // empleado, capturado en el momento exacto en que se procesa (no recalculado
  // después). Es la fuente fidedigna del histórico — a diferencia de recalcular
  // con el Empleado en vivo (que cambiaría retroactivamente si el salario u
  // otros datos del empleado cambian después), este campo nunca cambia una vez
  // escrito. Toda pantalla que reconstruya una nómina PASADA (Reportería,
  // Historial Nómina del empleado, promedio de 12 meses para Liquidación) debe
  // preferir este campo sobre recalcular en vivo. Ausente en períodos creados
  // antes de este campo o en empleados aún no procesados dentro de un período
  // en_proceso — esos casos deben recalcular en vivo (comportamiento anterior).
  resultadosPorEmpleado?: Record<string, ResultadoNomina>
  bitacoraDesposteos?: BitacoraDesposteo[]
  pagada?: boolean       // true una vez confirmada la transferencia ACH del período cerrado
  fechaPago?: string     // fecha en que se confirmó el pago (ISO date), solo si pagada === true

  // ─── Período especial de Regalía Pascual (tipo === 'regalia') ────────────
  // Se crea desde "Solicitar Liquidación de Regalía" en el módulo Regalía
  // Pascual, no desde el formulario normal de "Crear Período" — nace ya con
  // el acumulado de cada empleado congelado (montosRegalia), no con
  // ajustesPorEmpleado/el motor normal de calcularNomina. El pago es bruto,
  // sin AFP/SFS/ISR (mismo tratamiento que Vacaciones/Regalía en
  // Liquidación — no es salario cotizable). Al procesar cada empleado, el
  // sistema estampa Empleado.regaliaPagadaEsteAnio/regaliaPagadaAnio con el
  // monto pagado, "reiniciando" su acumulado a cero.
  montosRegalia?: Record<string, number>
  // Motivo capturado SOLO cuando el usuario editó manualmente el monto
  // sugerido antes de solicitar la liquidación (ajuste manual, ver Regalía
  // Pascual) — para dejar rastro de por qué difiere del cálculo automático.
  motivosAjusteRegalia?: Record<string, string>

  // ─── Período especial de Bonificación por Utilidades (tipo === 'bonificacion') ─
  // Se crea desde "Solicitar Liquidación" en /bonificacion, no desde el
  // formulario normal de "Crear Período" — nace con el monto BRUTO ya
  // calculado por empleado (proporcional al salario, con el tope de 45/60
  // días de Art. 223 ya aplicado), no con ajustesPorEmpleado. A diferencia
  // de la Regalía Pascual (100% exenta), la Bonificación por Utilidades SÍ
  // es salario ordinario a efectos fiscales — lleva AFP/SFS/ISR normales,
  // calculados tratando el monto como si fuera el salario del mes (mismo
  // mecanismo que Vacaciones — ver resultadoBonificacion() en
  // nomina-shared.ts). No hay campo de "acumulado" que reiniciar en
  // Empleado — a diferencia de la Regalía Pascual, la Bonificación no se
  // acumula mes a mes, se calcula una sola vez al año a partir de la
  // utilidad neta que el usuario captura en /bonificacion.
  montosBonificacion?: Record<string, number>
  motivosAjusteBonificacion?: Record<string, string>
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

// ─── Cierre de ejercicio fiscal ──────────────────────────────────────────────
// Determina la ventana de 12 meses sobre la que se calcula la Bonificación
// por Participación en Utilidades (Art. 223-224, Código de Trabajo) y el
// plazo legal de pago (90-120 días después del cierre, Art. 224). Los 4
// valores son los cierres fiscales reconocidos por la DGII en RD.
export type CierreFiscal = 'diciembre' | 'marzo' | 'junio' | 'septiembre'

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
  // Mes en que cierra el ejercicio económico de la empresa — determina la
  // ventana de 12 meses de la Bonificación por Utilidades y su plazo legal
  // de pago (Art. 223/224). Sin configurar, se asume 'diciembre' (año
  // calendario), el caso más común y el comportamiento ya existente antes
  // de este campo.
  cierreFiscal?: CierreFiscal
  numeroEmpleadosAprox?: RangoEmpleados
  zonaFranca?: boolean // opera bajo régimen de zona franca — salario mínimo distinto
  rolUsuario?: RolUsuario
  onboardingCompleto?: boolean
  configuracionInicialOfrecida?: boolean  // true una vez que se le presentó (y resolvió, con o sin
                                           // datos) la invitación a cargar saldos iniciales tras el onboarding
  // ─── Nómina en USD (capa de presentación) ────────────────────────────────
  // Principio de diseño clave: el motor tributario SIEMPRE calcula y persiste
  // en RD$ — esto es solo una conversión de visualización con una tasa que
  // el usuario configura manualmente (no hay integración con un servicio de
  // tasas de cambio en vivo). Nunca se usa como base de ningún cálculo legal
  // (ISR/TSS/prestaciones siguen calculándose y reportándose en RD$).
  tasaCambioUSD?: number  // RD$ por 1 USD

  // ─── Reglas de negocio internas (configurables, no son topes legales) ────
  // Cada empresa puede ajustar estos umbrales de referencia según su propio
  // criterio de riesgo — sin valor definido, el sistema usa el default
  // histórico (30% / 20%) para no romper el comportamiento existente.
  umbralEndeudamientoPct?: number    // % del salario cubierto por descuentos discrecionales
                                      // (préstamos/otros) que dispara la alerta de Capacidad de
                                      // Pago (Préstamos) y de descuento discrecional (auditoría
                                      // pre-cierre de Nómina) — mismo umbral en ambos módulos.
  umbralVariacionBrutoPct?: number   // % de variación del bruto de un empleado vs. el período
                                      // anterior que dispara la alerta en la auditoría pre-cierre.

  // ─── Plantilla de correo de comprobantes de pago ──────────────────────────
  // Si no se configura, se usa plantillaComprobanteDefault() — el mismo texto
  // que ya existía como valor inicial no persistido.
  plantillaComprobanteAsunto?: string
  plantillaComprobanteCuerpo?: string

  // Timestamp ISO de la última vez que se guardó este registro — lo estampa
  // guardar() en empresa-context.tsx automáticamente, no se edita a mano.
  actualizadoEn?: string
}

// Defaults de referencia para los umbrales de negocio configurables —
// centralizados aquí para que Configuración y los módulos que los consumen
// (Nómina, Préstamos) lean siempre el mismo valor si la empresa no los
// personalizó.
export const UMBRAL_ENDEUDAMIENTO_DEFAULT = 30
export const UMBRAL_VARIACION_BRUTO_DEFAULT = 20

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
  // Modo de cálculo de interés (default 'francés' para registros previos a este
  // campo, 100% retrocompatible): 'francés' = cuota fija con interés sobre saldo
  // decreciente (amortización estándar, calcularCuotaBase/calcularAmortizacionFrancesa).
  // 'simple' = interés fijo calculado una sola vez sobre el capital original,
  // repartido en partes iguales en cada cuota junto con el capital — ver
  // calcularAmortizacionSimple() en prestamos-context.tsx.
  modoInteres?: 'francés' | 'simple'
  // ─── Insuficiencia de fondos (Media Prioridad, CLAUDE.md) ──────────────────
  // Cuando el salario neto de un empleado no alcanza para cubrir su cuota de
  // préstamo/avance de este período, la cuota se OMITE ese período en vez de
  // dejar un neto negativo (ver `manejarInsuficienciaFondos` en nomina/page.tsx).
  // `cuotasOmitidasConsecutivas` cuenta esas omisiones seguidas; se resetea a 0
  // en cuanto vuelve a cobrarse una cuota con normalidad (`registrarPago`).
  // Al llegar a 3 seguidas, `requiereGestionCobro` se marca — es solo una
  // bandera informativa para que RRHH le dé seguimiento manual (esta app no
  // tiene un módulo de cuentas por cobrar separado); no bloquea ni cancela
  // el préstamo automáticamente.
  cuotasOmitidasConsecutivas?: number
  requiereGestionCobro?: boolean
}

// ─── Saldo a favor del empleado (ISR retenido de más) ────────────────────────
// Obligación legal real: cuando se retuvo más ISR del que correspondía (ej.
// error de cálculo, cambio de tramo a mitad de año, deducciones no
// consideradas a tiempo), el empleado tiene un crédito que se reintegra
// automáticamente descontándose del ISR calculado en períodos subsecuentes
// (nunca reduce AFP/SFS, solo ISR) hasta agotarse, o se liquida contra
// prestaciones si el empleado se desvincula antes de agotarlo.
export interface AplicacionSaldoISR {
  id: string
  periodoId: string
  periodoLabel: string  // denormalizado para mostrar sin tener que resolver el período
  monto: number
  fecha: string          // ISO timestamp de cuándo se aplicó
}

export type EstadoSaldoISR = 'activo' | 'agotado' | 'liquidado'

// 'retencion_excesiva' (default, retrocompatible con registros previos a este
// campo) vs. 'gastos_educativos' — crédito de ISR por gastos educativos
// (Ley 179-09). Ambos comparten exactamente el mismo mecanismo de aplicación
// (se descuentan del isrMensual calculado, FIFO por fechaRegistro, hasta
// agotarse o liquidarse) — la app NO automatiza el 10%/25% que permite la
// ley (depende de una notificación/aprobación de la DGII que está fuera del
// alcance de este sistema); el usuario registra el monto ya autorizado.
export type TipoCreditoISR = 'retencion_excesiva' | 'gastos_educativos'

export interface SaldoISRFavor {
  id: string
  empleadoId: string
  monto: number             // monto original registrado
  saldoPendiente: number    // lo que queda por aplicar
  motivo: string
  tipo?: TipoCreditoISR     // opcional para no romper registros ya existentes en localStorage
  anio: number              // año fiscal al que corresponde el saldo
  fechaRegistro: string     // ISO date
  estado: EstadoSaldoISR    // 'agotado' = se aplicó completo vía nómina; 'liquidado' = se pagó el resto en una liquidación
  aplicaciones: AplicacionSaldoISR[]
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

// Trazabilidad del reclamo/reembolso del subsidio ante SISALRIL/ARL — solo
// aplica a licencias con montoSubsidioEstimado definido. Para maternidad es
// dinero que la EMPRESA recupera (adelantó el 100% del salario); para
// enfermedad_comun/accidente_laboral el subsidio lo recibe el empleado
// directo, pero igual conviene rastrear si ya se sometió/resolvió el
// reclamo para dar seguimiento administrativo — ver nota en licencias-context.tsx.
export type EstadoReclamoSubsidio = 'por_reclamar' | 'reclamado' | 'reembolsado'

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

  // Documento de soporte (certificado médico, acta de matrimonio/defunción/
  // nacimiento, según el tipo) — mismo patrón base64 que
  // Prestamo.documentoSolicitud/documentoNombre.
  documentoSoporte?: string   // base64
  documentoNombre?: string    // nombre original del archivo

  estadoReclamo?: EstadoReclamoSubsidio  // default 'por_reclamar' al registrar si conSubsidio
  fechaReclamo?: string      // ISO — cuándo se sometió el reclamo ante SISALRIL/ARL
  fechaReembolso?: string    // ISO — cuándo se resolvió/recibió el reembolso
  montoReembolsado?: number  // monto real recibido — puede diferir del estimado
}

// ─── Disfrute de vacaciones ───────────────────────────────────────────────────
// Registro de que un empleado tomó (gozó) un tramo de sus vacaciones ya
// acumuladas — un empleado puede fraccionar sus vacaciones en varios tramos
// a lo largo del año, así que esto es una lista, no un campo único. A
// diferencia de Licencia (pagada 100% vía nómina normal), el disfrute NO se
// paga aparte: durante ese rango de fechas, el período de Nómina que se
// solape prorratea el salario normal (días trabajados) y agrega el valor de
// esos días como "goce vacacional" — salario ordinario cotizable ISR/TSS
// (Art. 178), no una indemnización exenta.
// 'disfrute' (default, retrocompatible con registros previos a este campo):
// el empleado deja de trabajar esos días — el período de Nómina que se
// solape prorratea el salario normal y paga el resto como vacaciones.
// 'venta': el empleado sigue trabajando normal (no se le resta salario
// ordinario) pero además recibe el valor de esos días como un pago extra en
// la Nómina — práctica común en pymes dominicanas aunque el Código de
// Trabajo, en su letra estricta, solo contempla la compensación en dinero al
// terminar el contrato (Art. 178). Para 'venta', fechaInicio === fechaFin
// (una sola fecha efectiva que decide en qué período de Nómina se paga,
// reutilizando el mismo mecanismo de detección por solape ya usado para
// 'disfrute') y `diasLaborables` es la cantidad que el usuario eligió
// vender, no un valor derivado de un rango de fechas.
export type TipoDisfruteVacaciones = 'disfrute' | 'venta'

export interface DisfruteVacaciones {
  id: string
  empleadoId: string
  fechaInicio: string       // ISO date
  fechaFin: string          // ISO date
  // Días laborables (excluye domingos) del tramo — congelado al registrar,
  // es lo que se resta del acumulado disponible (ver diasTomados en
  // vacaciones-context.tsx). Distinto de los días calendario del tramo
  // (fechaFin - fechaInicio), que sí incluyen domingos.
  diasLaborables: number
  tipo?: TipoDisfruteVacaciones
  fechaRegistro: string     // ISO timestamp
  notas?: string
}

// ─── Bandas/niveles salariales ────────────────────────────────────────────────
// Tabla de niveles (mín/medio/máx) por posición, para detectar empleados fuera
// de banda (por debajo del mínimo o por encima del máximo) y visualizar la
// distribución salarial. `posicion` se matchea contra `Empleado.cargo`
// case-insensitive y sin espacios al inicio/final (ver `normalizarPosicion`
// en bandas-salariales-context.tsx).
export interface BandaSalarial {
  id: string
  posicion: string
  salarioMinimo: number
  salarioMedio: number
  salarioMaximo: number
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
  saldoISRReembolsado?: number  // saldo ISR a favor pendiente que se reembolsó en esta liquidación
  totalPagado: number

  // ─── Cumplimiento de preaviso en renuncias (Art. 76) ─────────────────────
  // Solo aplica cuando motivo === 'renuncia'. Opcional para no romper
  // liquidaciones ya existentes en localStorage que se registraron antes de
  // este campo. Fecha en que el empleado avisó su renuncia — distinta de
  // fechaTerminacion (fecha efectiva de salida). El Art. 76 exige que el
  // trabajador avise con la misma anticipación mínima que el empleador
  // (7/14/28 días según antigüedad).
  fechaNotificacionRenuncia?: string

  // ─── Días trabajados pendientes de pago (salida a mitad de período) ──────
  // Solo cuando Empleado.pagoDiasTrabajadosPendiente === 'liquidacion' al
  // momento de finalizar. A diferencia de cesantía/preaviso/asistencia
  // económica (indemnizaciones exentas), estos días SON salario ordinario —
  // llevan AFP/SFS/ISR calculados con el mismo motor de nómina
  // (calcularNomina) sobre los días proporcionales — mismo tratamiento que
  // vacaciones (ver abajo), a diferencia de la Regalía Pascual (100% exenta).
  diasTrabajadosPendientes?: number
  salarioDiasTrabajadosBruto?: number
  afpDiasTrabajados?: number
  sfsDiasTrabajados?: number
  isrDiasTrabajados?: number
  salarioDiasTrabajadosNeto?: number   // ya incluido en totalPagado

  // ─── Retención sobre Vacaciones No Gozadas (Art. 178) ────────────────────
  // Las vacaciones son salario ordinario continuado, no una indemnización
  // exenta — llevan AFP/SFS/ISR normales si el monto supera la exención del
  // ISR, calculadas tratando el bruto como si fuera el salario del mes (ver
  // calcularNomina en dominican-labor.ts). `vacaciones` (arriba) ya es el
  // NETO incluido en totalPagado; estos campos son el desglose de auditoría.
  vacacionesBruto?: number
  afpVacaciones?: number
  sfsVacaciones?: number
  isrVacaciones?: number

  // ─── Método de pago (Recibo de Descargo) ─────────────────────────────────
  // Capturado en el paso de confirmación, antes de generar la planilla en
  // PDF que empleado y empleador firman — queda impreso en ese documento.
  // Opcional para no romper liquidaciones registradas antes de este campo.
  metodoPago?: 'cheque' | 'efectivo' | 'transferencia'
  referenciaPago?: string   // número de cheque / referencia de transferencia — texto libre, opcional

  // ─── Desglose del cálculo, snapshot al momento de finalizar ──────────────
  // Una entrada por concepto (siempre las 6, se haya ajustado o no) con la
  // fórmula ya formateada (días × tarifa, tramo legal aplicado) — es lo que
  // alimenta la planilla en PDF y el Excel de detalle SIN volver a calcular
  // nada después (el empleado ya está inactivo; recalcular en vivo podría
  // dar un resultado distinto si algo cambiara, igual que ya se evita en
  // Reportería vía PeriodoNomina.resultadosPorEmpleado). Si montoFinal
  // difiere de montoAuto, fue un ajuste manual con motivoAjuste obligatorio.
  desgloseCalculo?: DesgloseConceptoLiquidacion[]
}

export type ConceptoLiquidacion = 'cesantia' | 'preaviso' | 'asistenciaEconomica' | 'vacaciones' | 'regalia' | 'diasTrabajados'

export interface DesgloseConceptoLiquidacion {
  concepto: ConceptoLiquidacion
  label: string
  articulo: string        // referencia legal, ej. "Art. 80 — Código de Trabajo"
  detalle: string[]       // líneas de fórmula ya formateadas (ej. "23 días × RD$2,308.02/día")
  montoAuto: number       // lo que el sistema calculó automáticamente
  montoFinal: number      // lo que realmente se pagó (= montoAuto si no se ajustó)
  ajustado: boolean
  motivoAjuste?: string
}

// ─── Feriados Nacionales ──────────────────────────────────────────────────────
// Vivió antes en un módulo "Inicio de Año" con checklist propio (tramos ISR/
// salario mínimo de solo lectura duplicados con Configuración → Cumplimiento
// Legal, un calendario de pago decorativo sin ninguna conexión al resto del
// sistema, y un recordatorio de IR-13 sin fecha real) — retirado por no tener
// una razón de ser clara más allá de esto. Lo único con valor real era el
// calendario de feriados, que sí alimenta un aviso real en Procesar Nómina
// (clasificar horas extra entre H.E. 35%/100%, Art. 203) — se conserva, ahora
// como parte de Configuración → Nómina. Guardado por AÑO CALENDARIO (los
// feriados civiles/móviles cambian de fecha cada año).
export interface FeriadoNacional {
  id: string
  fecha: string   // ISO date (YYYY-MM-DD)
  nombre: string
}

export interface FeriadosAnio {
  anio: number
  feriados: FeriadoNacional[]
}

// ─── Aumentos salariales (selección por criterio + aprobación) ───────────────
// Antes de este tipo, "Aumentos Salariales" escribía directo en
// Empleado.salarioBase sin dejar ningún rastro. Ahora cada solicitud (manual
// por criterio, o importada por Excel) queda registrada aquí con un estado
// explícito — solo `aplicar()` (en aumentos-context.tsx), y únicamente cuando
// el registro ya está 'aprobado', sobreescribe el salario real.
//
// La app no tiene roles de acceso multiusuario reales (mismo caso ya
// documentado para BitacoraDesposteo/desposteo de nómina) — no hay forma de
// exigir que "aprobadoPor" sea una persona distinta de "solicitadoPor". La
// salvaguarda real es la confirmación EXPLÍCITA: un campo de texto obligatorio
// "Aprobado por" que el usuario debe llenar a mano antes de que el registro
// pueda pasar a 'aplicado', dejando un rastro auditable (igual enfoque que el
// desposteo).
export type EstadoAumento = 'pendiente_aprobacion' | 'aprobado' | 'rechazado' | 'aplicado'

export interface RegistroAumento {
  id: string
  empleadoId: string
  salarioAnterior: number
  salarioNuevo: number
  tipoAjuste: 'porcentaje' | 'fijo'
  valorAjuste: number            // % (tipoAjuste 'porcentaje') o monto RD$ sumado al salario anterior (tipoAjuste 'fijo')
  motivo: string
  fechaSolicitud: string          // ISO timestamp
  solicitadoPor?: string          // email de la sesión activa al momento de solicitar (best-effort, no hay roles reales)
  origen?: 'manual' | 'importacion_excel'
  estado: EstadoAumento
  // fechaAprobacion se fija tanto al aprobar como al rechazar — es la fecha de
  // RESOLUCIÓN de la solicitud, no exclusivamente de aprobación; el campo
  // conserva el nombre del enunciado original para no divergir de él.
  fechaAprobacion?: string
  aprobadoPor?: string            // nombre capturado en el campo de confirmación explícita al aprobar
  motivoRechazo?: string          // solo si estado === 'rechazado'
  fechaAplicacion?: string        // ISO timestamp — se fija cuando aplicar() sobreescribe salarioBase
  // Fecha en la que el reajuste debe tomar efecto — DISTINTA de
  // fechaSolicitud/fechaAprobacion/fechaAplicacion, que solo registran cuándo
  // ocurrió cada paso del workflow, nunca desde cuándo debería regir el nuevo
  // salario. Opcional para no romper registros previos a este campo (se
  // asume fechaAplicacion como fallback). Cuando cae dentro de un período de
  // Nómina todavía en_proceso, el motor calcula un salario ponderado por
  // días (ver salarioEfectivoEnPeriodo() en nomina/page.tsx) en vez de
  // aplicar el salario nuevo completo desde el día 1 del período.
  fechaEfectiva?: string          // ISO date string (solo fecha, no timestamp)
}

// ─── Retribuciones Complementarias — Impuesto Sustitutivo 27% (DGII) ──────────
// A diferencia de Regalía/Bonificación (dinero pagado AL empleado vía un
// período especial de Nómina), este es un impuesto que la EMPRESA paga a la
// DGII sobre el valor de beneficios en especie otorgados — nunca pasa por el
// motor de nómina. Se declara mensualmente vía Formulario IR-17 ("Otras
// Retenciones y Retribuciones Complementarias"), a más tardar el día 10 del
// mes siguiente (Guía del Contribuyente No.14, DGII — Código Tributario Ley
// 11-92 y sus modificaciones).
export interface RetribucionComplementaria {
  id: string
  mes: number     // 1-12 — mes en que se otorgó el beneficio (el que se declara)
  anio: number
  concepto: string
  valorMensual: number
  empleadoId?: string  // opcional/informativo — el impuesto lo paga la empresa sin importar el beneficiario
  notas?: string
  // Declaración ante DGII (Formulario IR-17) — se marca a nivel de TODAS las
  // líneas de un mismo mes/año a la vez (una sola declaración mensual cubre
  // todos los conceptos), no por línea individual.
  declarada?: boolean
  fechaDeclaracion?: string  // ISO date string
}
