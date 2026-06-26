import { calcularNomina } from './dominican-labor'
import { EMPLEADOS } from './mock-data'
import type { PeriodoNomina, Prestamo, AjusteLinea, Empresa } from '@/types'

const EMPRESA_KEY   = 'cielo-empresa'
const EMPLEADOS_KEY = 'cielo-empleados'
const PERIODOS_KEY  = 'cielo-periodos'
const PRESTAMOS_KEY = 'cielo-prestamos'

// Stable IDs so payment history references are consistent
const PRESTAMO_CARLOS = 'prestamo-demo-carlos'
const PRESTAMO_ANA    = 'prestamo-demo-ana'
const PID_MAR = 'periodo-demo-mar-2026'
const PID_ABR = 'periodo-demo-abr-2026'
const PID_MAY = 'periodo-demo-may-2026'
const PID_JUN = 'periodo-demo-jun-2026'

// Cuotas (0% interest → P/n)
const CUOTA_CARLOS = 6_666.67   // 80,000 / 12 (rounded)
const CUOTA_ANA    = 3_000.00   // 18,000 / 6  (exact)

// ── Helper: sum adjustments into calcularNomina params ────────────────────────
function calcularConAjustes(empId: string, ajustesPorEmp: Record<string, AjusteLinea[]>) {
  const emp     = EMPLEADOS.find(e => e.id === empId)!
  const ajustes = ajustesPorEmp[empId] ?? []

  const horasExtras35  = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a)  => s + a.valor, 0)
  const horasExtras100 = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
  const bonificaciones = ajustes.filter(a => a.concepto === 'bono' || a.concepto === 'otro_ingreso').reduce((s, a) => s + a.valor, 0)
  const comisiones     = ajustes.filter(a => a.concepto === 'comision').reduce((s, a) => s + a.valor, 0)
  const otrosDesc      = ajustes.filter(a => a.concepto === 'prestamo' || a.concepto === 'otro_descuento').reduce((s, a) => s + a.valor, 0)

  return calcularNomina(emp, { horasExtras35, horasExtras100, bonificaciones, comisiones, otrosDescuentos: otrosDesc })
}

// ── Build a full PeriodoNomina with calculated totals ─────────────────────────
function buildPeriodo(
  id: string,
  mes: number,
  anio: number,
  fechaGeneracion: string,
  estado: 'procesada' | 'cerrada',
  ajustesPorEmpleado: Record<string, AjusteLinea[]>,
): PeriodoNomina {
  const activos = EMPLEADOS.filter(e => e.activo)
  let bruto = 0, descuentos = 0, neto = 0, aportes = 0, isr = 0, costoTotal = 0

  for (const emp of activos) {
    const r = calcularConAjustes(emp.id, ajustesPorEmpleado)
    bruto      += r.totalBruto
    descuentos += r.totalDescuentos
    neto       += r.salarioNeto
    aportes    += r.totalAportesEmpleador
    isr        += r.isrMensual
    costoTotal += r.totalCostoEmpleador
  }

  const round = (n: number) => Math.round(n * 100) / 100

  return {
    id,
    tipo: 'mensual',
    mes,
    anio,
    estado,
    fechaGeneracion,
    totalEmpleados: activos.length,
    totales: {
      bruto:     round(bruto),
      descuentos: round(descuentos),
      neto:      round(neto),
      aportes:   round(aportes),
      isr:       round(isr),
      costoTotal: round(costoTotal),
    },
    ajustesPorEmpleado,
  }
}

// ── Shorthand for loan-deduction adjustment ───────────────────────────────────
function loanAdj(id: string, prestamoId: string, nota: string, cuota: number): AjusteLinea {
  return { id, tipo: 'deduccion', concepto: 'prestamo', descripcion: `Préstamo — ${nota}`, valor: cuota, prestamoId }
}

