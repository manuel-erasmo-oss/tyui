import type { AjusteLinea, CategoriaEmpresa, CategoriaRiesgoSRL, CierreFiscal, ConceptoAjuste, Empleado, Empresa, MotivoLiquidacion, ParametrosNomina, PeriodoNomina, ResultadoNomina, SectorEmpresa, TipoPeriodo } from '@/types'

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

// ─── Prorrateo de descuentos/aportes fijos entre períodos ─────────────────────
// Helper genérico para cualquier monto fijo mensual (cuota Dep. SFS y futuros
// descuentos/aportes recurrentes) que deba dividirse a la mitad en nómina
// quincenal, redondeado a centavos. Reemplaza la lógica que antes vivía
// inline solo para Dep. SFS en nomina/page.tsx.
export function prorratearMontoFijo(montoMensual: number, tipo: TipoPeriodo): number {
  if (tipo !== 'quincenal') return montoMensual
  return Math.round((montoMensual / 2) * 100) / 100
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

// ─── Vacaciones acumuladas — compuestas a través de múltiples años ───────────
// Un cálculo ingenuo por "ciclo actual" (ej. `(años % 1) × 14/12`) descarta
// por completo cualquier año COMPLETO ya transcurrido que el empleado nunca
// disfrutó — un empleado con 1 año y 5 meses sin tomar vacaciones acumularía
// solo ~5.8 días en vez de los ~19.8 reales (14 del primer año + la fracción
// del segundo). En la práctica real dominicana un empleado puede acumular 2,
// 3 o más períodos pendientes si la empresa nunca lo obliga a disfrutarlos —
// este helper compone correctamente cada año completo (a la tasa vigente EN
// ESE año — 14 días los primeros 5 años, 18 después) más la fracción del año
// en curso, sin resetear nunca. `diasTomados` (vacaciones-context.tsx) resta
// aparte lo realmente disfrutado/vendido — la combinación de ambos refleja
// el saldo real pendiente, sin importar cuántos años lleve acumulándose.
export function calcularDiasVacacionesAcumulados(anosServicio: number, saldoVacacionesInicial: number = 0): number {
  if (anosServicio <= 0) return Math.max(0, saldoVacacionesInicial)
  const aniosCompletos  = Math.floor(anosServicio)
  const fraccionActual  = anosServicio - aniosCompletos
  let dias = 0
  for (let i = 1; i <= aniosCompletos; i++) {
    dias += i >= 5 ? DIAS_VACACIONES_MAS_5_ANOS : DIAS_VACACIONES_HASTA_5_ANOS
  }
  const tasaActual = (aniosCompletos + 1) >= 5 ? DIAS_VACACIONES_MAS_5_ANOS : DIAS_VACACIONES_HASTA_5_ANOS
  dias += tasaActual * fraccionActual
  return Math.max(0, dias + saldoVacacionesInicial)
}

// ─── Días laborables entre dos fechas (excluye domingos) ─────────────────────
// Usado por el Disfrute de Vacaciones: tanto para restar del acumulado
// disponible como para valorar el goce pagado en Nómina — consistente con
// que el acumulado anual (14/18 días) ya es en "días laborables" (Art. 177).
export function contarDiasLaborables(inicio: Date, fin: Date): number {
  let dias = 0
  const cur = new Date(inicio)
  while (cur <= fin) {
    if (cur.getDay() !== 0) dias++  // 0 = domingo
    cur.setDate(cur.getDate() + 1)
  }
  return dias
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
    ingresosPersonalizadosTotal        = 0,
    ingresosPersonalizadosGravablesISR = 0,
    ingresosPersonalizadosCotizablesTSS = 0,
    vacacionesGoce      = 0,
    vacacionesVendidas  = 0,
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

  // Base "legado" — todo lo que ya era gravable ISR y cotizable TSS por igual
  // antes del catálogo configurable (sin cambios para nóminas que no lo usan).
  // vacacionesGoce (Disfrute) y vacacionesVendidas (Venta) se tratan igual
  // que bonificaciones/comisiones — salario ordinario, cotizable TSS y
  // gravable ISR (Art. 178). vacacionesVendidas es un pago EXTRA sobre el
  // salario normal completo (el empleado sigue trabajando), a diferencia de
  // vacacionesGoce que sustituye el salario de días no trabajados.
  const totalBrutoLegado = salarioBruto + totalHorasExtras + importeNocturno + bonificaciones + comisiones + vacacionesGoce + vacacionesVendidas
  const ingresosPersonalizados = ingresosPersonalizadosTotal
  const totalBruto = totalBrutoLegado + ingresosPersonalizados

  // ─── TSS (cada aporte capea sobre su propia base — topes distintos) ───────
  // La base cotizable suma el legado (siempre cotizable) + solo la porción de
  // ingresos personalizados cuyo concepto tiene "afecta TSS" activo — un
  // ingreso personalizado exento de TSS NO debe inflar esta base solo por
  // formar parte de totalBruto.
  const baseTSSPreTope = totalBrutoLegado + ingresosPersonalizadosCotizablesTSS
  const baseCotizableAFP = Math.min(baseTSSPreTope, TOPE_COTIZABLE_AFP)
  const baseCotizableSFS = Math.min(baseTSSPreTope, TOPE_COTIZABLE_SFS)
  const baseCotizableSRL = Math.min(baseTSSPreTope, TOPE_COTIZABLE_SRL)

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
  // Base gravable = legado (siempre gravable) + solo la porción de ingresos
  // personalizados marcada "afecta ISR" - AFP empleado - SFS empleado
  // (deducibles). El aporte VOLUNTARIO a AFP se excluye a propósito de esta
  // base — a diferencia del aporte obligatorio, no reduce el ISR (carta DGII
  // 2022). Un ingreso personalizado exento de ISR nunca entra aquí, aunque sí
  // forme parte de totalBruto.
  const baseGravableMensual  = totalBrutoLegado + ingresosPersonalizadosGravablesISR - afpEmpleado - sfsEmpleado
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
    ingresosPersonalizados,
    totalBruto,
    salarioCotizable,
    afpEmpleado,
    sfsEmpleado,
    isrMensual,
    sfsDependientes,
    otrosDescuentos,
    aporteVoluntarioAFPEmpleado,
    vacacionesGoce,
    vacacionesVendidas,
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
    ingresosPersonalizados:   m.ingresosPersonalizados / 2,
    totalBruto:               bruto,
    salarioCotizable:         m.salarioCotizable / 2,
    afpEmpleado:              afpEmp,
    sfsEmpleado:              sfsEmp,
    isrMensual:               isr,
    sfsDependientes:          sfsDep,
    otrosDescuentos:          otros,
    aporteVoluntarioAFPEmpleado: aporteVolEmp,
    // El llamador (diasVacacionEnPeriodo en nomina/page.tsx) ya pre-dobla el
    // monto antes de pasarlo como vacacionesGoce cuando el período es
    // quincenal — exactamente para que este /2 lo devuelva al monto real
    // correspondiente a esa quincena específica (mismo mecanismo que ya
    // aplica automáticamente a bonificaciones/comisiones).
    vacacionesGoce:           m.vacacionesGoce / 2,
    vacacionesVendidas:       m.vacacionesVendidas / 2,
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
// `grossingUpPct` (Empleado.grossingUpPct) es opcional porque no todo
// llamador tiene el empleado a mano — con 0/undefined el comportamiento es
// idéntico al de antes de este parámetro.
export function aplicarSaldoISRFavor(
  resultado: ResultadoNomina,
  saldoDisponible: number,
  grossingUpPct: number = 0,
): { resultado: ResultadoNomina; montoAplicado: number } {
  const montoAplicado = Math.min(resultado.isrMensual, Math.max(0, saldoDisponible))
  if (montoAplicado <= 0) return { resultado, montoAplicado: 0 }

  // El crédito reduce el ISR realmente retenido al empleado — si la empresa
  // además asume (grossing-up) un % de ese ISR, el reembolso debe bajar en
  // la misma proporción: de lo contrario la empresa reembolsaría ISR que
  // nunca llegó a retenerle al empleado (el crédito ya lo cubrió).
  const reduccionGrossingUp = montoAplicado * (grossingUpPct / 100)

  return {
    resultado: {
      ...resultado,
      isrMensual:            resultado.isrMensual - montoAplicado,
      totalDescuentos:       resultado.totalDescuentos - montoAplicado,
      saldoISRAplicado:      montoAplicado,
      grossingUpEmpresa:     resultado.grossingUpEmpresa - reduccionGrossingUp,
      totalAportesEmpleador: resultado.totalAportesEmpleador - reduccionGrossingUp,
      totalCostoEmpleador:   resultado.totalCostoEmpleador - reduccionGrossingUp,
      salarioNeto:           resultado.salarioNeto + montoAplicado - reduccionGrossingUp,
    },
    montoAplicado,
  }
}

// ─── Desglose del cálculo de una prestación (días × tarifa = total) ─────────
// Expone el detalle intermedio del cálculo (no solo el monto final) para que
// la UI de Liquidación pueda mostrarle al usuario de dónde salió cada cifra
// — el mismo principio que ya se documenta en cada tramo legal de abajo,
// ahora como datos estructurados en vez de solo comentarios.
export interface DetalleTramoPrestacion {
  dias: number
  tarifaDiaria: number
  total: number
  tramo: string   // descripción legible del tramo aplicado, ej. "5+ años — 23 días × 5 año(s) completo(s)"
}

// ─── Cesantía (Art. 80, Código de Trabajo Ley 16-92) ─────────────────────────
// Salario diario = salario mensual ÷ divisor laboral (23.83 ordinario, 26
// régimen intermitente) — NO ÷30 días calendario. Usa getDivisorSalarioDiario().
export function calcularCesantiaDetalle(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): DetalleTramoPrestacion {
  const tarifaDiaria = salarioMensual / divisor
  if (anosServicio < 0.25) return { dias: 0, tarifaDiaria, total: 0, tramo: 'Menos de 3 meses de servicio — no genera cesantía' }
  if (anosServicio < 0.5)  return { dias: 6, tarifaDiaria, total: tarifaDiaria * 6, tramo: '3–6 meses de servicio — 6 días' }
  if (anosServicio < 1)    return { dias: 13, tarifaDiaria, total: tarifaDiaria * 13, tramo: '6–12 meses de servicio — 13 días' }
  if (anosServicio < 5) {
    const anios = Math.floor(anosServicio)
    return { dias: 21 * anios, tarifaDiaria, total: tarifaDiaria * 21 * anios, tramo: `1–5 años — 21 días × ${anios} año(s) completo(s)` }
  }
  const anios = Math.floor(anosServicio)
  return { dias: 23 * anios, tarifaDiaria, total: tarifaDiaria * 23 * anios, tramo: `5+ años — 23 días × ${anios} año(s) completo(s)` }
}

export function calcularCesantia(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  return calcularCesantiaDetalle(salarioMensual, anosServicio, divisor).total
}

// ─── Preaviso (Art. 76, Código de Trabajo) ───────────────────────────────────
export function calcularPreavisoDetalle(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): DetalleTramoPrestacion {
  const tarifaDiaria = salarioMensual / divisor
  if (anosServicio < 0.25) return { dias: 0, tarifaDiaria, total: 0, tramo: 'Menos de 3 meses de servicio — no genera preaviso' }
  if (anosServicio < 0.5)  return { dias: 7, tarifaDiaria, total: tarifaDiaria * 7, tramo: '3–6 meses de servicio — 7 días' }
  if (anosServicio < 1)    return { dias: 14, tarifaDiaria, total: tarifaDiaria * 14, tramo: '6–12 meses de servicio — 14 días' }
  return { dias: 28, tarifaDiaria, total: tarifaDiaria * 28, tramo: '12+ meses de servicio — 28 días fijo' }
}

export function calcularPreaviso(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  return calcularPreavisoDetalle(salarioMensual, anosServicio, divisor).total
}

// Mismos tramos de calcularPreaviso, pero como días exigidos (no monto en
// RD$) — el Art. 76 exige la misma anticipación mínima en ambos sentidos
// (empleador → despido, empleado → renuncia). Usado por el reporte de
// cumplimiento de preaviso en renuncias.
export function getDiasPreavisoRequeridos(anosServicio: number): number {
  if (anosServicio < 0.25) return 0
  if (anosServicio < 0.5)  return 7   // 3–6 meses
  if (anosServicio < 1)    return 14  // 6–12 meses
  return 28                           // 12+ meses fijo
}

// Etiquetas de MotivoLiquidacion — usadas por Liquidación y por el
// mini-formulario de "salida pendiente" en Empleados, para no divergir.
export const MOTIVO_LIQUIDACION_LABELS: Record<MotivoLiquidacion, string> = {
  renuncia: 'Renuncia Voluntaria',
  despido_sin_causa: 'Despido Sin Causa (Art. 87)',
  despido_con_causa: 'Despido Con Causa (Art. 88)',
  mutuo_acuerdo: 'Mutuo Acuerdo',
  vencimiento_contrato: 'Vencimiento de Contrato (Art. 74/82)',
}

// ─── Rango de fechas calendario de un período de nómina ────────────────────
// El mes completo para mensual, o la mitad correspondiente (1-15 / 16-fin)
// para quincenal. Usado por Liquidación para ubicar el fin del último
// período pagado de un empleado (ver calcularDiasTrabajadosPendientes).
export function rangoPeriodo(
  mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2 = 1,
): { inicio: Date; fin: Date } {
  const diasEnMes = new Date(anio, mes, 0).getDate()
  if (tipo === 'mensual') return { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, diasEnMes) }
  return quincena === 1
    ? { inicio: new Date(anio, mes - 1, 1), fin: new Date(anio, mes - 1, 15) }
    : { inicio: new Date(anio, mes - 1, 16), fin: new Date(anio, mes - 1, diasEnMes) }
}

// ─── Días trabajados pendientes de pago al momento de la liquidación ───────
// Cuando Empleado.pagoDiasTrabajadosPendiente === 'liquidacion': cuenta los
// días calendario entre el fin del último período de Nómina en que el
// empleado fue efectivamente procesado (empleadosProcesados) y su fecha de
// terminación — o desde fechaIngreso si nunca se le procesó ninguno. `null`
// si no hay días pendientes (ej. la fecha de terminación cae dentro o antes
// de un período ya procesado — no le queda nada suelto por pagar).
//
// diasLaborablesMes usa los días del mes calendario de la fecha de
// terminación como denominador del prorrateo — correcto para el caso normal
// (el hueco cabe dentro de un solo mes). Si el hueco excepcionalmente
// abarcara más de un mes (nómina sin correr por varios ciclos), se topa al
// propio diasTrabajados para nunca prorratear por encima de un mes completo
// de salario.
export function calcularDiasTrabajadosPendientes(
  empleado: Empleado,
  periodos: PeriodoNomina[],
  fechaTerminacion: Date,
): { diasTrabajados: number; diasLaborablesMes: number; fechaInicio: Date } | null {
  const msPorDia = 24 * 3600 * 1000

  // Igual criterio que calcularSalarioPromedioUltimos12Meses: si el período
  // trackea quién fue procesado, respeta esa membresía; si no la trackea
  // (períodos antiguos, o datos de demo), asume que todo período
  // procesada/cerrada incluyó al empleado — de lo contrario nunca se
  // encontraría el último período pagado y se caería al fallback de
  // fechaIngreso, inflando artificialmente los días pendientes.
  const procesados = periodos
    .filter(p =>
      (p.estado === 'procesada' || p.estado === 'cerrada') &&
      (p.empleadosProcesados ? p.empleadosProcesados.includes(empleado.id) : true)
    )
    .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes) || ((b.quincena ?? 1) - (a.quincena ?? 1)))

  const ultimoFin = procesados.length
    ? rangoPeriodo(procesados[0].mes, procesados[0].anio, procesados[0].tipo, procesados[0].quincena ?? 1).fin
    : new Date(new Date(empleado.fechaIngreso).getTime() - msPorDia)

  const fechaInicio = new Date(ultimoFin.getTime() + msPorDia)
  if (fechaInicio > fechaTerminacion) return null

  const diasTrabajados = Math.floor((fechaTerminacion.getTime() - fechaInicio.getTime()) / msPorDia) + 1
  const diasEnMesTerm = new Date(fechaTerminacion.getFullYear(), fechaTerminacion.getMonth() + 1, 0).getDate()
  const diasLaborablesMes = Math.max(diasEnMesTerm, diasTrabajados)

  return { diasTrabajados, diasLaborablesMes, fechaInicio }
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

