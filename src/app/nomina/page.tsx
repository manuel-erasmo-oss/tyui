'use client'

import { useState, useEffect, Fragment } from 'react'
import {
  ChevronRight,
  Download,
  Lock,
  Unlock,
  Trash2,
  ArrowLeft,
  Plus,
  X,
  Info,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
  PlayCircle,
  History,
  ShieldCheck,
  Mail,
  Send,
  Filter,
  FileSpreadsheet,
  Gift,
  Search,
  Eye,
  Percent,
  RotateCcw,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { ImportadorHorasExcel } from '@/components/nomina/ImportadorHorasExcel'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos, esPeriodoMasReciente, periodoAnterior } from '@/lib/periodos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useLiquidaciones } from '@/lib/liquidaciones-context'
import { useSaldoISR } from '@/lib/saldo-isr-context'
import { useFeriados } from '@/lib/feriados-context'
import { useVacaciones } from '@/lib/vacaciones-context'
import { useLicencias } from '@/lib/licencias-context'
import { useAumentos } from '@/lib/aumentos-context'
import { useAuth } from '@/lib/auth-context'
import { calcularNomina, calcularNominaQuincenal, cuotaDependienteSFS, aplicarSaldoISRFavor, prorratearMontoFijo, ajustesToParams, getAnosServicio, getDivisorSalarioDiario, contarDiasLaborables } from '@/lib/dominican-labor'
import { useConceptosPersonalizados } from '@/lib/conceptos-personalizados-context'
import { formatRD, fullName, formatDate, BTN_PRIMARY, cn } from '@/lib/utils'
import {
  labelPeriodo, resultadoRegalia, resultadoBonificacion, descargarComprobantePDF,
  diasSuspensionEnPeriodo, diasSalidaEnPeriodo,
  diasVacacionEnPeriodo, diasLicenciaSinSueldoEnPeriodo, diasIngresoEnPeriodo, salarioEfectivoEnPeriodo, calcularParaPeriodo, rangoPeriodo,
} from '@/lib/nomina-shared'
import type {
  Empleado,
  ResultadoNomina,
  PeriodoNomina,
  TipoPeriodo,
  EstadoPeriodo,
  ParametrosNomina,
  ConceptoAjuste,
  AjusteLinea,
  Empresa,
  DisfruteVacaciones,
  Licencia,
  RegistroAumento,
} from '@/types'
import { UMBRAL_ENDEUDAMIENTO_DEFAULT, UMBRAL_VARIACION_BRUTO_DEFAULT } from '@/types'
import { Wallet, TrendingUp, Receipt, BarChart3 } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const hoy = new Date()

// ── Label helpers ─────────────────────────────────────────────────────────────
// Nómina en USD — capa de presentación pura, nunca la base del cálculo. El
// motor tributario (dominican-labor.ts) siempre calcula y persiste en RD$;
// esta función solo convierte lo que ya se calculó para mostrarlo en pantalla,
// usando la tasa que la empresa configura manualmente en Configuración (sin
// conexión a ningún servicio de tasas en vivo). El comprobante en PDF, el CSV
// exportado y la plantilla de correo de pago siguen mostrando RD$ siempre —
// son el registro legal/financiero real, no una vista de conveniencia.
function formatMoneda(amountRD: number, empresa: Empresa, mostrarUSD: boolean, decimals = 2): string {
  if (mostrarUSD && empresa.tasaCambioUSD) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(amountRD / empresa.tasaCambioUSD)
  }
  return formatRD(amountRD, decimals)
}

function labelConcepto(concepto: ConceptoAjuste): string {
  const map: Record<ConceptoAjuste, string> = {
    horas_extras_35:  'H.E. 35%',
    horas_extras_100: 'H.E. 100%',
    recargo_nocturno: 'Recargo Nocturno',
    comision:         'Comisión',
    bono:             'Bono',
    prestamo:         'Préstamo',
    dependiente_sfs:  'Dep. SFS',
    otro_ingreso:     'Otro Ingreso',
    otro_descuento:   'Otro Desc.',
    personalizado:    'Personalizado',
  }
  return map[concepto]
}

// Label real de un ajuste — para 'personalizado' usa el nombre del concepto
// tal como quedó al momento de agregarlo (snapshot), no el genérico de arriba.
function labelAjuste(a: AjusteLinea): string {
  if (a.concepto === 'personalizado') return a.conceptoPersonalizadoNombre || 'Personalizado'
  return labelConcepto(a.concepto)
}

function isHorasConcepto(concepto: ConceptoAjuste): boolean {
  return concepto === 'horas_extras_35' || concepto === 'horas_extras_100' || concepto === 'recargo_nocturno'
}

// Lista de empleados que participan de un período específico: los normales
// (empleadosEnNomina) más cualquier empleado suspendido o con salida
// pendiente (pago "por nómina") cuya fecha de corte cae dentro de este
// período — porque sí trabajó una parte y le corresponde su pago
// prorrateado, aunque ya esté suspendido o a punto de irse. Una fecha de
// corte ANTERIOR a que el período comenzara no se agrega (0 días
// trabajados, correctamente excluido).
//
// También excluye de "normales" a cualquier empleado cuya fechaIngreso caiga
// DESPUÉS de que este período ya terminó — todavía no existía en la empresa
// durante ese rango de fechas, así que no debe aparecer en absoluto (ni
// siquiera con RD$0). Un ingreso DENTRO del período sí se conserva: se
// prorratea vía diasIngresoEnPeriodo en calcularParaPeriodo, no se excluye.
function empleadosDelPeriodo(
  todos: Empleado[], normales: Empleado[], mes: number, anio: number, tipo: TipoPeriodo, quincena: 1 | 2,
): Empleado[] {
  const { fin } = rangoPeriodo(mes, anio, tipo, quincena)
  const normalesVigentes = normales.filter(e => new Date(e.fechaIngreso) <= fin)
  const extra = todos.filter(e =>
    e.activo && !normalesVigentes.some(n => n.id === e.id) && (
      (e.suspendido && diasSuspensionEnPeriodo(e, mes, anio, tipo, quincena) !== null) ||
      (e.salidaPendiente && diasSalidaEnPeriodo(e, mes, anio, tipo, quincena) !== null)
    )
  )
  return extra.length ? [...normalesVigentes, ...extra] : normalesVigentes
}

// Sugiere el próximo período mensual/quincenal a crear, continuando la serie
// existente de ese tipo (ignora Regalía Pascual — es un ciclo aparte). Sin
// períodos previos de ese tipo, sugiere el mes/quincena calendario actual.
function sugerirProximoPeriodo(
  periodos: PeriodoNomina[], tipo: TipoPeriodo,
): { mes: number; anio: number; quincena: 1 | 2 } {
  const serie = periodos
    .filter(p => p.tipo === tipo)
    .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes) || ((b.quincena ?? 1) - (a.quincena ?? 1)))
  const ultimo = serie[0]
  if (!ultimo) return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), quincena: 1 }
  if (tipo === 'quincenal' && ultimo.quincena === 1) {
    return { mes: ultimo.mes, anio: ultimo.anio, quincena: 2 }
  }
  const mes  = ultimo.mes === 12 ? 1 : ultimo.mes + 1
  const anio = ultimo.mes === 12 ? ultimo.anio + 1 : ultimo.anio
  return { mes, anio, quincena: 1 }
}

