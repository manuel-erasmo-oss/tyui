import type { AjusteLinea, CategoriaEmpresa, CategoriaRiesgoSRL, Empleado, Empresa, ParametrosNomina, PeriodoNomina, ResultadoNomina, SectorEmpresa } from '@/types'

// ─── ISR Brackets 2024 (annual RD$) ──────────────────────────────────────────
// Source: DGII, Ley 11-92 art. 296 según modificaciones vigentes
// Exportado (además de usarse internamente) para que el Checklist de Inicio de
// Año muestre los tramos vigentes sin duplicar los valores en otro archivo.
export const TRAMOS_ISR = [
  { hasta: 416_220.00, tasa: 0.00, fijo: 0 },
  { hasta: 624_329.00, tasa: 0.15, fijo: 0 },
  { hasta: 867_123.00, tasa: 0.20, fijo: 31_216.00 },
  { hasta: Infinity,   tasa: 0.25, fijo: 79_776.00 },
] as const

// ─── TSS Contribution Rates ───────────────────────────────────────────────────
// Source: CNSS, Ley 87-01 y reglamentos vigentes
export const TASAS_TSS = {
  afpEmpleado:     0.0287,
  afpEmpleador:    0.0710,
  sfsEmpleado:     0.0304,
  sfsEmpleador:    0.0709,
  srlCategoriaI:   0.0110,  // I — oficinas y comercio
  srlCategoriaII:  0.0115,  // II — industria liviana
  srlCategoriaIII: 0.0120,  // III — industria pesada
  srlCategoriaIV:  0.0130,  // IV — construcción y minería (alto riesgo)
  infotepEmpleador: 0.01,   // Infotep — aporte obligatorio del empleador
} as const

// ─── Salarios Mínimos vigentes desde 01-feb-2026 (Resolución 079-2025, Ministerio de Industria, Comercio y Mipymes) ─
export const SALARIO_MINIMO = {
  grandesEmpresas:  29_988.00,
  medianaEmpresa:   27_489.60,
  pequeñasEmpresas: 18_421.20,
  microempresas:    16_993.20,
  zonaFranca:       15_800,     // sin cambios — resolución distinta
} as const

// Salario mínimo cotizable TSS vigente desde 01-feb-2026 (Resolución 079-2025 CNSS)
export const SALARIO_MINIMO_COTIZABLE_TSS = 23_223.00

// Salario mínimo aplicable según la categoría de la empresa (Res. 079-2025)
export function getSalarioMinimoPorCategoria(categoria: CategoriaEmpresa): number {
  switch (categoria) {
    case 'grande':  return SALARIO_MINIMO.grandesEmpresas
    case 'mediana': return SALARIO_MINIMO.medianaEmpresa
    case 'pequeña': return SALARIO_MINIMO.pequeñasEmpresas
    case 'micro':   return SALARIO_MINIMO.microempresas
  }
}

// Salario mínimo realmente aplicable a la empresa — considera zona franca (resolución distinta)
// antes que la categoría general por tamaño
export function getSalarioMinimoAplicable(empresa: Pick<Empresa, 'categoriaEmpresa' | 'zonaFranca'>): number | null {
  if (empresa.zonaFranca) return SALARIO_MINIMO.zonaFranca
  if (empresa.categoriaEmpresa) return getSalarioMinimoPorCategoria(empresa.categoriaEmpresa)
  return null
}

// Sector principal de operación → categoría SRL sugerida por defecto para nuevos empleados
export const SECTOR_A_CATEGORIA_SRL: Record<SectorEmpresa, CategoriaRiesgoSRL> = {
  oficinas_comercio:   'I',
  industria_liviana:   'II',
  industria_pesada:    'III',
  construccion_mineria: 'IV',
}

export function getCategoriaSRLPorSector(sector?: SectorEmpresa): CategoriaRiesgoSRL {
  return sector ? SECTOR_A_CATEGORIA_SRL[sector] : 'I'
}

export const TOPE_COTIZABLE_AFP = SALARIO_MINIMO_COTIZABLE_TSS * 20  // RD$464,460 — 20× salario mínimo
export const TOPE_COTIZABLE_SFS = SALARIO_MINIMO_COTIZABLE_TSS * 10  // RD$232,230 — 10× salario mínimo
export const TOPE_COTIZABLE_SRL = SALARIO_MINIMO_COTIZABLE_TSS * 4   // RD$92,892  — 4× salario mínimo