// Monto de Empleado.regaliaPagadaEsteAnio realmente vigente para `anio` — ver
// el comentario del campo en types/index.ts. Sin regaliaPagadaAnio (registros
// previos a este campo), se asume vigente solo para el año calendario actual,
// para no alterar el comportamiento ya existente de golpe ni requerir migrar
// datos, dejando que el descuento deje de aplicar por sí solo al año siguiente.
export function regaliaPagadaVigente(empleado: Pick<Empleado, 'regaliaPagadaEsteAnio' | 'regaliaPagadaAnio'>, anio: number): number {
  if (!empleado.regaliaPagadaEsteAnio) return 0
  const anioVigente = empleado.regaliaPagadaAnio ?? new Date().getFullYear()
  return anioVigente === anio ? empleado.regaliaPagadaEsteAnio : 0
}

// ─── Asistencia Económica (Art. 82, Código de Trabajo) ───────────────────────
// Distinta de la cesantía: aplica en terminación de contratos por tiempo
// determinado/obra, o en casos de terminación sin responsabilidad de las partes.
// Salario diario = salario mensual ÷ divisor laboral (23.83/26), no ÷30.
export function calcularAsistenciaEconomicaDetalle(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): DetalleTramoPrestacion {
  const tarifaDiaria = salarioMensual / divisor
  if (anosServicio < 0.25) return { dias: 0, tarifaDiaria, total: 0, tramo: 'Menos de 3 meses de servicio — no aplica' }
  if (anosServicio < 0.5)  return { dias: 5, tarifaDiaria, total: tarifaDiaria * 5, tramo: '3–6 meses de servicio — 5 días' }
  if (anosServicio < 1)    return { dias: 10, tarifaDiaria, total: tarifaDiaria * 10, tramo: '6–12 meses de servicio — 10 días' }

  // 12+ meses: 15 días por cada año cumplido, más los días proporcionales
  // de los meses del año en curso al momento de otorgarla (acumulativo).
  const aniosCompletos      = Math.floor(anosServicio)
  const mesesAnioEnCurso    = Math.floor((anosServicio - aniosCompletos) * 12)
  const diasPorAniosCompletos = aniosCompletos * 15
  const diasProporcionales    = (15 / 12) * mesesAnioEnCurso
  const dias = diasPorAniosCompletos + diasProporcionales
  return {
    dias, tarifaDiaria, total: tarifaDiaria * dias,
    tramo: `12+ meses — 15 días × ${aniosCompletos} año(s) completo(s) + proporcional de ${mesesAnioEnCurso} mes(es) del año en curso`,
  }
}