// ── Main export ───────────────────────────────────────────────────────────────
export function cargarDatosDemo(): void {

  // ── 1. Empresa ───────────────────────────────────────────────────────────────
  const empresa: Empresa = {
    nombre: 'Distribuciones del Caribe, S.R.L.',
    rnc: '101-52847-3',
    direccion: 'Av. Winston Churchill #1099, Piantini',
    ciudad: 'Santo Domingo',
    telefono: '809-555-1200',
    email: 'admin@distribcaribe.com.do',
    representanteLegal: 'Carmen Rosa Peña Soto',
    modalidadNomina: 'mensual',
  }

  // ── 2. Empleados (same as MOCK — already in context) ─────────────────────────
  // Written explicitly so the seed is self-contained even if MOCK changes
  const empleados = EMPLEADOS

  // ── 3. Préstamos con historial de pagos ───────────────────────────────────────
  //
  //  Carlos Rodríguez (id='2') — RD$80,000, 12 cuotas mensuales sin interés
  //  Otorgado: 01 Feb 2026 · 4 cuotas pagadas (Mar–Jun) · saldo: 53,333.32
  //
  //  Ana Martínez (id='3') — RD$18,000, 6 cuotas mensuales sin interés
  //  Otorgado: 15 Abr 2026 · 2 cuotas pagadas (May–Jun) · saldo: 12,000.00
  //
  const prestamos: Prestamo[] = [
    {
      id: PRESTAMO_CARLOS,
      empleadoId: '2',
      monto: 80_000,
      saldoPendiente: 80_000 - CUOTA_CARLOS * 4,   // 53,333.32
      tasaInteres: 0,
      cuotas: 12,
      cuotaBase: CUOTA_CARLOS,
      frecuencia: 'mensual',
      fechaOtorgamiento: '2026-02-01',
      estado: 'activo',
      notas: 'Compra de vehículo',
      pagos: [
        { id: 'pago-demo-c1', periodoId: PID_MAR, fecha: '2026-03-31T23:59:00.000Z', montoPagado: CUOTA_CARLOS, esLiquidacion: false },
        { id: 'pago-demo-c2', periodoId: PID_ABR, fecha: '2026-04-30T23:59:00.000Z', montoPagado: CUOTA_CARLOS, esLiquidacion: false },
        { id: 'pago-demo-c3', periodoId: PID_MAY, fecha: '2026-05-31T23:59:00.000Z', montoPagado: CUOTA_CARLOS, esLiquidacion: false },
        { id: 'pago-demo-c4', periodoId: PID_JUN, fecha: '2026-06-26T23:59:00.000Z', montoPagado: CUOTA_CARLOS, esLiquidacion: false },
      ],
    },
    {
      id: PRESTAMO_ANA,
      empleadoId: '3',
      monto: 18_000,
      saldoPendiente: 18_000 - CUOTA_ANA * 2,       // 12,000.00
      tasaInteres: 0,
      cuotas: 6,
      cuotaBase: CUOTA_ANA,
      frecuencia: 'mensual',
      fechaOtorgamiento: '2026-04-15',
      estado: 'activo',
      notas: 'Gastos médicos',
      pagos: [
        { id: 'pago-demo-a1', periodoId: PID_MAY, fecha: '2026-05-31T23:59:00.000Z', montoPagado: CUOTA_ANA, esLiquidacion: false },
        { id: 'pago-demo-a2', periodoId: PID_JUN, fecha: '2026-06-26T23:59:00.000Z', montoPagado: CUOTA_ANA, esLiquidacion: false },
      ],
    },
  ]

  // ── 4. Períodos de nómina con ajustes ─────────────────────────────────────────
  //
  //  Estructura del escenario:
  //
  //  Marzo 2026  (cerrada): Carlos descuento préstamo
  //  Abril 2026  (cerrada): Carlos descuento préstamo · María bono desempeño RD$8,000
  //  Mayo  2026  (cerrada): Carlos descuento préstamo · Ana descuento préstamo
  //  Junio 2026  (cerrada): Carlos descuento préstamo · Ana descuento préstamo · Luisa comisión RD$15,000
  //
  //  Esto cubre los 4 casos de ajuste más comunes:
  //    1. Deducción préstamo que eleva impacto fiscal del neto
  //    2. Bono de desempeño que sube ISR del beneficiario
  //    3. Comisión de ventas que lleva a Luisa (0% ISR en salario base) a pagar ISR
  //

  const ajustesMar: Record<string, AjusteLinea[]> = {
    '2': [loanAdj('adj-mar-c', PRESTAMO_CARLOS, 'Compra de vehículo', CUOTA_CARLOS)],
  }

  const ajustesAbr: Record<string, AjusteLinea[]> = {
    '2': [loanAdj('adj-abr-c', PRESTAMO_CARLOS, 'Compra de vehículo', CUOTA_CARLOS)],
    '1': [{ id: 'adj-abr-maria', tipo: 'ingreso', concepto: 'bono', descripcion: 'Bono desempeño Q1 2026', valor: 8_000 }],
  }

  const ajustesMay: Record<string, AjusteLinea[]> = {
    '2': [loanAdj('adj-may-c', PRESTAMO_CARLOS, 'Compra de vehículo', CUOTA_CARLOS)],
    '3': [loanAdj('adj-may-a', PRESTAMO_ANA, 'Gastos médicos', CUOTA_ANA)],
  }

  const ajustesJun: Record<string, AjusteLinea[]> = {
    '2': [loanAdj('adj-jun-c', PRESTAMO_CARLOS, 'Compra de vehículo', CUOTA_CARLOS)],
    '3': [loanAdj('adj-jun-a', PRESTAMO_ANA, 'Gastos médicos', CUOTA_ANA)],
    '7': [{ id: 'adj-jun-luisa', tipo: 'ingreso', concepto: 'comision', descripcion: 'Comisión ventas — Junio 2026', valor: 15_000 }],
  }

  // Newest first (context stores in this order)
  const periodos: PeriodoNomina[] = [
    buildPeriodo(PID_JUN, 6, 2026, '2026-06-26T12:00:00.000Z', 'cerrada', ajustesJun),
    buildPeriodo(PID_MAY, 5, 2026, '2026-05-31T12:00:00.000Z', 'cerrada', ajustesMay),
    buildPeriodo(PID_ABR, 4, 2026, '2026-04-30T12:00:00.000Z', 'cerrada', ajustesAbr),
    buildPeriodo(PID_MAR, 3, 2026, '2026-03-31T12:00:00.000Z', 'cerrada', ajustesMar),
  ]

  // ── 5. Persist to localStorage ────────────────────────────────────────────────
  localStorage.setItem(EMPRESA_KEY,   JSON.stringify(empresa))
  localStorage.setItem(EMPLEADOS_KEY, JSON.stringify(empleados))
  localStorage.setItem(PRESTAMOS_KEY, JSON.stringify(prestamos))
  localStorage.setItem(PERIODOS_KEY,  JSON.stringify(periodos))
}