// Resolución 624-02 CNSS: cuota fija mensual por dependiente adicional (vigente 2024-2025)
export const CUOTA_DEP_SFS_MENSUAL = 1_919.78

export function cuotaDependienteSFS(): number {
  return CUOTA_DEP_SFS_MENSUAL
}

// ─── Parámetros laborales (Código de Trabajo Ley 16-92) ──────────────────────
export const HORAS_SEMANA = 44                     // Art. 147: semana de 44h
export const DIAS_VACACIONES_HASTA_5_ANOS = 14     // Art. 177: 14 días laborables
export const DIAS_VACACIONES_MAS_5_ANOS = 18       // Art. 177: 18 días laborables

// ─── Régimen de trabajo intermitente (Resolución 04-93, Ministerio de Trabajo) ─
// Jornada de hasta 10h/día y 60h/semana sin generar horas extras bajo esos
// umbrales (portería, vigilancia, ascensoristas, mozos, barberos, bombas de
// gasolina, etc.) — distinto del régimen ordinario (8h/día, 44h/semana).
export const HORAS_DIA_REGIMEN_INTERMITENTE    = 10
export const HORAS_SEMANA_REGIMEN_INTERMITENTE = 60
export const DIVISOR_DIA_ORDINARIO     = 23.83  // salario mensual ÷ días laborables promedio
export const DIVISOR_DIA_INTERMITENTE  = 26     // salario mensual ÷ 26 (régimen intermitente)

// Divisor correcto del salario diario según el régimen de jornada del empleado
export function getDivisorSalarioDiario(empleado: Pick<Empleado, 'regimenIntermitente'>): number {
  return empleado.regimenIntermitente ? DIVISOR_DIA_INTERMITENTE : DIVISOR_DIA_ORDINARIO
}

// ─── Cálculo ISR anual ────────────────────────────────────────────────────────
export function calcularISRAnual(ingresoGravableAnual: number): number {
  if (ingresoGravableAnual <= TRAMOS_ISR[0].hasta) return 0
  if (ingresoGravableAnual <= TRAMOS_ISR[1].hasta)
    return (ingresoGravableAnual - TRAMOS_ISR[0].hasta) * TRAMOS_ISR[1].tasa
  if (ingresoGravableAnual <= TRAMOS_ISR[2].hasta)
    return TRAMOS_ISR[2].fijo + (ingresoGravableAnual - TRAMOS_ISR[1].hasta) * TRAMOS_ISR[2].tasa
  return TRAMOS_ISR[3].fijo + (ingresoGravableAnual - TRAMOS_ISR[2].hasta) * TRAMOS_ISR[3].tasa
}