export function calcularAsistenciaEconomica(salarioMensual: number, anosServicio: number, divisor: number = DIVISOR_DIA_ORDINARIO): number {
  return calcularAsistenciaEconomicaDetalle(salarioMensual, anosServicio, divisor).total
}

// ─── Helpers de agregación de períodos (compartidos entre Reportería y Liquidación) ─
export function ajustesToParams(ajustes: AjusteLinea[]): ParametrosNomina {
  let horasExtras35 = 0, horasExtras100 = 0, horasNocturnas = 0, bonificaciones = 0
  let comisiones = 0, sfsDependientes = 0, otrosDescuentos = 0
  let ingresosPersonalizadosTotal = 0, ingresosPersonalizadosGravablesISR = 0, ingresosPersonalizadosCotizablesTSS = 0

  for (const a of ajustes) {
    if (a.concepto === 'horas_extras_35')                             horasExtras35   += a.valor
    if (a.concepto === 'horas_extras_100')                            horasExtras100  += a.valor
    if (a.concepto === 'recargo_nocturno')                            horasNocturnas  += a.valor
    if (a.concepto === 'bono' || a.concepto === 'otro_ingreso')       bonificaciones  += a.valor
    if (a.concepto === 'comision')                                    comisiones      += a.valor
    if (a.concepto === 'dependiente_sfs')                             sfsDependientes += a.valor
    if (a.concepto === 'prestamo' || a.concepto === 'otro_descuento') otrosDescuentos += a.valor
    // Concepto del catálogo configurable (Configuración → Ingresos y
    // Deducciones). Los ingresos personalizados siempre suman a totalBruto;
    // solo la porción con el flag correspondiente activo entra a la base de
    // ISR y/o TSS (ver calcularNomina). Las deducciones personalizadas SIEMPRE
    // se tratan como "Otro Descuento" — nunca reducen ISR ni TSS.
    if (a.concepto === 'personalizado' && a.tipo === 'ingreso') {
      ingresosPersonalizadosTotal += a.valor
      if (a.afectaISR) ingresosPersonalizadosGravablesISR += a.valor
      if (a.afectaTSS) ingresosPersonalizadosCotizablesTSS += a.valor
    }
    if (a.concepto === 'personalizado' && a.tipo === 'deduccion') otrosDescuentos += a.valor
  }

  return {
    horasExtras35, horasExtras100, horasNocturnas, bonificaciones, comisiones, sfsDependientes, otrosDescuentos,
    ingresosPersonalizadosTotal, ingresosPersonalizadosGravablesISR, ingresosPersonalizadosCotizablesTSS,
  }
}

