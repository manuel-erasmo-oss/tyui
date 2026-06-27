import type { Empleado, ParametrosNomina, ResultadoNomina } from '@/types'

// ─── ISR Brackets 2024 (annual RD$) ──────────────────────────────────────────
// Source: DGII, Ley 11-92 art. 296 según modificaciones vigentes
const TRAMOS_ISR = [
  { hasta: 416_220.00, tasa: 0.00, fijo: 0 },
  { hasta: 624_329.00, tasa: 0.15, fijo: 0 },
  { hasta: 867_123.00, tasa: 0.20, fijo: 31_213.35 },
  { hasta: Infinity,   tasa: 0.25, fijo: 79_776.51 },
] as const

// ─── TSS Contribution Rates ───────────────────────────────────────────────────
// Source: CNSS, Ley 87-01 y reglamentos vigentes
export const TASAS_TSS = {
  afpEmpleado:   0.0287,
  afpEmpleador:  0.0710,
  sfsEmpleado:   0.0304,
  sfsEmpleador:  0.0709,
  srlBajo:       0.0110,  // oficinas, servicios, comercio
  srlMedio:      0.0220,  // industria media
  srlAlto:       0.0325,  // construcción, minería, alto riesgo
} as const

// ─── Salarios Mínimos (Comité Nacional de Salarios, 2024) ─────────────────────
export const SALARIO_MINIMO = {
  grandesEmpresas:  21_000,
  pequeñasEmpresas: 18_430,
  microempresas:    13_620,
  zonaFranca:       15_800,
} as const

// Tope salario cotizable TSS = 20 × salario mínimo grandes empresas
export const TOPE_COTIZABLE = SALARIO_MINIMO.grandesEmpresas * 20  // RD$ 420,000

// Resolución 624-02 CNSS: tasa SFS por dependiente adicional
export const SFS_DEP_RATE = 0.029

export function cuotaDependienteSFS(salarioBase: number): number {
  return Math.min(salarioBase, TOPE_COTIZABLE) * SFS_DEP_RATE
}