// ─── Cálculo de nómina mensual ────────────────────────────────────────────────
export function calcularNomina(
  empleado: Empleado,
  params: ParametrosNomina = {}
): ResultadoNomina {
  const {
    diasTrabajados    = 23.83,  // promedio días laborables mes RD
    diasLaborablesMes = 23.83,
    horasExtras35     = 0,
    horasExtras100    = 0,
    horasNocturnas    = 0,
    bonificaciones    = 0,
    comisiones        = 0,
    sfsDependientes   = 0,
    otrosDescuentos   = 0,
    categoriaRiesgo   = empleado.categoriaRiesgo ?? 'I',
  } = params

  // Salario proporcional a días trabajados
  const salarioBruto = empleado.salarioBase * (diasTrabajados / diasLaborablesMes)

  // Horas extras (Art. 203 Código de Trabajo)
  // Tarifa hora = salario mensual / (horas semana × 52 / 12)
  const salarioHora = empleado.salarioBase / (HORAS_SEMANA * 52 / 12)
  const importeHE35  = horasExtras35  * salarioHora * 1.35  // 35% recargo
  const importeHE100 = horasExtras100 * salarioHora * 2.00  // 100% recargo (feriados)
  const totalHorasExtras = importeHE35 + importeHE100

  // Recargo nocturno (práctica estándar TSS) — 15% adicional puro sobre la tarifa
  // hora regular (el salario base ya cubre la hora regular trabajada)
  const importeNocturno = horasNocturnas * salarioHora * 0.15

  const totalBruto = salarioBruto + totalHorasExtras + importeNocturno + bonificaciones + comisiones

  // ─── TSS (cada aporte capea sobre su propia base — topes distintos) ───────
  const baseCotizableAFP = Math.min(totalBruto, TOPE_COTIZABLE_AFP)
  const baseCotizableSFS = Math.min(totalBruto, TOPE_COTIZABLE_SFS)
  const baseCotizableSRL = Math.min(totalBruto, TOPE_COTIZABLE_SRL)

  // Salario cotizable mostrado en UI = base AFP (la más alta de las tres, más representativa)
  const salarioCotizable = baseCotizableAFP

  const afpEmpleado  = baseCotizableAFP * TASAS_TSS.afpEmpleado
  const sfsEmpleado  = baseCotizableSFS * TASAS_TSS.sfsEmpleado
  const afpEmpleador = baseCotizableAFP * TASAS_TSS.afpEmpleador
  const sfsEmpleador = baseCotizableSFS * TASAS_TSS.sfsEmpleador

  const tasaSRL = categoriaRiesgo === 'IV'
    ? TASAS_TSS.srlCategoriaIV
    : categoriaRiesgo === 'III'
    ? TASAS_TSS.srlCategoriaIII
    : categoriaRiesgo === 'II'
    ? TASAS_TSS.srlCategoriaII
    : TASAS_TSS.srlCategoriaI
  const srlEmpleador = baseCotizableSRL * tasaSRL

  // ─── Infotep — aporte obligatorio del empleador (1% del salario cotizable) ─
  const infotepEmpleador = baseCotizableAFP * TASAS_TSS.infotepEmpleador

  // ─── ISR Retención (DGII, Ley 11-92 art. 309) ─────────────────────────────
  // Base gravable = total bruto - AFP empleado - SFS empleado (deducibles).
  // El aporte VOLUNTARIO a AFP se excluye a propósito de esta base — a
  // diferencia del aporte obligatorio, no reduce el ISR (carta DGII 2022).
  const baseGravableMensual  = totalBruto - afpEmpleado - sfsEmpleado
  const baseGravableAnual    = baseGravableMensual * 12

  // ─── Retención consolidada de ISR (ingreso de otro empleador) ─────────────
  // Interpretación propia de Cielo Cloud (la norma no detalla el mecanismo
  // exacto de coordinación entre dos empleadores): se consolida la base
  // temporalmente solo para ubicar el tramo ISR correcto (el que aplicaría
  // si todo el ingreso viniera de un solo empleador), pero este empleador
  // SOLO retiene la porción proporcional a su propia base gravable — nunca
  // el ISR del ingreso ajeno, que le corresponde retener al otro empleador.
  // Con ingresoOtroEmpleadorMensual = 0/undefined, esto es idéntico al
  // cálculo anterior (proporción = 1).
  const ingresoOtroEmpleadorAnual   = (empleado.ingresoOtroEmpleadorMensual ?? 0) * 12
  const baseGravableConsolidadaAnual = baseGravableAnual + ingresoOtroEmpleadorAnual
  const isrConsolidadoAnual          = calcularISRAnual(baseGravableConsolidadaAnual)
  const isrMensual = baseGravableConsolidadaAnual > 0
    ? (isrConsolidadoAnual * (baseGravableAnual / baseGravableConsolidadaAnual)) / 12
    : 0

  // ─── Aporte voluntario a AFP (adicional al 2.87%/7.10% obligatorio) ───────
  const aporteVoluntarioAFPEmpleado = baseCotizableAFP * ((empleado.aporteVoluntarioAFPEmpleadoPct ?? 0) / 100)
  const aporteVoluntarioAFPEmpresa  = baseCotizableAFP * ((empleado.aporteVoluntarioAFPEmpresaPct ?? 0) / 100)

  // ─── Grossing-up: empresa asume % de AFP+SFS+ISR retenidos al empleado ────
  // La retención/remesa a TSS/DGII no cambia (afpEmpleado/sfsEmpleado/isrMensual
  // se calculan y reportan igual) — la empresa simplemente reembolsa ese monto
  // al empleado vía el neto, absorbiéndolo como costo adicional propio.
  const grossingUpEmpresa = (afpEmpleado + sfsEmpleado + isrMensual) * ((empleado.grossingUpPct ?? 0) / 100)

  // ─── Totales ───────────────────────────────────────────────────────────────
  const totalDescuentos       = afpEmpleado + sfsEmpleado + isrMensual + sfsDependientes + otrosDescuentos + aporteVoluntarioAFPEmpleado
  const salarioNeto           = totalBruto - totalDescuentos + grossingUpEmpresa
  const totalAportesEmpleador = afpEmpleador + sfsEmpleador + srlEmpleador + infotepEmpleador + aporteVoluntarioAFPEmpresa + grossingUpEmpresa
  const totalCostoEmpleador   = totalBruto + totalAportesEmpleador

  // ─── Provisiones ──────────────────────────────────────────────────────────
  // Regalía Pascual: 1/12 del salario anual (Art. 219 Código de Trabajo)
  const regaliaPascual = empleado.salarioBase / 12

  // Vacaciones acumuladas por mes
  const hoy = new Date()
  const fechaIngreso = new Date(empleado.fechaIngreso)
  const anosServicio = (hoy.getTime() - fechaIngreso.getTime()) / (365.25 * 24 * 3600 * 1000)
  const diasVacacionesAnuales = anosServicio >= 5
    ? DIAS_VACACIONES_MAS_5_ANOS
    : DIAS_VACACIONES_HASTA_5_ANOS
  const vacacionesMensualesDias  = diasVacacionesAnuales / 12
  // Valor diario: 23.83 en régimen ordinario, 26 en régimen intermitente (Res. 04-93)
  const valorDiario              = empleado.salarioBase / getDivisorSalarioDiario(empleado)
  const vacacionesMensualesValor = vacacionesMensualesDias * valorDiario

  return {
    empleadoId: empleado.id,
    salarioBruto,
    importeHE35,
    importeHE100,
    totalHorasExtras,
    importeNocturno,
    bonificaciones,
    comisiones,
    totalBruto,
    salarioCotizable,
    afpEmpleado,
    sfsEmpleado,
    isrMensual,
    sfsDependientes,
    otrosDescuentos,
    aporteVoluntarioAFPEmpleado,
    totalDescuentos,
    grossingUpEmpresa,
    saldoISRAplicado: 0,  // se aplica después, vía aplicarSaldoISRFavor() — no depende del empleado/empresa
    salarioNeto,
    afpEmpleador,
    sfsEmpleador,
    srlEmpleador,
    infotepEmpleador,
    aporteVoluntarioAFPEmpresa,
    totalAportesEmpleador,
    totalCostoEmpleador,
    regaliaPascual,
    vacacionesMensualesDias,
    vacacionesMensualesValor,
    anosServicio,
  }
}