// ─── Catálogo de referencia — conceptos de ley (no editables) ────────────────
// Muestra el tratamiento REAL de ISR/TSS de cada ConceptoAjuste fijo, tal
// como ya lo implementa calcularNomina/ajustesToParams — es documentación
// generada a partir del motor, no una fuente independiente que pueda
// desincronizarse. Se usa en Configuración → Ingresos y Deducciones.
export interface ConceptoLeyInfo {
  concepto: ConceptoAjuste
  nombre: string
  tipo: 'ingreso' | 'deduccion'
  afectaISR: boolean
  afectaTSS: boolean
  nota: string
}

export const CONCEPTOS_LEY: ConceptoLeyInfo[] = [
  { concepto: 'horas_extras_35',  nombre: 'H.E. 35%',            tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Art. 203 Código de Trabajo' },
  { concepto: 'horas_extras_100', nombre: 'H.E. 100%',           tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Art. 203 Código de Trabajo (feriados)' },
  { concepto: 'recargo_nocturno', nombre: 'Recargo Nocturno',    tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Práctica estándar TSS (15% sobre tarifa hora)' },
  { concepto: 'comision',         nombre: 'Comisión',            tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Salario ordinario' },
  { concepto: 'bono',             nombre: 'Bono',                tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Salario ordinario' },
  { concepto: 'otro_ingreso',     nombre: 'Otro Ingreso',        tipo: 'ingreso',   afectaISR: true,  afectaTSS: true,  nota: 'Salario ordinario' },
  { concepto: 'dependiente_sfs',  nombre: 'Dep. SFS Adicionales', tipo: 'deduccion', afectaISR: false, afectaTSS: false, nota: 'Resolución 624-02 CNSS — cuota fija, no modifica bases' },
  { concepto: 'prestamo',         nombre: 'Préstamo',            tipo: 'deduccion', afectaISR: false, afectaTSS: false, nota: 'Descuento post-impuesto, no reduce ISR ni TSS' },
  { concepto: 'otro_descuento',   nombre: 'Otro Descuento',      tipo: 'deduccion', afectaISR: false, afectaTSS: false, nota: 'Descuento post-impuesto, no reduce ISR ni TSS' },
]

// Resultado en cero — usado cuando un período de Regalía Pascual no tiene
// snapshot para un empleado (nunca formó parte del pago, ej. acumulado en
// 0 al momento de liquidar). Evita que calcularConPeriodo caiga al motor
// normal de nómina, que fabricaría un salario mensual completo inexistente
// bajo la etiqueta de ese período.
function resultadoVacio(empleadoId: string): ResultadoNomina {
  return {
    empleadoId,
    salarioBruto: 0, importeHE35: 0, importeHE100: 0, totalHorasExtras: 0, importeNocturno: 0,
    bonificaciones: 0, comisiones: 0, ingresosPersonalizados: 0, totalBruto: 0,
    salarioCotizable: 0,
    afpEmpleado: 0, sfsEmpleado: 0, isrMensual: 0, sfsDependientes: 0, otrosDescuentos: 0,
    aporteVoluntarioAFPEmpleado: 0, vacacionesGoce: 0, vacacionesVendidas: 0, totalDescuentos: 0,
    grossingUpEmpresa: 0, saldoISRAplicado: 0,
    salarioNeto: 0,
    afpEmpleador: 0, sfsEmpleador: 0, srlEmpleador: 0, infotepEmpleador: 0,
    aporteVoluntarioAFPEmpresa: 0, totalAportesEmpleador: 0,
    totalCostoEmpleador: 0,
    regaliaPascual: 0, vacacionesMensualesDias: 0, vacacionesMensualesValor: 0,
    anosServicio: 0,
  }
}

export function calcularConPeriodo(emp: Empleado, ajustes: AjusteLinea[], periodo: PeriodoNomina): ResultadoNomina {
  if (periodo.tipo === 'regalia' || periodo.tipo === 'bonificacion') return resultadoVacio(emp.id)
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
    // La Regalía Pascual (Art. 219, 100% exenta) y la Bonificación por
    // Utilidades (Art. 223, pago anual único y discrecional según haya o no
    // utilidades ese año) NUNCA son "salario ordinario" — incluirlas aquí
    // inflaría artificialmente el promedio usado para Cesantía/Preaviso/
    // Asistencia Económica, sumando un pago anual grande como si fuera
    // salario adicional de ese mes puntual.
    p.tipo !== 'regalia' && p.tipo !== 'bonificacion' &&
    (p.estado === 'procesada' || p.estado === 'cerrada') &&
    new Date(p.fechaGeneracion) >= haceUnAnio &&
    new Date(p.fechaGeneracion) <= fechaReferencia
  )

  const totalPorMes = new Map<string, number>()
  for (const p of relevantes) {
    // Si el período trackea quién fue procesado, respeta esa membresía;
    // si no, asume que todo período procesada/cerrada incluyó al empleado.
    if (p.empleadosProcesados && !p.empleadosProcesados.includes(empleado.id)) continue
    // Preferir el snapshot histórico congelado al momento de procesar (fuente
    // fidedigna de lo que realmente se pagó) — recalcular con el Empleado en
    // vivo usaría un salarioBase que pudo cambiar después (aumento, etc.),
    // distorsionando el promedio real de los últimos 12 meses. Solo se
    // recalcula en vivo para períodos anteriores a este campo (sin snapshot).
    const snapshot = p.resultadosPorEmpleado?.[empleado.id]
    const totalBruto = snapshot
      ? snapshot.totalBruto
      : calcularConPeriodo(empleado, p.ajustesPorEmpleado?.[empleado.id] ?? [], p).totalBruto
    const key = `${p.anio}-${p.mes}`
    totalPorMes.set(key, (totalPorMes.get(key) ?? 0) + totalBruto)
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

// ─── Bonificación por Utilidades — ejercicio fiscal (Art. 223-224, Código de
// Trabajo) ───────────────────────────────────────────────────────────────────
// El mes de cierre del ejercicio (Empresa.cierreFiscal) determina la ventana
// de 12 meses sobre la que se reparte el 10% de utilidades netas. "Año
// fiscal N" se nombra por su año de CIERRE — ej. con cierreFiscal='junio',
// el año fiscal 2026 es el ejercicio del 01-jul-2025 al 30-jun-2026. Con el
// valor por defecto 'diciembre', el año fiscal N es simplemente el año
// calendario N (comportamiento idéntico al que ya existía antes de este
// campo, sin necesidad de migrar datos).
const MES_CIERRE: Record<CierreFiscal, number> = {
  // 0-indexado (Date.getMonth()) — mes en que CIERRA el ejercicio
  diciembre: 11, marzo: 2, junio: 5, septiembre: 8,
}

export function rangoEjercicioFiscal(anioFiscal: number, cierreFiscal: CierreFiscal = 'diciembre'): { inicio: Date; fin: Date } {
  const mesCierre = MES_CIERRE[cierreFiscal]
  const fin = new Date(anioFiscal, mesCierre + 1, 0)  // último día del mes de cierre
  const inicio = new Date(fin)
  inicio.setFullYear(inicio.getFullYear() - 1)
  inicio.setDate(inicio.getDate() + 1)
  return { inicio, fin }
}

// Fecha límite legal de pago de la Bonificación — Art. 224: "a más tardar
// entre los noventa y los ciento veinte días después del cierre de cada
// ejercicio económico." Se usa el límite superior (120 días) como fecha de
// vencimiento para la alerta — el margen 90-120 es una ventana permitida,
// no dos fechas distintas a advertir por separado.
export function fechaLimitePagoBonificacion(finEjercicio: Date): Date {
  const limite = new Date(finEjercicio)
  limite.setDate(limite.getDate() + 120)
  return limite
}

// Meses (fraccionales, sin truncar) que un empleado trabajó DENTRO de un
// ejercicio fiscal específico — usado para prorratear tanto el peso en el
// reparto proporcional como el tope individual de 45/60 días cuando el
// empleado no trabajó el ejercicio completo. Cubre dos casos reales: (1)
// ingresó a mitad del ejercicio (fechaSalida = null, sigue activo), y (2) se
// desvinculó a mitad del ejercicio (fechaSalida = fecha de terminación) —
// Art. 223: "Cuando el trabajador no preste servicios durante todo el año...
// la participación individual será proporcional al salario del tiempo
// trabajado." La ley no especifica la fórmula exacta de proporción; aquí se
// usa días trabajados dentro del ejercicio ÷ días totales del ejercicio × 12
// (interpretación propia de Cielo Cloud, consistente con cómo ya se
// prorratea Regalía Pascual/vacaciones en el resto del sistema).
export function mesesEnEjercicioFiscal(
  fechaIngreso: Date, fechaSalida: Date | null, inicioEjercicio: Date, finEjercicio: Date,
): number {
  const inicioEfectivo = fechaIngreso > inicioEjercicio ? fechaIngreso : inicioEjercicio
  const finEfectivo = fechaSalida && fechaSalida < finEjercicio ? fechaSalida : finEjercicio
  if (inicioEfectivo > finEfectivo) return 0
  const msPorDia = 24 * 3600 * 1000
  const diasTrabajados = (finEfectivo.getTime() - inicioEfectivo.getTime()) / msPorDia + 1
  const diasEjercicio  = (finEjercicio.getTime() - inicioEjercicio.getTime()) / msPorDia + 1
  return Math.max(0, Math.min(12, (diasTrabajados / diasEjercicio) * 12))
}

export interface BonificacionPendiente {
  anio: number
  fin: Date
  limite: Date
  diasRestantes: number   // negativo = ya vencido
}

// Ejercicios fiscales ya cerrados (fin <= hoy) que todavía no tienen un
// período de Bonificación pagado ('cerrada') — ordenados por urgencia (menor
// diasRestantes primero). Extraído de /bonificacion para que el Dashboard
// (Centro de Alertas) pueda reutilizar exactamente la misma regla sin
// duplicar la lógica de ventana fiscal. Acotado a ejercicios que se solapan
// con la antigüedad del empleado más antiguo conocido — sin este límite, una
// empresa recién migrada a Cielo Cloud (sin historial de bonificación
// cargado) vería "vencido hace miles de días" para ejercicios anteriores a
// que la empresa tuviera empleados, un falso positivo sin sentido práctico.
export function getBonificacionesPendientes(
  empleados: Pick<Empleado, 'fechaIngreso'>[],
  periodos: Pick<PeriodoNomina, 'tipo' | 'anio' | 'estado'>[],
  cierreFiscal: CierreFiscal,
  aniosCandidatos: number[],
): BonificacionPendiente[] {
  const hoy = new Date()
  const primerIngresoConocido = empleados.length > 0
    ? new Date(Math.min(...empleados.map(e => new Date(e.fechaIngreso).getTime())))
    : null

  return aniosCandidatos
    .map(a => {
      const { fin } = rangoEjercicioFiscal(a, cierreFiscal)
      if (fin > hoy) return null
      if (primerIngresoConocido && fin < primerIngresoConocido) return null
      const pagado = periodos.some(p => p.tipo === 'bonificacion' && p.anio === a && p.estado === 'cerrada')
      if (pagado) return null
      const limite = fechaLimitePagoBonificacion(fin)
      const diasRestantes = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 3600 * 24))
      return { anio: a, fin, limite, diasRestantes }
    })
    .filter((x): x is BonificacionPendiente => x !== null)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
}