// ── Detalle modal ─────────────────────────────────────────────────────────────
function DetalleNomina({
  empleado,
  nomina,
  periodoLabel,
  mostrarUSD,
  onClose,
}: {
  empleado: Empleado
  nomina: ResultadoNomina
  periodoLabel: string
  mostrarUSD: boolean
  onClose: () => void
}) {
  const { empresa } = useEmpresa()
  const fmt = (amount: number, decimals = 2) => formatMoneda(amount, empresa, mostrarUSD, decimals)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-xl bg-zinc-950 dark:bg-[#080a12] px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            {empresa.logo && (
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white flex items-center justify-center">
                <img src={empresa.logo} alt={empresa.nombre} className="h-full w-full object-contain p-1" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Comprobante · {periodoLabel}
              </p>
              <p className="mt-1 text-lg font-bold">{fullName(empleado)}</p>
              <p className="text-sm text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-100 dark:divide-[#1d2035]">
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Devengos</p>
            <div className="space-y-2">
              {[
                { label: 'Salario Básico',      value: nomina.salarioBruto },
                { label: 'H.E. 35% Recargo',    value: nomina.importeHE35,    hide: nomina.importeHE35 === 0 },
                { label: 'H.E. 100% Recargo',   value: nomina.importeHE100,   hide: nomina.importeHE100 === 0 },
                { label: 'Recargo Nocturno (15%)', value: nomina.importeNocturno, hide: nomina.importeNocturno === 0 },
                { label: 'Bonificaciones',       value: nomina.bonificaciones, hide: nomina.bonificaciones === 0 },
                { label: 'Comisiones',           value: nomina.comisiones,     hide: nomina.comisiones === 0 },
                { label: 'Vacaciones (Goce)',     value: nomina.vacacionesGoce, hide: nomina.vacacionesGoce === 0 },
                { label: 'Vacaciones Vendidas',   value: nomina.vacacionesVendidas, hide: nomina.vacacionesVendidas === 0 },
                { label: 'Otros Ingresos',       value: nomina.ingresosPersonalizados, hide: nomina.ingresosPersonalizados === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{fmt(row.value)}</span>
                </div>
              ))}
              {nomina.vacacionesGoce > 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  Incluye días de disfrute de vacaciones — salario ordinario, con AFP/SFS/ISR normales (Art. 178)
                </p>
              )}
              {nomina.vacacionesVendidas > 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  Incluye venta de vacaciones — pago extra sobre el salario normal completo, con AFP/SFS/ISR (Art. 178)
                </p>
              )}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Bruto</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(nomina.totalBruto)}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">Descuentos</p>
            <div className="space-y-2">
              {[
                { label: 'AFP Empleado (2.87%)',     value: nomina.afpEmpleado },
                { label: 'SFS Empleado (3.04%)',     value: nomina.sfsEmpleado },
                { label: 'ISR Retención',             value: nomina.isrMensual,        hide: nomina.isrMensual === 0 },
                { label: 'SFS Dep. Adicionales',      value: nomina.sfsDependientes,   hide: nomina.sfsDependientes === 0 },
                { label: 'Otros Descuentos',          value: nomina.otrosDescuentos,   hide: nomina.otrosDescuentos === 0 },
                { label: 'Aporte Voluntario AFP',      value: nomina.aporteVoluntarioAFPEmpleado, hide: nomina.aporteVoluntarioAFPEmpleado === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-rose-700 dark:text-rose-400">({fmt(row.value)})</span>
                </div>
              ))}
              {nomina.isrMensual === 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  ISR: anticipo de quincena (se liquida en 2ª quincena)
                </p>
              )}
              {nomina.saldoISRAplicado > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic">
                  Incluye crédito ISR a favor aplicado: -{fmt(nomina.saldoISRAplicado)}
                </p>
              )}
              {(empleado.ingresoOtroEmpleadorMensual ?? 0) > 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  ISR consolidado con ingreso de otro empleador ({fmt(empleado.ingresoOtroEmpleadorMensual!)}/mes)
                  — esta empresa solo retiene su porción proporcional
                </p>
              )}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Descuentos</span>
                <span className="text-rose-700 dark:text-rose-400 tabular-nums">({fmt(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] p-6 rounded-b-xl">
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide">Salario Neto a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">{fmt(nomina.salarioNeto)}</p>
            {nomina.grossingUpEmpresa > 0 && (
              <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                Incluye reembolso de grossing-up: +{fmt(nomina.grossingUpEmpresa)}
              </p>
            )}
          </div>
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4 space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide mb-2">Aportes Empresa (TSS)</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">AFP Empleador (7.10%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SFS Empleador (7.09%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SRL Empleador</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.srlEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">Infotep (1.00%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.infotepEmpleador)}</span>
            </div>
            {nomina.aporteVoluntarioAFPEmpresa > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Aporte Voluntario AFP (empresa)</span>
                <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.aporteVoluntarioAFPEmpresa)}</span>
              </div>
            )}
            {nomina.grossingUpEmpresa > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Grossing-up (ISR/TSS empleado)</span>
                <span className="tabular-nums font-medium dark:text-zinc-200">{fmt(nomina.grossingUpEmpresa)}</span>
              </div>
            )}
            <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-1.5 flex justify-between text-xs font-bold">
              <span className="dark:text-zinc-200">Costo Total Empresa</span>
              <span className="text-amber-700 dark:text-amber-400 tabular-nums">{fmt(nomina.totalCostoEmpleador)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Regalía/período: <strong className="text-zinc-800 dark:text-zinc-200">{fmt(nomina.regaliaPascual)}</strong></span>
            <span>Vacaciones: <strong className="text-zinc-800 dark:text-zinc-200">{nomina.vacacionesMensualesDias.toFixed(2)} días</strong></span>
          </div>
          <button
            onClick={() => descargarComprobantePDF(empleado, nomina, periodoLabel, empresa)}
            className={cn(BTN_PRIMARY, 'shrink-0')}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NominaPage() {
  const { empleados, empleadosEnNomina, update: actualizarEmpleado } = useEmpleados()
  const { periodos, generar, cerrar, eliminar, actualizarAjustes, actualizarTotales, marcarProcesados, reabrir } = usePeriodos()
  const { empresa } = useEmpresa()
  const { getPrestamosActivos, registrarPago, registrarOmisionCuota } = usePrestamos()
  const { liquidaciones } = useLiquidaciones()
  const { saldos: saldosISR, getSaldosActivos, getMontoAplicadoEnPeriodo, aplicar: aplicarSaldoISR } = useSaldoISR()
  const { getFeriados } = useFeriados()
  const { disfrutes } = useVacaciones()
  const { licencias } = useLicencias()
  const { aumentos } = useAumentos()
  const { user } = useAuth()
  const { conceptosActivos: conceptosPersonalizados, getConcepto: getConceptoPersonalizado } = useConceptosPersonalizados()

  // Aplica el saldo ISR a favor sobre un resultado ya calculado. Si el
  // empleado ya fue procesado en este período, usa el monto histórico
  // realmente aplicado (fijo, no cambia aunque el saldoPendiente actual sí);
  // si aún no se procesa, muestra una vista previa en vivo contra el saldo
  // disponible ahora mismo (se "congela" recién al procesar).
  function conSaldoISR(empleado: Empleado, base: ResultadoNomina, periodo: PeriodoNomina): ResultadoNomina {
    const yaProcesado = periodo.empleadosProcesados?.includes(empleado.id) ?? false
    // Suma TODOS los saldos activos, no solo el más antiguo — un empleado
    // puede tener más de un registro de crédito ISR vigente a la vez (ej. uno
    // de hace varios años parcialmente consumido más uno nuevo), y el ISR de
    // este período debe poder cubrirse encadenando ambos (FIFO), no solo el
    // primero.
    const monto = yaProcesado
      ? getMontoAplicadoEnPeriodo(empleado.id, periodo.id)
      : getSaldosActivos(empleado.id).reduce((s, x) => s + x.saldoPendiente, 0)
    return aplicarSaldoISRFavor(base, monto, empleado.grossingUpPct).resultado
  }

  // Fuente única de verdad para "cuánto se le pagó/se le va a pagar a este
  // empleado en este período": si ya existe un snapshot congelado (empleado
  // ya procesado), lo usa tal cual — es el registro fidedigno de lo
  // realmente calculado en ese momento, inmune a cambios posteriores del
  // Empleado (aumento salarial, etc.). Si aún no se procesa, calcula una
  // vista previa en vivo (con el prorrateo por suspensión si aplica).
  function resultadoDePeriodo(empleado: Empleado, ajustes: AjusteLinea[], periodo: PeriodoNomina): ResultadoNomina {
    const snapshot = periodo.resultadosPorEmpleado?.[empleado.id]
    if (snapshot) return snapshot
    return conSaldoISR(empleado, calcularParaPeriodo(empleado, ajustes, periodo, disfrutes, licencias, aumentos), periodo)
  }

  // View state
  const [periodoAbierto, setPeriodoAbierto] = useState<string | null>(null)

  // Nómina en USD — toggle de presentación en pantalla, solo disponible si la
  // empresa configuró una tasa de cambio manual. No afecta ningún cálculo,
  // el PDF de comprobante, el CSV exportado ni la plantilla de correo.
  const [mostrarUSD, setMostrarUSD] = useState(false)
  const fmt = (amount: number, decimals = 2) => formatMoneda(amount, empresa, mostrarUSD, decimals)

  // Create period form
  const [nuevoTipo, setNuevoTipo]         = useState<TipoPeriodo>('mensual')
  const [nuevoMes, setNuevoMes]           = useState(hoy.getMonth() + 1)
  const [nuevoAnio, setNuevoAnio]         = useState(hoy.getFullYear())
  const [nuevaQuincena, setNuevaQuincena] = useState<1 | 2>(1)

  // Lista de períodos ("Cálculo de Nómina") — búsqueda + filtros de estado/año
  const [busquedaPeriodo, setBusquedaPeriodo]       = useState('')
  const [filtroEstadoPeriodo, setFiltroEstadoPeriodo] = useState<'todos' | EstadoPeriodo>('todos')
  const [filtroAnioPeriodo, setFiltroAnioPeriodo]   = useState<'todos' | number>('todos')

  // Ajuste inline form
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)
  const [newTipo, setNewTipo]             = useState<'ingreso' | 'deduccion'>('ingreso')
  const [newConcepto, setNewConcepto]     = useState<ConceptoAjuste>('bono')
  const [newConceptoPersId, setNewConceptoPersId] = useState<string | null>(null)
  const [newValor, setNewValor]           = useState('')
  const [newDesc, setNewDesc]             = useState('')

  // Selección para procesamiento masivo
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set())

  // Filtros de selección múltiple — solo cubre datos que realmente existen hoy
  // en el modelo (departamento, fecha de ingreso); no hay campo de "fecha de
  // último cambio salarial" en el sistema, así que no se ofrece ese filtro.
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const [filtroIngresoDesde, setFiltroIngresoDesde] = useState('')
  const [filtroIngresoHasta, setFiltroIngresoHasta] = useState('')

  // Búsqueda/filtro de la tabla de empleados del período — independiente del
  // panel de "Filtros" de arriba (ese es un criterio de selección masiva,
  // solo visible en_proceso; esto es para ubicar empleados en la tabla,
  // visible sin importar el estado del período). Mismo patrón ya usado en
  // Regalía Pascual.
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('')
  const [filtroDeptoTabla, setFiltroDeptoTabla] = useState('todos')

  // Auditoría pre-cierre: ids en espera de confirmación antes de completar
  // el período (pasar de en_proceso a procesada)
  const [auditoriaIds, setAuditoriaIds] = useState<string[] | null>(null)

  // Importador de horas trabajadas (Excel/CSV) — solo tiene sentido con el
  // período en_proceso, ya que anexa AjusteLinea nuevas a los empleados.
  const [importarHorasAbierto, setImportarHorasAbierto] = useState(false)

  // Modal + toast
  const [detalleModal, setDetalleModal] = useState<{ emp: Empleado; nom: ResultadoNomina } | null>(null)
  const [toast, setToast]               = useState<string | null>(null)

  useEffect(() => {
    if (empresa.modalidadNomina) setNuevoTipo(empresa.modalidadNomina)
  }, [empresa.modalidadNomina])

  // Pre-llena Mes/Año/Quincena con una sugerencia razonable (sigue la serie
  // existente, o el mes actual si es el primer período) solo al cambiar la
  // frecuencia — el usuario elige libremente el período desde ahí, así que
  // esto NO debe recalcularse cada vez que cambia `periodos` (le pisaría la
  // selección manual con cualquier actualización de fondo).
  useEffect(() => {
    const sugerido = sugerirProximoPeriodo(periodos, nuevoTipo)
    setNuevoMes(sugerido.mes)
    setNuevoAnio(sugerido.anio)
    setNuevaQuincena(sugerido.quincena)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevoTipo])

  const periodoActual = periodos.find(p => p.id === periodoAbierto) ?? null
  const periodoActualLabel = periodoActual ? labelPeriodo(periodoActual) : ''

  // Empleados que participan del período abierto — incluye, además de los
  // normales, a cualquier suspendido a mitad de ESTE período (ver
  // empleadosDelPeriodo). Sustituye a empleadosEnNomina en todo lo que sea
  // específico del período actualmente abierto.
  const empleadosPeriodo = periodoActual
    ? empleadosDelPeriodo(empleados, empleadosEnNomina, periodoActual.mes, periodoActual.anio, periodoActual.tipo, periodoActual.quincena ?? 1)
    : empleadosEnNomina

  // If the open period was deleted, reset to list view without calling setState during render
  useEffect(() => {
    if (periodoAbierto && !periodos.find(p => p.id === periodoAbierto)) {
      setPeriodoAbierto(null)
    }
  }, [periodoAbierto, periodos])

  // Recalcula y persiste PeriodoNomina.totales cada vez que cambian sus
  // ajustes, la lista de procesados, o cualquier crédito de Saldo ISR.
  // Sin esto, totales queda congelado con el valor calculado al CREAR el
  // período (ver calcularTotalesRapido más abajo, usado solo en
  // handleCrearPeriodo) y nunca refleja ajustes agregados después ni
  // créditos ISR aplicados — un desajuste silencioso que se propaga a las
  // cards de la lista de períodos, el Dashboard y toda Reportería, que leen
  // periodo.totales directamente en vez de recalcular en vivo.
  //
  // Solo mientras en_proceso: un período procesada/cerrada es un registro
  // histórico — recalcular con datos EN VIVO de empleadosEnNomina lo dejaría
  // vulnerable a que un cambio salarial posterior (aumento, etc.) infle
  // retroactivamente el bruto/neto de un mes ya cerrado y pagado, aunque ese
  // monto nunca se pagó realmente. Al reabrir (desposteo) el estado vuelve a
  // en_proceso y el recálculo en vivo se reanuda correctamente.
  useEffect(() => {
    // El período de Regalía Pascual (tipo 'regalia') o de Bonificación por
    // Utilidades (tipo 'bonificacion') nace con sus totales ya congelados
    // desde montosRegalia/montosBonificacion — no usa ajustesPorEmpleado ni
    // el motor normal de calcularNomina en este flujo, así que este
    // recálculo no aplica a ninguno de los dos.
    if (!periodoActual || periodoActual.estado !== 'en_proceso' || periodoActual.tipo === 'regalia' || periodoActual.tipo === 'bonificacion') return
    const ajustesPorEmp = periodoActual.ajustesPorEmpleado ?? {}
    const rs = empleadosPeriodo.map(e =>
      conSaldoISR(e, calcularParaPeriodo(e, ajustesPorEmp[e.id] ?? [], periodoActual, disfrutes, licencias, aumentos), periodoActual)
    )
    const round = (n: number) => Math.round(n * 100) / 100
    const nuevos = {
      bruto:      round(rs.reduce((s, r) => s + r.totalBruto, 0)),
      descuentos: round(rs.reduce((s, r) => s + r.totalDescuentos, 0)),
      neto:       round(rs.reduce((s, r) => s + r.salarioNeto, 0)),
      aportes:    round(rs.reduce((s, r) => s + r.totalAportesEmpleador, 0)),
      isr:        round(rs.reduce((s, r) => s + r.isrMensual, 0)),
      costoTotal: round(rs.reduce((s, r) => s + r.totalCostoEmpleador, 0)),
    }
    const actuales = periodoActual.totales
    const cambiaron = (Object.keys(nuevos) as (keyof typeof nuevos)[]).some(k => nuevos[k] !== actuales[k])
    if (cambiaron) actualizarTotales(periodoActual.id, nuevos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoActual?.id, periodoActual?.ajustesPorEmpleado, periodoActual?.empleadosProcesados, periodoActual?.estado, empleadosPeriodo, saldosISR, disfrutes])

  function calcularTotalesRapido(ajustesPorEmp: Record<string, AjusteLinea[]> = {}) {
    const empleadosNuevoPeriodo = empleadosDelPeriodo(empleados, empleadosEnNomina, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena)
    const rs = empleadosNuevoPeriodo.map(e =>
      calcularParaPeriodo(e, ajustesPorEmp[e.id] ?? [], { mes: nuevoMes, anio: nuevoAnio, tipo: nuevoTipo, quincena: nuevaQuincena }, disfrutes, licencias, aumentos)
    )
    return {
      bruto:      rs.reduce((s, r) => s + r.totalBruto, 0),
      descuentos: rs.reduce((s, r) => s + r.totalDescuentos, 0),
      neto:       rs.reduce((s, r) => s + r.salarioNeto, 0),
      aportes:    rs.reduce((s, r) => s + r.totalAportesEmpleador, 0),
      isr:        rs.reduce((s, r) => s + r.isrMensual, 0),
      costoTotal: rs.reduce((s, r) => s + r.totalCostoEmpleador, 0),
    }
  }

  function handleCrearPeriodo() {
    // Block duplicate period (same tipo/mes/anio/quincena)
    const duplicado = periodos.some(p =>
      p.tipo === nuevoTipo &&
      p.mes  === nuevoMes  &&
      p.anio === nuevoAnio &&
      (nuevoTipo === 'mensual' || p.quincena === nuevaQuincena)
    )
    if (duplicado) {
      setToast('Ya existe un período con ese tipo, mes y año')
      return
    }

    const empleadosNuevoPeriodo = empleadosDelPeriodo(empleados, empleadosEnNomina, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena)

    // Pre-load active loan installments as deductions per employee
    const ajustesIniciales: Record<string, AjusteLinea[]> = {}
    for (const emp of empleadosNuevoPeriodo) {
      const loans = getPrestamosActivos(emp.id)
      if (loans.length > 0) {
        ajustesIniciales[emp.id] = loans.map(p => {
          const etiqueta = p.tipo === 'avance' ? 'Avance de salario' : 'Préstamo'
          return {
            id: `loan-${p.id}`,
            tipo: 'deduccion' as const,
            concepto: 'prestamo' as const,
            descripcion: p.notas ? `${etiqueta} — ${p.notas}` : etiqueta,
            valor: p.cuotaBase,
            prestamoId: p.id,
          }
        })
      }
    }
    for (const emp of empleadosNuevoPeriodo) {
      const deps = emp.dependientes ?? []
      if (deps.length > 0) {
        const cuotaMensualDep = cuotaDependienteSFS()
        const depAjustes = deps.map(d => ({
          id: `dep-${d.id}-${Date.now().toString(36)}`,
          tipo: 'deduccion' as const,
          concepto: 'dependiente_sfs' as const,
          descripcion: `SFS Dep. — ${d.nombre} ${d.apellido}`,
          valor: prorratearMontoFijo(cuotaMensualDep, nuevoTipo),
        }))
        ajustesIniciales[emp.id] = [...(ajustesIniciales[emp.id] ?? []), ...depAjustes]
      }
    }
    const nuevo = generar({
      tipo:               nuevoTipo,
      quincena:           nuevoTipo === 'quincenal' ? nuevaQuincena : undefined,
      mes:                nuevoMes,
      anio:               nuevoAnio,
      estado:             'en_proceso',
      totalEmpleados:     empleadosNuevoPeriodo.length,
      totales:            calcularTotalesRapido(ajustesIniciales),
      ajustesPorEmpleado: ajustesIniciales,
    })
    setPeriodoAbierto(nuevo.id)
    setSelectedEmps(new Set())
    // El goce de vacaciones (Disfrute registrado en /vacaciones), el
    // prorrateo por licencia sin sueldo (Licencias), y el salario ponderado
    // por reajuste a mitad de período (Aumentos Salariales) se aplican
    // automáticamente al calcular cada empleado — no son un AjusteLinea, así
    // que no hay nada que pre-cargar aquí, solo avisar si aplica a alguien.
    const conVacaciones = empleadosNuevoPeriodo.filter(e =>
      diasVacacionEnPeriodo(e, disfrutes, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena) !== null
    ).length
    const conLicenciaSinSueldo = empleadosNuevoPeriodo.filter(e =>
      diasLicenciaSinSueldoEnPeriodo(e, licencias, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena) !== null
    ).length
    // Solo cuenta como "reajuste" si el salario reconstruido para este
    // período realmente DIFIERE del salario en vivo — salarioEfectivoEnPeriodo
    // también devuelve un valor (no null) para el caso "sin ningún reajuste
    // relevante, coincide con el salario actual", que no amerita aviso.
    const conReajusteSalarial = empleadosNuevoPeriodo.filter(e => {
      const efectivo = salarioEfectivoEnPeriodo(e.id, aumentos, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena)
      return efectivo !== null && Math.abs(efectivo - e.salarioBase) > 0.005
    }).length
    const conIngresoTardio = empleadosNuevoPeriodo.filter(e =>
      diasIngresoEnPeriodo(e, nuevoMes, nuevoAnio, nuevoTipo, nuevaQuincena) !== null
    ).length
    const avisos = [
      conVacaciones > 0 ? `${conVacaciones} empleado(s) con vacaciones` : null,
      conLicenciaSinSueldo > 0 ? `${conLicenciaSinSueldo} empleado(s) con licencia sin sueldo` : null,
      conReajusteSalarial > 0 ? `${conReajusteSalarial} empleado(s) con reajuste salarial` : null,
      conIngresoTardio > 0 ? `${conIngresoTardio} empleado(s) con ingreso a mitad de período (prorrateado)` : null,
    ].filter(Boolean)
    setToast(avisos.length > 0
      ? `Período creado · Cuotas de préstamos pre-cargadas · ${avisos.join(' · ')} en este período`
      : 'Período creado · Cuotas de préstamos pre-cargadas')
  }

  function handleCerrarPeriodo() {
    if (!periodoActual) return
    // Register actual paid amounts against each loan
    const ajustesPorEmp = periodoActual.ajustesPorEmpleado ?? {}
    for (const ajustes of Object.values(ajustesPorEmp)) {
      for (const ajuste of ajustes) {
        if (ajuste.concepto === 'prestamo' && ajuste.prestamoId && ajuste.valor > 0) {
          registrarPago(ajuste.prestamoId, {
            periodoId: periodoActual.id,
            fecha: new Date().toISOString(),
            montoPagado: ajuste.valor,
            esLiquidacion: false,
          })
        }
      }
    }
    cerrar(periodoActual.id)
    setToast('Período cerrado · Pagos de préstamos registrados')
  }

  // Procesa el pago de Regalía Pascual de uno o varios empleados dentro de un
  // período tipo 'regalia': congela el ResultadoNomina sintético (bruto, sin
  // AFP/SFS/ISR) igual que cualquier otro período, y además "reinicia" el
  // acumulado del empleado a cero estampando regaliaPagadaEsteAnio/Anio — así
  // regalia-pascual/page.tsx vuelve a mostrar RD$0 acumulado a partir de este
  // pago, acumulando de nuevo mes a mes hacia la próxima liquidación.
  function handleProcesarRegalia(empIds: string[]) {
    if (!periodoActual || periodoActual.tipo !== 'regalia') return
    const montos = periodoActual.montosRegalia ?? {}
    const resultados: Record<string, ResultadoNomina> = {}
    for (const id of empIds) {
      const emp = empleados.find(e => e.id === id)
      if (!emp) continue
      const monto = montos[id] ?? 0
      resultados[id] = resultadoRegalia(id, monto, getAnosServicio(emp.fechaIngreso))
      actualizarEmpleado(id, { regaliaPagadaEsteAnio: monto, regaliaPagadaAnio: periodoActual.anio })
    }
    if (Object.keys(resultados).length === 0) return
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    setToast(empIds.length === 1 ? 'Regalía procesada' : `${empIds.length} pago(s) de regalía procesados`)
  }

  // Procesa el pago de Bonificación por Utilidades de uno o varios empleados
  // dentro de un período tipo 'bonificacion': a diferencia de Regalía
  // Pascual, SÍ calcula AFP/SFS/ISR reales (resultadoBonificacion) y no hay
  // ningún acumulado en Empleado que reiniciar — la Bonificación no se
  // acumula mes a mes, se calcula una sola vez al año en /bonificacion.
  function handleProcesarBonificacion(empIds: string[]) {
    if (!periodoActual || periodoActual.tipo !== 'bonificacion') return
    const montos = periodoActual.montosBonificacion ?? {}
    const resultados: Record<string, ResultadoNomina> = {}
    for (const id of empIds) {
      const emp = empleados.find(e => e.id === id)
      if (!emp) continue
      const monto = montos[id] ?? 0
      resultados[id] = resultadoBonificacion(emp, monto)
    }
    if (Object.keys(resultados).length === 0) return
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    setToast(empIds.length === 1 ? 'Bonificación procesada' : `${empIds.length} pago(s) de bonificación procesados`)
  }

  // Export a Excel con TODO el detalle transaccional del período: una hoja
  // de resumen por empleado (mismos totales que ya se ven en la tabla) más
  // una segunda hoja con cada línea de ajuste individual (bonos, comisiones,
  // préstamos, descuentos) — no solo los totales agregados por empleado.
  // La librería de Excel (exceljs, ~250KB) se carga bajo demanda recién al
  // hacer clic, para no inflar el bundle inicial de esta página.
  async function handleExportar() {
    if (!periodoActual) return
    const { exportarExcel } = await import('@/lib/excel-export')

    if (periodoActual.tipo === 'regalia') {
      const montos = periodoActual.montosRegalia ?? {}
      const procesadosSet = new Set(periodoActual.empleadosProcesados ?? [])
      const filas = Object.entries(montos).map(([empId, monto]) => {
        const e = empleados.find(x => x.id === empId)
        return [
          e ? fullName(e) : empId, e?.cargo ?? '—', e?.departamento ?? '—',
          monto, procesadosSet.has(empId) ? 'Procesado' : 'Pendiente',
        ]
      })
      const totalMonto = Object.values(montos).reduce((s, m) => s + m, 0)
      await exportarExcel({
        nombreArchivo: `regalia-pascual-${periodoActual.anio}`,
        empresa: empresa.nombre,
        rnc: empresa.rnc,
        hojas: [{
          nombre: 'Regalía Pascual',
          titulo: `Regalía Pascual — ${periodoActualLabel}`,
          subtitulo: `${filas.length} empleado(s)`,
          encabezados: ['Empleado', 'Cargo', 'Departamento', 'Monto Regalía', 'Estado'],
          filas,
          totales: [`TOTAL — ${filas.length} empleado(s)`, '', '', totalMonto, ''],
          anchos: [26, 20, 18, 16, 14],
        }],
      })
      setToast('Regalía Pascual exportada a Excel')
      return
    }

    if (periodoActual.tipo === 'bonificacion') {
      const montos = periodoActual.montosBonificacion ?? {}
      const procesadosSet = new Set(periodoActual.empleadosProcesados ?? [])
      const filas = Object.entries(montos).map(([empId, monto]) => {
        const e = empleados.find(x => x.id === empId)
        const r = e ? resultadoBonificacion(e, monto) : null
        return [
          e ? fullName(e) : empId, e?.cargo ?? '—', e?.departamento ?? '—',
          monto, r?.afpEmpleado ?? 0, r?.sfsEmpleado ?? 0, r?.isrMensual ?? 0, r?.salarioNeto ?? monto,
          procesadosSet.has(empId) ? 'Procesado' : 'Pendiente',
        ]
      })
      const suma = (i: number) => filas.reduce((s, f) => s + (f[i] as number), 0)
      await exportarExcel({
        nombreArchivo: `bonificacion-utilidades-${periodoActual.anio}`,
        empresa: empresa.nombre,
        rnc: empresa.rnc,
        hojas: [{
          nombre: 'Bonificación Utilidades',
          titulo: `Bonificación por Utilidades — ${periodoActualLabel}`,
          subtitulo: `Art. 223 · ${filas.length} empleado(s) · con AFP/SFS/ISR`,
          encabezados: ['Empleado', 'Cargo', 'Departamento', 'Monto Bruto', 'AFP', 'SFS', 'ISR', 'Neto a Pagar', 'Estado'],
          filas,
          totales: [`TOTAL — ${filas.length} empleado(s)`, '', '', suma(3), suma(4), suma(5), suma(6), suma(7), ''],
          anchos: [26, 20, 18, 16, 14, 14, 14, 16, 14],
        }],
      })
      setToast('Bonificación por Utilidades exportada a Excel')
      return
    }

    const ajustesPorEmp = periodoActual.ajustesPorEmpleado ?? {}

    const resultados = empleadosPeriodo.map(e => {
      const ajustes = ajustesPorEmp[e.id] ?? []
      return { empleado: e, ajustes, r: resultadoDePeriodo(e, ajustes, periodoActual) }
    })

    const filasResumen = resultados.map(({ empleado: e, r }) => [
      fullName(e), e.cargo, e.departamento,
      r.totalBruto, r.afpEmpleado, r.sfsEmpleado, r.isrMensual, r.sfsDependientes,
      r.totalDescuentos, r.salarioNeto, r.afpEmpleador, r.sfsEmpleador,
      r.srlEmpleador, r.infotepEmpleador, r.totalCostoEmpleador,
    ])
    const suma = (f: (x: (typeof resultados)[number]) => number) => resultados.reduce((s, x) => s + f(x), 0)
    const totalesResumen = [
      `TOTAL — ${resultados.length} empleado(s)`, '', '',
      suma(x => x.r.totalBruto), suma(x => x.r.afpEmpleado), suma(x => x.r.sfsEmpleado),
      suma(x => x.r.isrMensual), suma(x => x.r.sfsDependientes), suma(x => x.r.totalDescuentos),
      suma(x => x.r.salarioNeto), suma(x => x.r.afpEmpleador), suma(x => x.r.sfsEmpleador),
      suma(x => x.r.srlEmpleador), suma(x => x.r.infotepEmpleador), suma(x => x.r.totalCostoEmpleador),
    ]

    const filasAjustes: (string | number)[][] = []
    for (const { empleado: e, ajustes } of resultados) {
      for (const a of ajustes) {
        filasAjustes.push([
          fullName(e), e.cargo,
          a.tipo === 'ingreso' ? 'Ingreso' : 'Descuento',
          labelAjuste(a),
          a.descripcion || '—',
          isHorasConcepto(a.concepto) ? `${a.valor} horas` : a.valor,
        ])
      }
    }

    const slug = periodoActualLabel.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    const estadoLabel = periodoActual.estado === 'cerrada' ? 'Cerrada'
      : periodoActual.estado === 'procesada' ? 'Procesada' : 'En proceso'

    await exportarExcel({
      nombreArchivo: `nomina-${slug}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [
        {
          nombre: 'Resumen por Empleado',
          titulo: `Nómina — ${periodoActualLabel}`,
          subtitulo: `${resultados.length} empleado(s) · Estado: ${estadoLabel}`,
          encabezados: ['Empleado', 'Cargo', 'Departamento', 'S. Bruto', 'AFP Empleado', 'SFS Empleado', 'ISR', 'SFS Dependientes', 'Total Descuentos', 'S. Neto', 'AFP Empleador', 'SFS Empleador', 'SRL Empleador', 'Infotep', 'Costo Total Empresa'],
          filas: filasResumen,
          totales: totalesResumen,
          anchos: [26, 20, 18, 14, 13, 13, 12, 16, 15, 14, 13, 13, 13, 12, 16],
        },
        ...(filasAjustes.length > 0 ? [{
          nombre: 'Detalle de Ajustes',
          titulo: `Ajustes del Período — ${periodoActualLabel}`,
          subtitulo: `${filasAjustes.length} ajuste(s) individuales`,
          encabezados: ['Empleado', 'Cargo', 'Tipo', 'Concepto', 'Descripción', 'Valor'],
          filas: filasAjustes,
          anchos: [26, 20, 12, 20, 32, 14],
        }] : []),
      ],
    })
    setToast('Nómina exportada a Excel')
  }

  function getAjustes(empleadoId: string): AjusteLinea[] {
    return (periodoActual?.ajustesPorEmpleado ?? {})[empleadoId] ?? []
  }

  function handleRemoveAjuste(empleadoId: string, ajusteId: string) {
    if (!periodoActual) return
    actualizarAjustes(periodoActual.id, empleadoId, getAjustes(empleadoId).filter(a => a.id !== ajusteId))
  }

  function handleAgregarAjuste(empleadoId: string) {
    if (!periodoActual || !newValor) return
    const valor = parseFloat(newValor)
    if (isNaN(valor) || valor <= 0) return
    const ajuste: AjusteLinea = {
      id:          Date.now().toString(36),
      tipo:        newTipo,
      concepto:    newConcepto,
      descripcion: newDesc,
      valor,
    }
    // Concepto del catálogo configurable — se guarda un snapshot del nombre y
    // los flags de ISR/TSS al momento de agregarlo, no una referencia viva
    // (ver AjusteLinea en types/index.ts).
    if (newConcepto === 'personalizado' && newConceptoPersId) {
      const cp = getConceptoPersonalizado(newConceptoPersId)
      if (cp) {
        ajuste.conceptoPersonalizadoId = cp.id
        ajuste.conceptoPersonalizadoNombre = cp.nombre
        ajuste.afectaISR = cp.tipo === 'ingreso' ? cp.afectaISR : false
        ajuste.afectaTSS = cp.tipo === 'ingreso' ? cp.afectaTSS : false
      }
    }
    actualizarAjustes(periodoActual.id, empleadoId, [...getAjustes(empleadoId), ajuste])
    setNewValor('')
    setNewDesc('')
    setExpandedEmpId(null)
  }

  function openAjusteForm(empId: string) {
    setExpandedEmpId(empId)
    setNewTipo('ingreso')
    setNewConcepto('bono')
    setNewConceptoPersId(null)
    setNewValor('')
    setNewDesc('')
  }

  // Congela el resultado final de un empleado al momento de procesarlo:
  // consume el crédito ISR más antiguo disponible (side effect sobre el
  // contexto de saldos) y devuelve el ResultadoNomina resultante — este
  // resultado es exactamente lo que se guarda como snapshot histórico
  // inmutable en PeriodoNomina.resultadosPorEmpleado (ver marcarProcesados),
  // así que a partir de aquí el número queda fijo para siempre, sin importar
  // qué cambie después en el Empleado.
  function congelarYCalcular(empId: string, ajustes: AjusteLinea[]): ResultadoNomina | null {
    if (!periodoActual) return null
    const emp = empleadosPeriodo.find(e => e.id === empId)
    if (!emp) return null
    const base = calcularParaPeriodo(emp, ajustes, periodoActual, disfrutes, licencias, aumentos)
    // Encadena TODOS los saldos activos del empleado (FIFO — el más antiguo
    // primero), no solo el primero: si el crédito más antiguo no alcanza a
    // cubrir el ISR de este período, el excedente se consume del siguiente
    // registro activo, y así sucesivamente, hasta cubrir el ISR o agotarlos.
    const saldosActivos = getSaldosActivos(emp.id)
    const totalDisponible = saldosActivos.reduce((s, x) => s + x.saldoPendiente, 0)
    const { resultado, montoAplicado } = aplicarSaldoISRFavor(base, totalDisponible, emp.grossingUpPct)
    let restante = montoAplicado
    for (const saldo of saldosActivos) {
      if (restante <= 0) break
      const montoDeEste = Math.min(restante, saldo.saldoPendiente)
      if (montoDeEste > 0) {
        aplicarSaldoISR(saldo.id, periodoActual.id, periodoActualLabel, montoDeEste)
        restante -= montoDeEste
      }
    }
    return resultado
  }

  // Reglas de manejo de insuficiencia de fondos: si el neto de un empleado no
  // alcanza para cubrir la(s) cuota(s) de préstamo/avance de este período, se
  // omiten esas cuotas en vez de dejar un neto negativo — es el único
  // descuento que se puede diferir sin implicar un problema de cumplimiento
  // legal (a diferencia de AFP/SFS/ISR, que son obligatorios). Si el neto
  // sigue negativo incluso sin las cuotas de préstamo, no se toca nada más
  // aquí — ese caso ya lo señala la auditoría pre-cierre existente. Devuelve
  // los ajustes FINALES a usar (para que el llamador no dependa del estado
  // de contexto, que todavía no se actualizó dentro de este mismo ciclo de
  // evento) y el nombre del empleado si se omitió alguna cuota.
  function manejarInsuficienciaFondos(empId: string): { ajustesFinales: AjusteLinea[]; omitido: string | null } {
    const ajustes = getAjustes(empId)
    if (!periodoActual) return { ajustesFinales: ajustes, omitido: null }
    const emp = empleadosPeriodo.find(e => e.id === empId)
    if (!emp) return { ajustesFinales: ajustes, omitido: null }
    const resultado = conSaldoISR(emp, calcularParaPeriodo(emp, ajustes, periodoActual, disfrutes, licencias, aumentos), periodoActual)
    if (resultado.salarioNeto >= 0) return { ajustesFinales: ajustes, omitido: null }

    const ajustesPrestamo = ajustes.filter(a => a.concepto === 'prestamo' && a.prestamoId)
    if (ajustesPrestamo.length === 0) return { ajustesFinales: ajustes, omitido: null }

    const ajustesSinPrestamo = ajustes.filter(a => !(a.concepto === 'prestamo' && a.prestamoId))
    const resultadoSinPrestamo = conSaldoISR(emp, calcularParaPeriodo(emp, ajustesSinPrestamo, periodoActual, disfrutes, licencias, aumentos), periodoActual)
    if (resultadoSinPrestamo.salarioNeto < 0) return { ajustesFinales: ajustes, omitido: null } // no es solo el préstamo — se deja para la auditoría

    actualizarAjustes(periodoActual.id, empId, ajustesSinPrestamo)
    ajustesPrestamo.forEach(a => { if (a.prestamoId) registrarOmisionCuota(a.prestamoId) })
    return { ajustesFinales: ajustesSinPrestamo, omitido: fullName(emp) }
  }

  function handleProcesarEmpleado(empId: string) {
    if (!periodoActual) return
    const procesadosActuales = new Set(periodoActual.empleadosProcesados ?? [])
    const pendientes = empleadosPeriodo.filter(e => !procesadosActuales.has(e.id))
    if (pendientes.length > 0 && pendientes.every(e => e.id === empId)) {
      setAuditoriaIds([empId])
      return
    }
    const { ajustesFinales, omitido } = manejarInsuficienciaFondos(empId)
    const resultado = congelarYCalcular(empId, ajustesFinales)
    if (resultado) marcarProcesados(periodoActual.id, { [empId]: resultado })
    setSelectedEmps(prev => { const s = new Set(prev); s.delete(empId); return s })
    setToast(omitido ? `Cuota de préstamo omitida para ${omitido} — el neto no alcanzaba` : 'Empleado procesado')
  }

  function confirmarAuditoria() {
    if (!periodoActual || !auditoriaIds) return
    const resultados: Record<string, ResultadoNomina> = {}
    const omitidos: string[] = []
    for (const id of auditoriaIds) {
      const { ajustesFinales, omitido } = manejarInsuficienciaFondos(id)
      if (omitido) omitidos.push(omitido)
      const r = congelarYCalcular(id, ajustesFinales)
      if (r) resultados[id] = r
    }
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    setToast(omitidos.length > 0
      ? `Todos los empleados procesados — cuota de préstamo omitida para: ${omitidos.join(', ')}`
      : 'Todos los empleados procesados')
    setAuditoriaIds(null)
  }

  function handleProcesarSeleccionados() {
    if (!periodoActual) return
    const ids = selectedEmps.size > 0
      ? [...selectedEmps]
      : empleadosPeriodo.map(e => e.id)
    // Si esta acción completaría el período (pasaría de en_proceso a
    // procesada), se intercepta con la auditoría pre-cierre en vez de
    // procesar directamente.
    const procesadosActuales = new Set(periodoActual.empleadosProcesados ?? [])
    const pendientes = empleadosPeriodo.filter(e => !procesadosActuales.has(e.id))
    if (pendientes.length > 0 && pendientes.every(e => ids.includes(e.id))) {
      setAuditoriaIds(ids)
      return
    }
    const resultados: Record<string, ResultadoNomina> = {}
    const omitidos: string[] = []
    for (const id of ids) {
      const { ajustesFinales, omitido } = manejarInsuficienciaFondos(id)
      if (omitido) omitidos.push(omitido)
      const r = congelarYCalcular(id, ajustesFinales)
      if (r) resultados[id] = r
    }
    marcarProcesados(periodoActual.id, resultados)
    setSelectedEmps(new Set())
    if (omitidos.length > 0) {
      setToast(`Cuota de préstamo omitida para: ${omitidos.join(', ')}`)
    } else {
      setToast(selectedEmps.size > 0 ? `${ids.length} empleado(s) procesado(s)` : 'Todos los empleados procesados')
    }
  }

  function toggleSeleccionEmp(empId: string) {
    setSelectedEmps(prev => {
      const s = new Set(prev)
      if (s.has(empId)) s.delete(empId); else s.add(empId)
      return s
    })
  }

  function toggleSeleccionTodos() {
    const noProcessados = empleadosPeriodo
      .filter(e => !(periodoActual?.empleadosProcesados ?? []).includes(e.id))
      .map(e => e.id)
    if (selectedEmps.size === noProcessados.length && noProcessados.length > 0) {
      setSelectedEmps(new Set())
    } else {
      setSelectedEmps(new Set(noProcessados))
    }
  }

  function seleccionarPorCriterio() {
    const noProcessados = empleadosPeriodo.filter(e => !(periodoActual?.empleadosProcesados ?? []).includes(e.id))
    const coincidencias = noProcessados.filter(e => {
      if (filtroDepto !== 'todos' && e.departamento !== filtroDepto) return false
      if (filtroIngresoDesde && e.fechaIngreso < filtroIngresoDesde) return false
      if (filtroIngresoHasta && e.fechaIngreso > filtroIngresoHasta) return false
      return true
    })
    setSelectedEmps(new Set(coincidencias.map(e => e.id)))
  }

  // 10 años atrás hasta 1 año adelante del año calendario real (no del año
  // seleccionado en el form — anclarlo a `nuevoAnio` movería el rango cada
  // vez que se elige un año distinto). Permite registrar retroactivamente
  // un período de una empresa con historial previo a Cielo Cloud, sin
  // limitarse a "año actual ± 1".
  const anios = Array.from({ length: 12 }, (_, i) => hoy.getFullYear() - 10 + i)
  const conceptosIngreso: ConceptoAjuste[]   = ['horas_extras_35', 'horas_extras_100', 'recargo_nocturno', 'comision', 'bono', 'otro_ingreso']
  const conceptosDeduccion: ConceptoAjuste[] = ['prestamo', 'dependiente_sfs', 'otro_descuento']

  // ── VISTA: LISTA ─────────────────────────────────────────────────────────────
  if (!periodoAbierto) {
    const periodosFiltrados = periodos
      .filter(p => filtroEstadoPeriodo === 'todos' || p.estado === filtroEstadoPeriodo)
      .filter(p => filtroAnioPeriodo === 'todos' || p.anio === filtroAnioPeriodo)
      .filter(p => !busquedaPeriodo.trim() || labelPeriodo(p).toLowerCase().includes(busquedaPeriodo.trim().toLowerCase()))
      .sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime())
    const aniosPeriodos = Array.from(new Set(periodos.map(p => p.anio))).sort((a, b) => b - a)
    const hayFiltrosPeriodo = busquedaPeriodo.trim() !== '' || filtroEstadoPeriodo !== 'todos' || filtroAnioPeriodo !== 'todos'

    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header title="Cálculo de Nómina" subtitle="Calcula los devengados y deducciones de tu equipo de trabajo" />

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

          {/* Selección de período a calcular */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Frecuencia</label>
                <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                  {(['mensual', 'quincenal'] as TipoPeriodo[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setNuevoTipo(t)}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        nuevoTipo === t
                          ? 'bg-[#1B2980] text-white'
                          : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                      }`}
                    >
                      {t === 'mensual' ? 'Mensual' : 'Quincenal'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Mes</label>
                <select
                  value={nuevoMes}
                  onChange={e => setNuevoMes(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                >
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Año</label>
                <select
                  value={nuevoAnio}
                  onChange={e => setNuevoAnio(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                >
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {nuevoTipo === 'quincenal' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Quincena</label>
                  <select
                    value={nuevaQuincena}
                    onChange={e => setNuevaQuincena(Number(e.target.value) as 1 | 2)}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                  >
                    <option value={1}>1ª Quincena (1–15)</option>
                    <option value={2}>2ª Quincena (16–fin)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pb-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Empleados</span>
                <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {empleadosEnNomina.length}
                </span>
              </div>

              <button
                onClick={handleCrearPeriodo}
                disabled={empleadosEnNomina.length === 0}
                className={cn(BTN_PRIMARY, 'ml-auto self-end disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none')}
              >
                <Plus className="h-4 w-4" />
                Calcular Período
              </button>
            </div>
            {empleadosEnNomina.length === 0 && (
              <p className="mt-2.5 text-xs text-amber-600 dark:text-amber-400">
                Debes registrar al menos un empleado activo para crear un período de nómina.
              </p>
            )}
          </div>

          {/* Historial de períodos */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] px-5 py-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={busquedaPeriodo}
                  onChange={e => setBusquedaPeriodo(e.target.value)}
                  placeholder="Buscar período…"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
                />
              </div>
              <select
                value={filtroEstadoPeriodo}
                onChange={e => setFiltroEstadoPeriodo(e.target.value as 'todos' | EstadoPeriodo)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="en_proceso">En Proceso</option>
                <option value="procesada">Procesada</option>
                <option value="cerrada">Cerrada</option>
              </select>
              <select
                value={filtroAnioPeriodo}
                onChange={e => setFiltroAnioPeriodo(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              >
                <option value="todos">Todos los años</option>
                {aniosPeriodos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {hayFiltrosPeriodo && (
                <button
                  onClick={() => { setBusquedaPeriodo(''); setFiltroEstadoPeriodo('todos'); setFiltroAnioPeriodo('todos') }}
                  className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
                >
                  Ver todos
                </button>
              )}
              <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                {periodosFiltrados.length} de {periodos.length} período(s)
              </span>
            </div>

            {periodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin períodos de nómina</p>
                <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                  Crea tu primer período usando el panel de arriba para comenzar a procesar pagos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período de Nómina</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Bruto</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Neto</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                    {periodosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                          Ningún período coincide con el filtro.
                        </td>
                      </tr>
                    )}
                    {periodosFiltrados.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => setPeriodoAbierto(p.id)}
                        className="cursor-pointer hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-[#1B2980] dark:text-indigo-400">{labelPeriodo(p)}</p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                {p.totalEmpleados} empleado{p.totalEmpleados !== 1 ? 's' : ''}
                                {p.pagada && ` · Pagada el ${formatDate(p.fechaPago!)}`}
                              </p>
                            </div>
                            {(p.bitacoraDesposteos?.length ?? 0) > 0 && (
                              <span
                                title={p.bitacoraDesposteos!.map(b =>
                                  `Reabierto el ${formatDate(b.fecha.slice(0, 10))} por ${b.usuarioEmail} (estaba ${b.estadoAnterior})`
                                ).join('\n')}
                              >
                                <History className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{fmt(p.totales.bruto)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#151f66] dark:text-indigo-300">{fmt(p.totales.neto)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmt(p.totales.costoTotal)}</td>
                        <td className="px-4 py-3.5">
                          {p.estado === 'cerrada' ? (
                            <Badge variant="neutral"><Lock className="mr-1 h-3 w-3" />Cerrada</Badge>
                          ) : p.estado === 'procesada' ? (
                            <Badge variant="success">Procesada</Badge>
                          ) : (
                            <Badge variant="warning">En Proceso</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={e => { e.stopPropagation(); setPeriodoAbierto(p.id) }}
                              title="Ver período"
                              className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {p.estado === 'procesada' && (
                              <button
                                onClick={e => { e.stopPropagation(); cerrar(p.id) }}
                                title="Cerrar período"
                                className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                              >
                                <Lock className="h-4 w-4" />
                              </button>
                            )}
                            {p.estado !== 'en_proceso' && esPeriodoMasReciente(p, periodos) && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  if (!confirm(
                                    `¿Reabrir "${labelPeriodo(p)}"? Los empleados procesados volverán a marcarse como pendientes y deberás reprocesarlos. Esta acción queda registrada con tu usuario y fecha.`
                                  )) return
                                  const ok = reabrir(p.id, user?.email ?? 'desconocido')
                                  setToast(ok ? 'Período reabierto — vuelve a En Proceso' : 'No se pudo reabrir el período')
                                }}
                                title="Reabrir período (desposteo)"
                                className="rounded-lg border border-amber-200 dark:border-amber-800/50 p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                              >
                                <Unlock className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                if (!confirm(`¿Eliminar el período "${labelPeriodo(p)}"?`)) return
                                eliminar(p.id)
                              }}
                              title="Eliminar período"
                              className="rounded-lg border border-rose-200 dark:border-rose-800/50 p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ── VISTA: DETALLE ────────────────────────────────────────────────────────────
  if (!periodoActual) {
    return null
  }

  // ── VISTA: DETALLE — Regalía Pascual (tipo 'regalia') ──────────────────────
  // Vista independiente y deliberadamente más simple que la nómina normal: no
  // hay ajustes editables, préstamos, filtros ni auditoría pre-cierre — cada
  // empleado tiene un monto ya congelado (montosRegalia) al momento de
  // "Solicitar Liquidación" en el módulo Regalía Pascual.
  if (periodoActual.tipo === 'regalia') {
    const montos = periodoActual.montosRegalia ?? {}
    const motivosAjuste = periodoActual.motivosAjusteRegalia ?? {}
    const procesadosReg = new Set(periodoActual.empleadosProcesados ?? [])
    const filasRegalia = Object.entries(montos)
      .map(([empId, monto]) => ({ empleado: empleados.find(e => e.id === empId), empId, monto }))
      .filter((f): f is { empleado: Empleado; empId: string; monto: number } => !!f.empleado)
      .sort((a, b) => fullName(a.empleado).localeCompare(fullName(b.empleado)))
    const totalRegalia = filasRegalia.reduce((s, f) => s + f.monto, 0)
    const pendientesReg = filasRegalia.filter(f => !procesadosReg.has(f.empId))
    const esEnProcesoReg = periodoActual.estado === 'en_proceso'
    const esProcesadaReg = periodoActual.estado === 'procesada'

    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header
          title={periodoActualLabel}
          subtitle={esEnProcesoReg ? 'En proceso' : esProcesadaReg ? 'Período procesado' : 'Período cerrado'}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriodoAbierto(null)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Períodos
              </button>
              {esEnProcesoReg && pendientesReg.length > 0 && (
                <button
                  onClick={() => {
                    if (!confirm(`¿Procesar el pago de Regalía Pascual de ${pendientesReg.length} empleado(s)? El acumulado de cada uno vuelve a cero para el resto del año.`)) return
                    handleProcesarRegalia(pendientesReg.map(f => f.empId))
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
                >
                  <PlayCircle className="h-4 w-4" />
                  Procesar Todo
                </button>
              )}
              {esProcesadaReg && (
                <button
                  onClick={handleCerrarPeriodo}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  Cerrar
                </button>
              )}
              <button
                onClick={handleExportar}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <StatCard
              label="Total a Pagar"
              value={formatRD(totalRegalia)}
              sub="Suma de acumulados liquidados"
              icon={Gift}
              iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
            />
            <StatCard
              label="Empleados"
              value={String(filasRegalia.length)}
              sub="Incluidos en esta liquidación"
              icon={BarChart3}
              iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            />
            <StatCard
              label={esEnProcesoReg ? 'Pendientes de Pago' : 'Estado'}
              value={esEnProcesoReg ? String(pendientesReg.length) : (esProcesadaReg ? 'Procesado' : 'Cerrado')}
              sub={esEnProcesoReg ? `de ${filasRegalia.length} empleado(s)` : 'Todos los pagos registrados'}
              icon={CheckCircle2}
              iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            />
          </div>

          <div className="rounded-lg border border-[#1B2980]/15 bg-[#eef0fb] dark:bg-indigo-950/20 dark:border-indigo-800/30 px-4 py-3 text-xs text-[#1B2980] dark:text-indigo-300">
            Pago bruto de Regalía Pascual (Art. 219, Código de Trabajo) — no es salario cotizable, por lo
            que no lleva descuentos de AFP, SFS ni retención de ISR, igual que el tratamiento ya vigente
            para Vacaciones y Regalía dentro de Liquidación.
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Detalle por Empleado — {periodoActualLabel}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto Regalía</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filasRegalia.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        Este período no tiene empleados con monto de regalía asociado.
                      </td>
                    </tr>
                  )}
                  {filasRegalia.map(({ empleado, empId, monto }) => {
                    const isProcesado = procesadosReg.has(empId)
                    const resultado = resultadoRegalia(empId, monto, getAnosServicio(empleado.fechaIngreso))
                    const motivo = motivosAjuste[empId]
                    return (
                      <tr
                        key={empId}
                        onClick={() => setDetalleModal({ emp: empleado, nom: resultado })}
                        className={`cursor-pointer border-b border-zinc-200 dark:border-[#252840] transition-colors ${
                          isProcesado ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : 'hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isProcesado
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[#eef0fb] dark:bg-indigo-900/40 text-[#1B2980] dark:text-indigo-300'
                            }`}>
                              {empleado.nombre[0]}{empleado.apellido[0]}
                            </div>
                            <div>
                              <p className="font-medium text-[#1B2980] dark:text-indigo-400 leading-tight">{fullName(empleado)}</p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
                                {empleado.cedula} · {empleado.cargo}
                                {motivo && <span title={motivo} className="ml-1.5 text-amber-500 dark:text-amber-400">· ajustado manualmente</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                          {formatRD(monto)}
                        </td>
                        <td className="px-4 py-3.5">
                          {isProcesado
                            ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Procesado</Badge>
                            : <Badge variant="warning">Pendiente</Badge>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {esEnProcesoReg && !isProcesado && (
                            <button
                              onClick={e => { e.stopPropagation(); handleProcesarRegalia([empId]) }}
                              className="rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                            >
                              Procesar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        {detalleModal && (
          <>
            <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
            <DetalleNomina
              empleado={detalleModal.emp}
              nomina={detalleModal.nom}
              periodoLabel={periodoActualLabel}
              mostrarUSD={mostrarUSD}
              onClose={() => setDetalleModal(null)}
            />
          </>
        )}
      </div>
    )
  }

  // ── VISTA: DETALLE — Bonificación por Utilidades (tipo 'bonificacion') ─────
  // Vista independiente y deliberadamente más simple que la nómina normal —
  // igual que Regalía Pascual: no hay ajustes editables, préstamos, filtros
  // ni auditoría pre-cierre, cada empleado tiene un monto bruto ya congelado
  // (montosBonificacion) desde "Solicitar Liquidación" en /bonificacion. A
  // diferencia de Regalía, SÍ lleva AFP/SFS/ISR reales (Art. 223 es salario
  // ordinario a efectos fiscales) — por eso la tabla muestra Bruto y Neto
  // por separado, y cada fila abre el mismo modal DetalleNomina con el
  // desglose completo de descuentos, en vez de un monto plano.
  if (periodoActual.tipo === 'bonificacion') {
    const montos = periodoActual.montosBonificacion ?? {}
    const motivosAjuste = periodoActual.motivosAjusteBonificacion ?? {}
    const procesadosBon = new Set(periodoActual.empleadosProcesados ?? [])
    const filasBonificacion = Object.entries(montos)
      .map(([empId, monto]) => ({ empleado: empleados.find(e => e.id === empId), empId, monto }))
      .filter((f): f is { empleado: Empleado; empId: string; monto: number } => !!f.empleado)
      .sort((a, b) => fullName(a.empleado).localeCompare(fullName(b.empleado)))
    const totalBrutoBon = filasBonificacion.reduce((s, f) => s + f.monto, 0)
    const pendientesBon = filasBonificacion.filter(f => !procesadosBon.has(f.empId))
    const esEnProcesoBon = periodoActual.estado === 'en_proceso'
    const esProcesadaBon = periodoActual.estado === 'procesada'

    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header
          title={periodoActualLabel}
          subtitle={esEnProcesoBon ? 'En proceso' : esProcesadaBon ? 'Período procesado' : 'Período cerrado'}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriodoAbierto(null)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Períodos
              </button>
              {esEnProcesoBon && pendientesBon.length > 0 && (
                <button
                  onClick={() => {
                    if (!confirm(`¿Procesar el pago de Bonificación por Utilidades de ${pendientesBon.length} empleado(s)?`)) return
                    handleProcesarBonificacion(pendientesBon.map(f => f.empId))
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
                >
                  <PlayCircle className="h-4 w-4" />
                  Procesar Todo
                </button>
              )}
              {esProcesadaBon && (
                <button
                  onClick={handleCerrarPeriodo}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  Cerrar
                </button>
              )}
              <button
                onClick={handleExportar}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <StatCard
              label="Total Bruto a Pagar"
              value={formatRD(totalBrutoBon)}
              sub="Antes de AFP/SFS/ISR"
              icon={Percent}
              iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
            />
            <StatCard
              label="Empleados"
              value={String(filasBonificacion.length)}
              sub="Incluidos en esta liquidación"
              icon={BarChart3}
              iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            />
            <StatCard
              label={esEnProcesoBon ? 'Pendientes de Pago' : 'Estado'}
              value={esEnProcesoBon ? String(pendientesBon.length) : (esProcesadaBon ? 'Procesado' : 'Cerrado')}
              sub={esEnProcesoBon ? `de ${filasBonificacion.length} empleado(s)` : 'Todos los pagos registrados'}
              icon={CheckCircle2}
              iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            />
          </div>

          <div className="rounded-lg border border-[#1B2980]/15 bg-[#eef0fb] dark:bg-indigo-950/20 dark:border-indigo-800/30 px-4 py-3 text-xs text-[#1B2980] dark:text-indigo-300">
            Bonificación por Participación en Utilidades (Art. 223, Código de Trabajo) — a diferencia de la
            Regalía Pascual, SÍ es salario ordinario a efectos fiscales: lleva AFP, SFS e ISR normales,
            calculados sobre el monto bruto como si fuera el salario del mes.
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Detalle por Empleado — {periodoActualLabel}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto Bruto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Neto a Pagar</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filasBonificacion.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        Este período no tiene empleados con monto de bonificación asociado.
                      </td>
                    </tr>
                  )}
                  {filasBonificacion.map(({ empleado, empId, monto }) => {
                    const isProcesado = procesadosBon.has(empId)
                    const resultado = resultadoBonificacion(empleado, monto)
                    const motivo = motivosAjuste[empId]
                    return (
                      <tr
                        key={empId}
                        onClick={() => setDetalleModal({ emp: empleado, nom: resultado })}
                        className={`cursor-pointer border-b border-zinc-200 dark:border-[#252840] transition-colors ${
                          isProcesado ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : 'hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isProcesado
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[#eef0fb] dark:bg-indigo-900/40 text-[#1B2980] dark:text-indigo-300'
                            }`}>
                              {empleado.nombre[0]}{empleado.apellido[0]}
                            </div>
                            <div>
                              <p className="font-medium text-[#1B2980] dark:text-indigo-400 leading-tight">{fullName(empleado)}</p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
                                {empleado.cedula} · {empleado.cargo}
                                {motivo && <span title={motivo} className="ml-1.5 text-amber-500 dark:text-amber-400">· ajustado manualmente</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatRD(monto)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                          {formatRD(resultado.salarioNeto)}
                        </td>
                        <td className="px-4 py-3.5">
                          {isProcesado
                            ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Procesado</Badge>
                            : <Badge variant="warning">Pendiente</Badge>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {esEnProcesoBon && !isProcesado && (
                            <button
                              onClick={e => { e.stopPropagation(); handleProcesarBonificacion([empId]) }}
                              className="rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                            >
                              Procesar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        {detalleModal && (
          <>
            <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
            <DetalleNomina
              empleado={detalleModal.emp}
              nomina={detalleModal.nom}
              periodoLabel={periodoActualLabel}
              mostrarUSD={mostrarUSD}
              onClose={() => setDetalleModal(null)}
            />
          </>
        )}
      </div>
    )
  }

  const ajustesPorEmp  = periodoActual.ajustesPorEmpleado ?? {}
  const quincenaActual: 1 | 2 = periodoActual.quincena ?? 1
  const esEnProceso    = periodoActual.estado === 'en_proceso'
  const esProcesada    = periodoActual.estado === 'procesada'
  const procesados     = new Set(periodoActual.empleadosProcesados ?? [])
  const noProcessados  = empleadosPeriodo.filter(e => !procesados.has(e.id))
  const todosSeleccionados = noProcessados.length > 0 && noProcessados.every(e => selectedEmps.has(e.id))

  const nominas = empleadosPeriodo.map(e => ({
    empleado: e,
    resultado: resultadoDePeriodo(e, ajustesPorEmp[e.id] ?? [], periodoActual),
  }))

  // Búsqueda/filtro de la tabla — no afecta los totales del período (esos
  // siguen siendo el total real a pagar), solo qué filas se muestran.
  const departamentosPeriodo = Array.from(new Set(empleadosPeriodo.map(e => e.departamento))).sort()
  const qEmpleado = busquedaEmpleado.trim().toLowerCase()
  const nominasVisibles = nominas.filter(({ empleado }) => {
    if (filtroDeptoTabla !== 'todos' && empleado.departamento !== filtroDeptoTabla) return false
    if (!qEmpleado) return true
    return fullName(empleado).toLowerCase().includes(qEmpleado) || empleado.cedula.toLowerCase().includes(qEmpleado)
  })
  const hayFiltrosTabla = busquedaEmpleado.trim() !== '' || filtroDeptoTabla !== 'todos'

  const totales = {
    bruto:      nominas.reduce((s, n) => s + n.resultado.totalBruto, 0),
    descuentos: nominas.reduce((s, n) => s + n.resultado.totalDescuentos, 0),
    neto:       nominas.reduce((s, n) => s + n.resultado.salarioNeto, 0),
    aportes:    nominas.reduce((s, n) => s + n.resultado.totalAportesEmpleador, 0),
    isr:        nominas.reduce((s, n) => s + n.resultado.isrMensual, 0),
    costoTotal: nominas.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  // Totales del pie de tabla — siguen el subconjunto filtrado (mismo criterio
  // ya usado en Regalía Pascual/Bonificación); las StatCards de arriba, en
  // cambio, siempre muestran el total real del período completo.
  const totalesVisibles = {
    bruto:      nominasVisibles.reduce((s, n) => s + n.resultado.totalBruto, 0),
    afpSfs:     nominasVisibles.reduce((s, n) => s + n.resultado.afpEmpleado + n.resultado.sfsEmpleado, 0),
    isr:        nominasVisibles.reduce((s, n) => s + n.resultado.isrMensual, 0),
    neto:       nominasVisibles.reduce((s, n) => s + n.resultado.salarioNeto, 0),
    costoTotal: nominasVisibles.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title={periodoActualLabel}
        subtitle={esEnProceso ? 'En proceso' : esProcesada ? 'Período procesado' : 'Período cerrado'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPeriodoAbierto(null); setSelectedEmps(new Set()) }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Períodos
            </button>
            {esEnProceso && (
              <button
                onClick={handleProcesarSeleccionados}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                {selectedEmps.size > 0 ? `Procesar (${selectedEmps.size})` : 'Procesar Todo'}
              </button>
            )}
            {esProcesada && (
              <button
                onClick={handleCerrarPeriodo}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <Lock className="h-4 w-4" />
                Cerrar
              </button>
            )}
            {esEnProceso && (
              <button
                onClick={() => setImportarHorasAbierto(true)}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                title="Cargar horas extra/recargo nocturno masivamente desde un archivo Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Importar Horas
              </button>
            )}
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
            {empresa.tasaCambioUSD && (
              <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]" title="Solo cambia lo que se muestra en pantalla — el PDF, el CSV y el correo siguen en RD$">
                {(['RD$', 'USD'] as const).map(moneda => (
                  <button
                    key={moneda}
                    onClick={() => setMostrarUSD(moneda === 'USD')}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      (moneda === 'USD') === mostrarUSD
                        ? 'bg-[#1B2980] text-white'
                        : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                    }`}
                  >
                    {moneda}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Bruto"
            value={fmt(totales.bruto)}
            sub="Suma devengados"
            icon={Wallet}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Total Neto"
            value={fmt(totales.neto)}
            sub="A transferir empleados"
            icon={BarChart3}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Aportes TSS Empresa"
            value={fmt(totales.aportes)}
            sub="AFP + SFS + SRL + Infotep"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="ISR Retenido"
            value={fmt(totales.isr)}
            sub={periodoActual.tipo === 'quincenal' && quincenaActual === 1 ? 'Anticipo — sin ISR' : 'Por remitir a DGII'}
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          />
        </div>

        {/* Employee table */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle por Empleado — {periodoActualLabel}
            </h2>
            <div className="flex items-center gap-3">
              {esEnProceso && (
                <button
                  onClick={() => setMostrarFiltros(v => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    mostrarFiltros
                      ? 'border-[#1B2980]/30 bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50'
                      : 'border-zinc-200 dark:border-[#252840] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Info className="h-3.5 w-3.5" />
                {esEnProceso
                  ? `${procesados.size}/${empleadosPeriodo.length} empleados procesados`
                  : esProcesada
                    ? 'Período procesado — solo lectura'
                    : 'Período cerrado — solo lectura'}
              </div>
            </div>
          </div>
          {esEnProceso && mostrarFiltros && (
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Departamento</label>
                <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none">
                  <option value="todos">Todos</option>
                  {Array.from(new Set(empleadosPeriodo.map(e => e.departamento))).sort().map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ingreso Desde</label>
                <input type="date" value={filtroIngresoDesde} onChange={e => setFiltroIngresoDesde(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ingreso Hasta</label>
                <input type="date" value={filtroIngresoHasta} onChange={e => setFiltroIngresoHasta(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none" />
              </div>
              <button
                onClick={seleccionarPorCriterio}
                className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Seleccionar Coincidencias
              </button>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 basis-full">
                Reemplaza la selección actual por los empleados pendientes que coincidan con estos criterios.
                No existe un campo de "fecha de último cambio salarial" en el sistema hoy, por eso no se ofrece ese filtro.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={busquedaEmpleado}
                onChange={e => setBusquedaEmpleado(e.target.value)}
                placeholder="Buscar por nombre o cédula…"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              />
            </div>
            <select
              value={filtroDeptoTabla}
              onChange={e => setFiltroDeptoTabla(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
            >
              <option value="todos">Todos los departamentos</option>
              {departamentosPeriodo.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {hayFiltrosTabla && (
              <button
                onClick={() => { setBusquedaEmpleado(''); setFiltroDeptoTabla('todos') }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Ver todos
              </button>
            )}
            <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
              {nominasVisibles.length} de {nominas.length} empleado(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {esEnProceso && (
                    <th className="pl-4 pr-2 py-3 w-8">
                      <button
                        onClick={toggleSeleccionTodos}
                        className="text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 transition-colors"
                        title={todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar pendientes'}
                      >
                        {todosSeleccionados
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                  )}
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ajustes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AFP+SFS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ISR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dep. SFS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Emp.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {nominasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={esEnProceso ? 10 : 9} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      Ningún empleado coincide con el filtro.
                    </td>
                  </tr>
                )}
                {nominasVisibles.map(({ empleado, resultado }) => {
                  const ajustes      = ajustesPorEmp[empleado.id] ?? []
                  const isExpanded   = expandedEmpId === empleado.id
                  const isProcesado  = procesados.has(empleado.id)
                  const isSelected   = selectedEmps.has(empleado.id)
                  const colSpanTotal = esEnProceso ? 10 : 9

                  return (
                    <Fragment key={empleado.id}>
                      <tr
                        onClick={() => setDetalleModal({ emp: empleado, nom: resultado })}
                        className={`cursor-pointer border-b border-zinc-200 dark:border-[#252840] transition-colors ${
                          isProcesado
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                            : 'hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20'
                        }`}
                      >
                        {/* Checkbox column */}
                        {esEnProceso && (
                          <td className="pl-4 pr-2 py-3.5 w-8">
                            {isProcesado ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSeleccionEmp(empleado.id) }}
                                className="text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 transition-colors"
                              >
                                {isSelected
                                  ? <CheckSquare className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                                  : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                        )}

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isProcesado
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[#eef0fb] dark:bg-indigo-900/40 text-[#1B2980] dark:text-indigo-300'
                            }`}>
                              {empleado.nombre[0]}{empleado.apellido[0]}
                            </div>
                            <div>
                              <p className="font-medium text-[#1B2980] dark:text-indigo-400 leading-tight">{fullName(empleado)}</p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">{empleado.cedula} · {empleado.cargo}</p>
                            </div>
                          </div>
                        </td>

                        {/* Ajustes chips */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            {ajustes.map(a => (
                              <span
                                key={a.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                  a.tipo === 'ingreso'
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50'
                                    : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/50'
                                }`}
                              >
                                {labelAjuste(a)}{' '}
                                {isHorasConcepto(a.concepto) ? `${a.valor}h` : fmt(a.valor)}
                                {esEnProceso && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveAjuste(empleado.id, a.id) }}
                                    className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                                    title="Eliminar ajuste"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {esEnProceso && (
                              <button
                                onClick={(e) => { e.stopPropagation(); isExpanded ? setExpandedEmpId(null) : openAjusteForm(empleado.id) }}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-zinc-100 dark:bg-[#252840] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#2d3152] transition-colors"
                                title="Agregar ajuste"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {fmt(resultado.totalBruto)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {fmt(resultado.afpEmpleado + resultado.sfsEmpleado)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.isrMensual === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : fmt(resultado.isrMensual)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {resultado.sfsDependientes === 0
                            ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            : fmt(resultado.sfsDependientes)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                          {fmt(resultado.salarioNeto)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {fmt(resultado.totalCostoEmpleador)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {esEnProceso && !isProcesado && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleProcesarEmpleado(empleado.id) }}
                                className="rounded-md border border-emerald-300 dark:border-emerald-700/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                title="Procesar este empleado"
                              >
                                Procesar
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setDetalleModal({ emp: empleado, nom: resultado }) }}
                              className="rounded-lg p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                              title="Ver comprobante"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline ajuste form */}
                      {isExpanded && (
                        <tr
                          className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]"
                        >
                          <td colSpan={colSpanTotal} className="px-5 py-4">
                            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                                Agregar ajuste — {fullName(empleado)}
                              </p>
                              <div className="flex flex-wrap items-end gap-3">

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo</label>
                                  <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                                    <button
                                      onClick={() => { setNewTipo('ingreso'); setNewConcepto('bono'); setNewConceptoPersId(null) }}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${newTipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Ingreso
                                    </button>
                                    <button
                                      onClick={() => { setNewTipo('deduccion'); setNewConcepto('prestamo'); setNewConceptoPersId(null) }}
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${newTipo === 'deduccion' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'}`}
                                    >
                                      Deducción
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Concepto</label>
                                  <select
                                    value={newConcepto === 'personalizado' ? `custom:${newConceptoPersId}` : newConcepto}
                                    onChange={e => {
                                      const v = e.target.value
                                      if (v.startsWith('custom:')) {
                                        setNewConcepto('personalizado')
                                        setNewConceptoPersId(v.slice(7))
                                      } else {
                                        setNewConcepto(v as ConceptoAjuste)
                                        setNewConceptoPersId(null)
                                      }
                                    }}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  >
                                    {(newTipo === 'ingreso' ? conceptosIngreso : conceptosDeduccion).map(c => (
                                      <option key={c} value={c}>{labelConcepto(c)}</option>
                                    ))}
                                    {conceptosPersonalizados.filter(cp => cp.tipo === newTipo).length > 0 && (
                                      <optgroup label="Catálogo de la empresa">
                                        {conceptosPersonalizados.filter(cp => cp.tipo === newTipo).map(cp => (
                                          <option key={cp.id} value={`custom:${cp.id}`}>{cp.nombre}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {isHorasConcepto(newConcepto) ? 'Horas' : 'Monto RD$'}
                                  </label>
                                  <input
                                    type="number"
                                    value={newValor}
                                    onChange={e => setNewValor(e.target.value)}
                                    placeholder={isHorasConcepto(newConcepto) ? '0' : '0.00'}
                                    min="0"
                                    step={isHorasConcepto(newConcepto) ? '1' : '0.01'}
                                    className="w-32 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Descripción (opcional)</label>
                                  <input
                                    type="text"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Nota o referencia"
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
                                  />
                                </div>

                                <div className="flex gap-2 self-end">
                                  <button
                                    onClick={() => handleAgregarAjuste(empleado.id)}
                                    disabled={!newValor || parseFloat(newValor) <= 0}
                                    className="rounded-lg bg-[#1B2980] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Agregar
                                  </button>
                                  <button
                                    onClick={() => setExpandedEmpId(null)}
                                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                              {newTipo === 'deduccion' && newConcepto === 'otro_descuento' && (
                                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                  Si es un descuento por ausencia/inasistencia, no lo cargues aquí —
                                  reduce los "Días Trabajados" del empleado al crear el período. Un
                                  descuento por ausencia registrado como "Otro Desc." se resta del
                                  neto después de calcular el ISR, en vez de reducir la base gravable
                                  antes, lo cual sobreestima el ISR retenido.
                                </p>
                              )}
                              {newTipo === 'ingreso' && (newConcepto === 'horas_extras_35' || newConcepto === 'horas_extras_100') && empleado.regimenIntermitente && (
                                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                  Este empleado está en régimen de trabajo intermitente (Resolución 04-93) —
                                  su jornada ordinaria llega hasta 10h/día y 60h/semana. Solo cuenta como
                                  hora extra lo que exceda esos umbrales, no los de la jornada ordinaria
                                  (8h/día, 44h/semana).
                                </p>
                              )}
                              {newTipo === 'ingreso' && (newConcepto === 'horas_extras_35' || newConcepto === 'horas_extras_100') && (() => {
                                const feriadosMes = getFeriados(periodoActual!.anio).filter(f => new Date(f.fecha + 'T00:00:00').getMonth() + 1 === periodoActual!.mes)
                                if (feriadosMes.length === 0) return null
                                return (
                                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                    Feriados de {MESES[periodoActual!.mes - 1]} (calendario de Configuración → Nómina):{' '}
                                    {feriadosMes.map(f => `${formatDate(f.fecha)} (${f.nombre})`).join(', ')}.
                                    {newConcepto === 'horas_extras_35'
                                      ? ' Si las horas que vas a cargar corresponden a uno de estos días, regístralas como H.E. 100% en vez de H.E. 35% (Art. 203).'
                                      : ' Confirma que las horas correspondan efectivamente a uno de estos días feriados.'}
                                  </p>
                                )
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400" colSpan={esEnProceso ? 3 : 2}>
                    {hayFiltrosTabla ? `TOTAL (filtrado) — ${nominasVisibles.length} empleados` : `TOTALES — ${empleadosPeriodo.length} empleados`}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">{fmt(totalesVisibles.bruto)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {fmt(totalesVisibles.afpSfs)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{fmt(totalesVisibles.isr)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">{fmt(totalesVisibles.neto)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{fmt(totalesVisibles.costoTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Nota legal */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-0.5">
              <p className="font-semibold">Normativa aplicada</p>
              <p>AFP 2.87% emp / 7.10% empr (tope RD$464,460) · SFS 3.04% emp / 7.09% empr (tope RD$232,230) · SRL 1.10%–1.30% empr según categoría (tope RD$92,892) · Infotep 1.00% empr</p>
              {periodoActual.tipo === 'quincenal'
                ? <p>Quincenal: 1ª quincena = anticipo sin ISR · 2ª quincena = ISR mensual completo liquidado · Ley 11-92 Art. 309</p>
                : <p>ISR calculado sobre base anual según tramos DGII vigentes · Ley 11-92 Art. 309</p>
              }
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {detalleModal && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <DetalleNomina
            empleado={detalleModal.emp}
            nomina={detalleModal.nom}
            periodoLabel={periodoActualLabel}
            mostrarUSD={mostrarUSD}
            onClose={() => setDetalleModal(null)}
          />
        </>
      )}

      {importarHorasAbierto && esEnProceso && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in" />
          <ImportadorHorasExcel
            empleados={empleados}
            empleadosElegibles={empleadosPeriodo}
            ajustesPorEmpleado={ajustesPorEmp}
            onConfirmar={(nuevosAjustesPorEmpleado, totalAgregados) => {
              Object.entries(nuevosAjustesPorEmpleado).forEach(([empId, ajustes]) => {
                actualizarAjustes(periodoActual.id, empId, ajustes)
              })
              const totalEmpleados = Object.keys(nuevosAjustesPorEmpleado).length
              setToast(`Se agregaron ${totalAgregados} ajuste(s) de horas a ${totalEmpleados} empleado(s)`)
            }}
            onClose={() => setImportarHorasAbierto(false)}
          />
        </>
      )}

      {auditoriaIds && (() => {
        const anterior = periodoAnterior(periodoActual, periodos)
        const UMBRAL_VARIACION = empresa.umbralVariacionBrutoPct ?? UMBRAL_VARIACION_BRUTO_DEFAULT
        const UMBRAL_DESCUENTO = empresa.umbralEndeudamientoPct ?? UMBRAL_ENDEUDAMIENTO_DEFAULT

        const filas = empleadosPeriodo
          .filter(e => auditoriaIds.includes(e.id))
          .map(e => {
            const actual = nominas.find(n => n.empleado.id === e.id)!.resultado
            let variacionBrutoPct: number | null = null
            if (anterior) {
              const ajustesAnt = anterior.ajustesPorEmpleado?.[e.id]
              if (ajustesAnt !== undefined) {
                const prev = resultadoDePeriodo(e, ajustesAnt, anterior)
                if (prev.totalBruto > 0) {
                  variacionBrutoPct = ((actual.totalBruto - prev.totalBruto) / prev.totalBruto) * 100
                }
              }
            }
            const fi = new Date(e.fechaIngreso)
            const esNuevo = fi.getFullYear() === periodoActual.anio && (fi.getMonth() + 1) === periodoActual.mes
            const descuentoDiscrecional = (ajustesPorEmp[e.id] ?? [])
              .filter(a => a.concepto === 'prestamo' || a.concepto === 'otro_descuento')
              .reduce((s, a) => s + a.valor, 0)
            const descuentoDiscrecionalPct = actual.totalBruto > 0 ? (descuentoDiscrecional / actual.totalBruto) * 100 : 0
            return {
              empleado: e,
              neto: actual.salarioNeto,
              variacionBrutoPct,
              netoNegativo: actual.salarioNeto < 0,
              descuentoDiscrecionalPct,
              esNuevo,
            }
          })

        const filasConAlerta = filas.filter(f =>
          f.netoNegativo ||
          (f.variacionBrutoPct !== null && Math.abs(f.variacionBrutoPct) > UMBRAL_VARIACION) ||
          f.descuentoDiscrecionalPct > UMBRAL_DESCUENTO ||
          f.esNuevo
        )

        const salientes = anterior
          ? liquidaciones.filter(l => {
              const ft = new Date(l.fechaTerminacion)
              const enAnterior = ft.getFullYear() === anterior.anio && (ft.getMonth() + 1) === anterior.mes
              const enActual   = ft.getFullYear() === periodoActual.anio && (ft.getMonth() + 1) === periodoActual.mes
              return enAnterior || enActual
            })
          : []

        const sinAlertas = filasConAlerta.length === 0 && salientes.length === 0

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
              onClick={() => setAuditoriaIds(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Auditoría pre-cierre</h2>
                  </div>
                  <button onClick={() => setAuditoriaIds(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Esta acción completará el período — pasará de <strong>En Proceso</strong> a{' '}
                    <strong>Procesada</strong>. Revisa antes de continuar
                    {anterior ? ` (comparado con ${labelPeriodo(anterior)})` : ''}.
                  </p>

                  {sinAlertas ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      No se detectaron variaciones ni empleados fuera de lo esperado.
                    </div>
                  ) : (
                    <>
                      {filasConAlerta.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                                <th className="px-3 py-2 font-medium">Empleado</th>
                                <th className="px-3 py-2 font-medium text-right">Neto</th>
                                <th className="px-3 py-2 font-medium">Alerta</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                              {filasConAlerta.map(f => (
                                <tr key={f.empleado.id}>
                                  <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{fullName(f.empleado)}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${f.netoNegativo ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                    {fmt(f.neto)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {f.netoNegativo && <Badge variant="danger">Neto negativo</Badge>}
                                      {f.variacionBrutoPct !== null && Math.abs(f.variacionBrutoPct) > UMBRAL_VARIACION && (
                                        <Badge variant="warning">
                                          {f.variacionBrutoPct > 0 ? '+' : ''}{f.variacionBrutoPct.toFixed(0)}% bruto
                                        </Badge>
                                      )}
                                      {f.descuentoDiscrecionalPct > UMBRAL_DESCUENTO && (
                                        <Badge variant="warning">Descuentos {f.descuentoDiscrecionalPct.toFixed(0)}% del bruto</Badge>
                                      )}
                                      {f.esNuevo && <Badge variant="info">Nuevo este mes</Badge>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {salientes.length > 0 && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
                          <p className="mb-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            Empleados desvinculados recientemente
                          </p>
                          <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                            {salientes.map(l => {
                              const emp = empleados.find(e => e.id === l.empleadoId)
                              return (
                                <li key={l.id}>
                                  {emp ? fullName(emp) : 'Empleado'} — liquidado el {formatDate(l.fechaTerminacion)}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                    El umbral de descuentos discrecionales (préstamos/otros) es una regla de negocio interna
                    de Cielo Cloud, no un límite establecido por el Código de Trabajo — revísalo con criterio propio.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                  <button
                    onClick={() => setAuditoriaIds(null)}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAuditoria}
                    className={BTN_PRIMARY}
                  >
                    Continuar y procesar
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