// ─── Cálculo quincenal ────────────────────────────────────────────────────────
// 1ra quincena: anticipo (bruto/2, TSS/2, sin ISR — práctica estándar pymes DR)
// 2da quincena: bruto/2, TSS/2, ISR mensual completo (liquidación)
export function calcularNominaQuincenal(
  empleado: Empleado,
  quincena: 1 | 2,
  params: ParametrosNomina = {}
): ResultadoNomina {
  const m = calcularNomina(empleado, params)
  const bruto    = m.totalBruto / 2
  const afpEmp   = m.afpEmpleado / 2
  const sfsEmp   = m.sfsEmpleado / 2
  const isr      = quincena === 2 ? m.isrMensual : 0
  const sfsDep   = m.sfsDependientes   // already the per-quincena amount (pre-split at period creation)
  const otros    = m.otrosDescuentos / 2
  const aporteVolEmp = m.aporteVoluntarioAFPEmpleado / 2
  const totalDesc = afpEmp + sfsEmp + isr + sfsDep + otros + aporteVolEmp
  // Recalculado por quincena (no simplemente m.grossingUpEmpresa/2): el ISR
  // solo se retiene en la 2da quincena, así que el reembolso de grossing-up
  // sobre ISR también debe aplicarse ahí, no repartido 50/50 como AFP/SFS.
  const grossingUp = (afpEmp + sfsEmp + isr) * ((empleado.grossingUpPct ?? 0) / 100)

  return {
    ...m,
    salarioBruto:             m.salarioBruto / 2,
    importeHE35:              m.importeHE35 / 2,
    importeHE100:             m.importeHE100 / 2,
    totalHorasExtras:         m.totalHorasExtras / 2,
    importeNocturno:          m.importeNocturno / 2,
    bonificaciones:           m.bonificaciones / 2,
    comisiones:               m.comisiones / 2,
    totalBruto:               bruto,
    salarioCotizable:         m.salarioCotizable / 2,
    afpEmpleado:              afpEmp,
    sfsEmpleado:              sfsEmp,
    isrMensual:               isr,
    sfsDependientes:          sfsDep,
    otrosDescuentos:          otros,
    aporteVoluntarioAFPEmpleado: aporteVolEmp,
    totalDescuentos:          totalDesc,
    grossingUpEmpresa:        grossingUp,
    salarioNeto:              bruto - totalDesc + grossingUp,
    afpEmpleador:             m.afpEmpleador / 2,
    sfsEmpleador:             m.sfsEmpleador / 2,
    srlEmpleador:             m.srlEmpleador / 2,
    infotepEmpleador:         m.infotepEmpleador / 2,
    aporteVoluntarioAFPEmpresa: m.aporteVoluntarioAFPEmpresa / 2,
    totalAportesEmpleador:    m.afpEmpleador / 2 + m.sfsEmpleador / 2 + m.srlEmpleador / 2 + m.infotepEmpleador / 2 + m.aporteVoluntarioAFPEmpresa / 2 + grossingUp,
    totalCostoEmpleador:      bruto + (m.afpEmpleador / 2 + m.sfsEmpleador / 2 + m.srlEmpleador / 2 + m.infotepEmpleador / 2 + m.aporteVoluntarioAFPEmpresa / 2 + grossingUp),
    regaliaPascual:           m.regaliaPascual / 2,
    vacacionesMensualesDias:  m.vacacionesMensualesDias / 2,
    vacacionesMensualesValor: m.vacacionesMensualesValor / 2,
  }
}