// ─── Parámetros laborales (Código de Trabajo Ley 16-92) ──────────────────────
export const HORAS_SEMANA = 44                     // Art. 147: semana de 44h
export const DIAS_VACACIONES_HASTA_5_ANOS = 14     // Art. 177: 14 días laborables
export const DIAS_VACACIONES_MAS_5_ANOS = 18       // Art. 177: 18 días laborables

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
    bonificaciones    = 0,
    comisiones        = 0,
    otrosDescuentos   = 0,
    categoriaRiesgo   = empleado.categoriaRiesgo ?? 'bajo',
  } = params

  // Salario proporcional a días trabajados
  const salarioBruto = empleado.salarioBase * (diasTrabajados / diasLaborablesMes)

  // Horas extras (Art. 203 Código de Trabajo)
  // Tarifa hora = salario mensual / (horas semana × 52 / 12)
  const salarioHora = empleado.salarioBase / (HORAS_SEMANA * 52 / 12)
  const importeHE35  = horasExtras35  * salarioHora * 1.35  // 35% recargo
  const importeHE100 = horasExtras100 * salarioHora * 2.00  // 100% recargo (feriados)
  const totalHorasExtras = importeHE35 + importeHE100

  const totalBruto = salarioBruto + totalHorasExtras + bonificaciones + comisiones

  // ─── TSS (capped at tope cotizable) ───────────────────────────────────────
  const salarioCotizable = Math.min(totalBruto, TOPE_COTIZABLE)

  const afpEmpleado  = salarioCotizable * TASAS_TSS.afpEmpleado
  const sfsEmpleado  = salarioCotizable * TASAS_TSS.sfsEmpleado
  const afpEmpleador = salarioCotizable * TASAS_TSS.afpEmpleador
  const sfsEmpleador = salarioCotizable * TASAS_TSS.sfsEmpleador

  const tasaSRL = categoriaRiesgo === 'alto'
    ? TASAS_TSS.srlAlto
    : categoriaRiesgo === 'medio'
    ? TASAS_TSS.srlMedio
    : TASAS_TSS.srlBajo
  const srlEmpleador = salarioCotizable * tasaSRL

  // ─── ISR Retención (DGII, Ley 11-92 art. 309) ─────────────────────────────
  // Base gravable = total bruto - AFP empleado - SFS empleado (deducibles)
  const baseGravableMensual  = totalBruto - afpEmpleado - sfsEmpleado
  const baseGravableAnual    = baseGravableMensual * 12
  const isrMensual           = calcularISRAnual(baseGravableAnual) / 12

  // ─── Totales ───────────────────────────────────────────────────────────────
  const totalDescuentos       = afpEmpleado + sfsEmpleado + isrMensual + otrosDescuentos
  const salarioNeto           = totalBruto - totalDescuentos
  const totalAportesEmpleador = afpEmpleador + sfsEmpleador + srlEmpleador
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
  // Valor diario = salario mensual / 26 días laborables promedio
  const valorDiario              = empleado.salarioBase / 26
  const vacacionesMensualesValor = vacacionesMensualesDias * valorDiario

  return {
    empleadoId: empleado.id,
    salarioBruto,
    importeHE35,
    importeHE100,
    totalHorasExtras,
    bonificaciones,
    comisiones,
    totalBruto,
    salarioCotizable,
    afpEmpleado,
    sfsEmpleado,
    isrMensual,
    otrosDescuentos,
    totalDescuentos,
    salarioNeto,
    afpEmpleador,
    sfsEmpleador,
    srlEmpleador,
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
  const otros    = m.otrosDescuentos / 2
  const totalDesc = afpEmp + sfsEmp + isr + otros

  return {
    ...m,
    salarioBruto:             m.salarioBruto / 2,
    importeHE35:              m.importeHE35 / 2,
    importeHE100:             m.importeHE100 / 2,
    totalHorasExtras:         m.totalHorasExtras / 2,
    bonificaciones:           m.bonificaciones / 2,
    comisiones:               m.comisiones / 2,
    totalBruto:               bruto,
    salarioCotizable:         m.salarioCotizable / 2,
    afpEmpleado:              afpEmp,
    sfsEmpleado:              sfsEmp,
    isrMensual:               isr,
    otrosDescuentos:          otros,
    totalDescuentos:          totalDesc,
    salarioNeto:              bruto - totalDesc,
    afpEmpleador:             m.afpEmpleador / 2,
    sfsEmpleador:             m.sfsEmpleador / 2,
    srlEmpleador:             m.srlEmpleador / 2,
    totalAportesEmpleador:    m.totalAportesEmpleador / 2,
    totalCostoEmpleador:      bruto + m.totalAportesEmpleador / 2,
    regaliaPascual:           m.regaliaPascual / 2,
    vacacionesMensualesDias:  m.vacacionesMensualesDias / 2,
    vacacionesMensualesValor: m.vacacionesMensualesValor / 2,
  }
}

// ─── Cesantía (Art. 80, Código de Trabajo Ley 16-92) ─────────────────────────
export function calcularCesantia(salarioMensual: number, anosServicio: number): number {
  const salarioDiario = salarioMensual / 30
  if (anosServicio < 0.25)  return 0
  if (anosServicio < 0.5)   return salarioDiario * 6                         // 3–6 meses: 6 días
  if (anosServicio < 1)     return salarioDiario * 13                        // 6–12 meses: 13 días
  if (anosServicio < 5)     return salarioDiario * 21 * Math.floor(anosServicio) // 1–5 años: 21 días/año
  if (anosServicio < 10)    return salarioDiario * 23 * Math.floor(anosServicio) // 5–10 años: 23 días/año
  return salarioDiario * 25 * Math.floor(anosServicio)                       // 10+ años: 25 días/año
}

// ─── Preaviso (Art. 76, Código de Trabajo) ───────────────────────────────────
export function calcularPreaviso(salarioMensual: number, anosServicio: number): number {
  const salarioDiario = salarioMensual / 30
  if (anosServicio < 0.25) return salarioDiario * 7   // < 3 meses: 7 días
  if (anosServicio < 0.5)  return salarioDiario * 14  // 3–6 meses: 14 días
  if (anosServicio < 1)    return salarioDiario * 28  // 6–12 meses: 28 días
  return salarioDiario * 45                           // > 1 año: 45 días (máximo)
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