// ─── Saldo a favor del empleado (ISR retenido de más) ─────────────────────────
// Aplica el crédito disponible contra el ISR YA calculado del período (nunca
// contra AFP/SFS, que son aportes obligatorios independientes de esto).
// Función pura: no decide cuánto crédito hay disponible ni persiste consumo —
// eso lo maneja saldo-isr-context.tsx. Aquí solo se resta lo que corresponda
// del isrMensual, ajustando totalDescuentos/salarioNeto en consecuencia.
export function aplicarSaldoISRFavor(
  resultado: ResultadoNomina,
  saldoDisponible: number,
): { resultado: ResultadoNomina; montoAplicado: number } {
  const montoAplicado = Math.min(resultado.isrMensual, Math.max(0, saldoDisponible))
  if (montoAplicado <= 0) return { resultado, montoAplicado: 0 }
  return {
    resultado: {
      ...resultado,
      isrMensual:       resultado.isrMensual - montoAplicado,
      totalDescuentos:  resultado.totalDescuentos - montoAplicado,
      saldoISRAplicado: montoAplicado,
      salarioNeto:      resultado.salarioNeto + montoAplicado,
    },
    montoAplicado,
  }
}

// ─── Cesantía (Art. 80, Código de Trabajo Ley 16-92) ─────────────────────────
// Salario diario = salario mensual ÷ divisor laboral (23.83 ordinario, 26
// régimen intermitente) — NO ÷30 días calendario. Usa getDivisorSalarioDiario().
export function calcularCesantia(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  const salarioDiario = salarioMensual / divisor
  if (anosServicio < 0.25) return 0
  if (anosServicio < 0.5)  return salarioDiario * 6                          // 3–6 meses: 6 días
  if (anosServicio < 1)    return salarioDiario * 13                         // 6–12 meses: 13 días
  if (anosServicio < 5)    return salarioDiario * 21 * Math.floor(anosServicio) // 1–5 años: 21 días/año
  return salarioDiario * 23 * Math.floor(anosServicio)                      // 5+ años: 23 días/año
}

// ─── Preaviso (Art. 76, Código de Trabajo) ───────────────────────────────────
export function calcularPreaviso(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  const salarioDiario = salarioMensual / divisor
  if (anosServicio < 0.25) return 0
  if (anosServicio < 0.5)  return salarioDiario * 7   // 3–6 meses: 7 días
  if (anosServicio < 1)    return salarioDiario * 14  // 6–12 meses: 14 días
  return salarioDiario * 28                           // 12+ meses: 28 días fijo
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getAnosServicio(fechaIngreso: string): number {
  const hoy = new Date()
  const fi  = new Date(fechaIngreso)
  return (hoy.getTime() - fi.getTime()) / (365.25 * 24 * 3600 * 1000)
}

export function getMesesServicio(fechaIngreso: string): number {
  return Math.floor(getAnosServicio(fechaIngreso) * 12)
}

// ─── Asistencia Económica (Art. 82, Código de Trabajo) ───────────────────────
// Distinta de la cesantía: aplica en terminación de contratos por tiempo
// determinado/obra, o en casos de terminación sin responsabilidad de las partes.
// Salario diario = salario mensual ÷ divisor laboral (23.83/26), no ÷30.
export function calcularAsistenciaEconomica(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  const salarioDiario = salarioMensual / divisor
  if (anosServicio < 0.25) return 0                              // < 3 meses: no aplica
  if (anosServicio < 0.5)  return salarioDiario * 5              // 3–6 meses: 5 días
  if (anosServicio < 1)    return salarioDiario * 10             // 6–12 meses: 10 días

  // 12+ meses: 15 días por cada año cumplido, más los días proporcionales
  // de los meses del año en curso al momento de otorgarla (acumulativo).
  const aniosCompletos      = Math.floor(anosServicio)
  const mesesAnioEnCurso    = Math.floor((anosServicio - aniosCompletos) * 12)
  const diasPorAniosCompletos = aniosCompletos * 15
  const diasProporcionales    = (15 / 12) * mesesAnioEnCurso
  return salarioDiario * (diasPorAniosCompletos + diasProporcionales)
}

// ─── Helpers de agregación de períodos (compartidos entre Reportería y Liquidación) ─
export function ajustesToParams(ajustes: AjusteLinea[]): ParametrosNomina {
  let horasExtras35 = 0, horasExtras100 = 0, horasNocturnas = 0, bonificaciones = 0
  let comisiones = 0, sfsDependientes = 0, otrosDescuentos = 0

  for (const a of ajustes) {
    if (a.concepto === 'horas_extras_35')                             horasExtras35   += a.valor
    if (a.concepto === 'horas_extras_100')                            horasExtras100  += a.valor
    if (a.concepto === 'recargo_nocturno')                            horasNocturnas  += a.valor
    if (a.concepto === 'bono' || a.concepto === 'otro_ingreso')       bonificaciones  += a.valor
    if (a.concepto === 'comision')                                    comisiones      += a.valor
    if (a.concepto === 'dependiente_sfs')                             sfsDependientes += a.valor
    if (a.concepto === 'prestamo' || a.concepto === 'otro_descuento') otrosDescuentos += a.valor
  }

  return { horasExtras35, horasExtras100, horasNocturnas, bonificaciones, comisiones, sfsDependientes, otrosDescuentos }
}

export function calcularConPeriodo(emp: Empleado, ajustes: AjusteLinea[], periodo: PeriodoNomina): ResultadoNomina {
  const params = ajustesToParams(ajustes)
  return periodo.tipo === 'quincenal'
    ? calcularNominaQuincenal(emp, periodo.quincena ?? 1, params)
    : calcularNomina(emp, params)
}

// ─── Salario ordinario real de los últimos 12 meses (Cesantía/Preaviso/Asistencia
// Económica) ───────────────────────────────────────────────────────────────────
// El "salario ordinario" para efectos de prestaciones laborales (Art. 76/80/82 CT)
// debe reflejar los ingresos habituales reales del trabajador — incluyendo
// comisiones y horas extra regulares — no solo el salario base contractual, para
// no subestimar el pago a empleados con ingresos variables significativos.
// Nunca retorna menos que el salario base actual (protege al trabajador ante
// meses atípicamente bajos, ej. licencias sin sueldo).
export function calcularSalarioPromedioUltimos12Meses(
  empleado: Empleado,
  periodos: PeriodoNomina[],
  fechaReferencia: Date = new Date(),
): number {
  const haceUnAnio = new Date(fechaReferencia)
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1)

  const relevantes = periodos.filter(p =>
    (p.estado === 'procesada' || p.estado === 'cerrada') &&
    new Date(p.fechaGeneracion) >= haceUnAnio &&
    new Date(p.fechaGeneracion) <= fechaReferencia
  )

  const totalPorMes = new Map<string, number>()
  for (const p of relevantes) {
    // Si el período trackea quién fue procesado, respeta esa membresía;
    // si no, asume que todo período procesada/cerrada incluyó al empleado.
    if (p.empleadosProcesados && !p.empleadosProcesados.includes(empleado.id)) continue
    const ajustes = p.ajustesPorEmpleado?.[empleado.id] ?? []
    const resultado = calcularConPeriodo(empleado, ajustes, p)
    const key = `${p.anio}-${p.mes}`
    totalPorMes.set(key, (totalPorMes.get(key) ?? 0) + resultado.totalBruto)
  }

  // Sin historial real en el sistema (recién migrado): usa el salario
  // histórico de referencia capturado en la carga inicial, si existe.
  if (totalPorMes.size === 0) {
    return Math.max(empleado.salarioHistoricoReferencia ?? empleado.salarioBase, empleado.salarioBase)
  }

  const sumaTotal = [...totalPorMes.values()].reduce((s, v) => s + v, 0)
  const promedio   = sumaTotal / totalPorMes.size
  return Math.max(promedio, empleado.salarioBase)
}
