'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { getMesesServicio, regaliaPagadaVigente } from '@/lib/dominican-labor'
import { formatRD, formatDate, fullName, BTN_PRIMARY, cn } from '@/lib/utils'
import {
  Gift, Calendar, AlertTriangle, Download, Send, Pencil, Check, X, ArrowRight,
  CheckCircle2, Search, History, RotateCcw, ExternalLink, Layers,
} from 'lucide-react'
import { EmpleadoInfoReadOnly } from '@/components/empleados/EmpleadoInfoReadOnly'
import type { Empleado, PeriodoNomina } from '@/types'

const hoy = new Date()
const mesActual  = hoy.getMonth() + 1  // 1-based
const anioActual = hoy.getFullYear()

export default function RegaliaPage() {
  const { empleados, empleadosEnNomina } = useEmpleados()
  const { empresa } = useEmpresa()
  const { periodos, generar } = usePeriodos()

  const filas = empleadosEnNomina.map(e => {
    const mesesServicio      = Math.min(getMesesServicio(e.fechaIngreso), mesActual)
    // Math.max(0, …): protege contra fechaIngreso en el futuro (error de
    // captura), que de otro modo produciría meses/porcentaje negativos.
    const mesesAcumulados    = Math.max(0, Math.min(mesesServicio, 12))
    // Neto de lo ya pagado este año — migración previa a Cielo Cloud, o un
    // pago ya liquidado vía un período de Regalía Pascual anterior de este
    // mismo año (ver regaliaPagadaVigente en dominican-labor.ts).
    const acumuladoBruto     = (e.salarioBase / 12) * mesesAcumulados
    // Redondeado a centavos: sin esto, un empleado recién liquidado en su
    // totalidad (acumuladoBruto === regaliaPagadaVigente) puede arrastrar un
    // residuo de fracciones de centavo por error de punto flotante — visible
    // como RD$0.00 pero técnicamente > 0, colándolo de vuelta a la próxima
    // solicitud de liquidación como si aún tuviera saldo pendiente.
    const acumulado          = Math.round(Math.max(0, acumuladoBruto - regaliaPagadaVigente(e, anioActual)) * 100) / 100
    const proyeccionAnual    = e.salarioBase  // 1 salario completo
    const porcentaje         = (mesesAcumulados / 12) * 100
    return { empleado: e, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }
  })

  const totalAcumulado   = filas.reduce((s, f) => s + f.acumulado, 0)
  const totalProyectado  = filas.reduce((s, f) => s + f.proyeccionAnual, 0)
  const diasParaDic20    = Math.max(0, Math.ceil(
    (new Date(hoy.getFullYear(), 11, 20).getTime() - hoy.getTime()) / (1000 * 3600 * 24)
  ))

  // Período de nómina de Regalía Pascual para el año en curso. Mientras
  // sigue en_proceso/procesada en Nómina, bloquea "Solicitar Liquidación"
  // con el banner "ya se solicitó". Una vez cerrada (pagada), YA NO debe
  // reaparecer el botón de solicitud — aunque el acumulado individual de
  // cada empleado ya vuelto a 0 amortigua el riesgo (regaliaPagadaVigente),
  // un empleado que nunca formó parte de ese período cerrado (ej. se agregó
  // después) sí mostraría un pendiente genuino, y confirmar crearía un
  // SEGUNDO período "Regalía Pascual {año}" duplicado (bug confirmado en
  // QA) — así que el gate real es "¿ya existe un período de este año, en
  // cualquier estado?", no solo "¿sigue sin cerrar?".
  const periodoRegaliaAnioActual = periodos.find(p => p.tipo === 'regalia' && p.anio === anioActual)
  const periodoRegaliaExistente = periodoRegaliaAnioActual && periodoRegaliaAnioActual.estado !== 'cerrada' ? periodoRegaliaAnioActual : undefined
  const periodoRegaliaPagado = periodoRegaliaAnioActual && periodoRegaliaAnioActual.estado === 'cerrada' ? periodoRegaliaAnioActual : undefined

  // Historial de ciclos ya liquidados y pagados — así queda visible que años
  // anteriores se pagaron y sobre cuál año se está acumulando ahora mismo.
  const historialRegalia = periodos
    .filter(p => p.tipo === 'regalia' && p.estado === 'cerrada')
    .sort((a, b) => b.anio - a.anio)

  // ── Filtros (nombre, cédula, departamento) ────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const departamentos = Array.from(new Set(filas.map(f => f.empleado.departamento))).sort()
  const q = busqueda.trim().toLowerCase()
  const filasVisibles = filas.filter(f => {
    if (filtroDepto !== 'todos' && f.empleado.departamento !== filtroDepto) return false
    if (!q) return true
    return fullName(f.empleado).toLowerCase().includes(q) || f.empleado.cedula.toLowerCase().includes(q)
  })
  const hayFiltrosActivos = busqueda.trim() !== '' || filtroDepto !== 'todos'
  const totalAcumuladoVisible  = filasVisibles.reduce((s, f) => s + f.acumulado, 0)
  const totalProyectadoVisible = filasVisibles.reduce((s, f) => s + f.proyeccionAnual, 0)

  // ── Ficha de empleado de solo lectura ──────────────────────────────────────
  const [empleadoInfo, setEmpleadoInfo] = useState<Empleado | null>(null)

  // ── Prepantalla: elegir acumulación actual vs. historial ──────────────────
  // Con historial existente, la primera vez que se abre el módulo se
  // pregunta explícitamente qué se quiere ver (patrón de "Calcular Nómina"
  // de herramientas premium como Alegra) en vez de amontonar ambas cosas en
  // la misma pantalla. Sin historial (empresa nueva/primer año) se salta la
  // elección y se va directo a la acumulación — no hay nada que elegir.
  const tieneHistorial = historialRegalia.length > 0
  const [pantalla, setPantalla] = useState<'elegir' | 'actual' | 'historial'>('elegir')
  const vistaActual: 'elegir' | 'actual' | 'historial' = tieneHistorial ? pantalla : 'actual'

  // ── Solicitar Liquidación de Regalía ──────────────────────────────────────
  const [solicitudAbierta, setSolicitudAbierta] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, { monto: number; motivo: string }>>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [montoEdit, setMontoEdit] = useState('')
  const [motivoEdit, setMotivoEdit] = useState('')
  const [periodoCreado, setPeriodoCreado] = useState<PeriodoNomina | null>(null)

  function abrirSolicitud() {
    setOverrides({})
    setEditandoId(null)
    setPeriodoCreado(null)
    setSolicitudAbierta(true)
  }

  function montoDe(empId: string, montoCalculado: number): number {
    return overrides[empId]?.monto ?? montoCalculado
  }

  function abrirEdicion(empId: string, montoActual: number) {
    setEditandoId(empId)
    setMontoEdit(String(Math.round(montoActual * 100) / 100))
    setMotivoEdit(overrides[empId]?.motivo ?? '')
  }

  function guardarEdicion(empId: string) {
    const monto = parseFloat(montoEdit)
    if (isNaN(monto) || monto < 0 || !motivoEdit.trim()) return
    setOverrides(prev => ({ ...prev, [empId]: { monto, motivo: motivoEdit.trim() } }))
    setEditandoId(null)
  }

  function quitarEdicion(empId: string) {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[empId]
      return next
    })
  }

  function confirmarSolicitud() {
    // Defensa adicional además del gate de la UI: nunca crear un segundo
    // período de Regalía Pascual para un año que ya tiene uno, sin importar
    // su estado.
    if (periodoRegaliaAnioActual) return
    const montosRegalia: Record<string, number> = {}
    const motivosAjusteRegalia: Record<string, string> = {}
    for (const f of filas) {
      const monto = montoDe(f.empleado.id, f.acumulado)
      if (monto <= 0) continue
      montosRegalia[f.empleado.id] = Math.round(monto * 100) / 100
      const ov = overrides[f.empleado.id]
      if (ov) motivosAjusteRegalia[f.empleado.id] = ov.motivo
    }
    const totalEmpleados = Object.keys(montosRegalia).length
    if (totalEmpleados === 0) return
    const totalMonto = Object.values(montosRegalia).reduce((s, m) => s + m, 0)
    const nuevo = generar({
      tipo: 'regalia',
      mes: 12,
      anio: anioActual,
      estado: 'en_proceso',
      totalEmpleados,
      totales: { bruto: totalMonto, descuentos: 0, neto: totalMonto, aportes: 0, isr: 0, costoTotal: totalMonto },
      montosRegalia,
      ...(Object.keys(motivosAjusteRegalia).length > 0 ? { motivosAjusteRegalia } : {}),
    })
    setPeriodoCreado(nuevo)
  }

  // Exporta exactamente las mismas filas ya calculadas para la tabla en
  // pantalla (mismo desglose, mismo total). Carga la librería bajo demanda.
  async function handleExportar() {
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasExcel = filas.map(({ empleado, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }) => [
      fullName(empleado),
      empleado.cedula,
      empleado.salarioBase,
      mesesAcumulados,
      Number(acumulado.toFixed(2)),
      proyeccionAnual,
      Math.round(porcentaje),
    ])
    await exportarExcel({
      nombreArchivo: `regalia-pascual-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Regalía Pascual',
        titulo: `Provisión por Empleado — Año ${hoy.getFullYear()}`,
        subtitulo: 'Art. 219 · Código de Trabajo · Ley 16-92',
        encabezados: ['Empleado', 'Cédula', 'Salario Mensual', 'Meses Acumulados', 'Acumulado', 'Proyección Anual', 'Progreso %'],
        filas: filasExcel,
        totales: ['TOTAL', '', '', '', Number(totalAcumulado.toFixed(2)), Number(totalProyectado.toFixed(2)), ''],
        anchos: [26, 16, 16, 16, 16, 16, 12],
        columnasEnteras: [3, 6],
      }],
    })
  }

  // ── Prepantalla: elegir acumulación actual vs. historial ──────────────────
  if (vistaActual === 'elegir') {
    const masReciente = historialRegalia[0]
    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header title="Regalía Pascual" subtitle="Art. 219 · Código de Trabajo · Ley 16-92" />
        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a] p-6 md:p-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">¿Qué quieres ver?</h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                Elige si quieres consultar la acumulación del ciclo en curso o revisar liquidaciones ya pagadas.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPantalla('actual')}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-left shadow-sm dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1B2980]/10"
              >
                <div className="relative mb-4 h-12 w-12">
                  <div className="absolute inset-0 rounded-2xl bg-[#1B2980] blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'linear-gradient(135deg, #1B2980, #2f3fa8)' }}>
                    <Gift className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Acumulación Actual</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Ciclo {anioActual} en progreso</p>
                <div className="mt-4 flex items-baseline justify-between rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Acumulado a hoy</span>
                  <span className="text-sm font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">{formatRD(totalAcumulado)}</span>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#1B2980] dark:text-indigo-400">
                  Ver acumulación <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPantalla('historial')}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-left shadow-sm dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="relative mb-4 h-12 w-12">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-600 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'linear-gradient(135deg, #059669, #34d399)' }}>
                    <History className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Historial de Liquidaciones</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {historialRegalia.length} ciclo{historialRegalia.length !== 1 ? 's' : ''} ya pagado{historialRegalia.length !== 1 ? 's' : ''}
                </p>
                {masReciente && (
                  <div className="mt-4 flex items-baseline justify-between rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Último ciclo — {masReciente.anio}</span>
                    <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatRD(masReciente.totales.bruto)}</span>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Ver historial <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Pantalla: Historial de Liquidaciones ───────────────────────────────────
  if (vistaActual === 'historial') {
    return (
      <div className="flex flex-col overflow-hidden h-full">
        <Header
          title="Historial de Liquidaciones"
          subtitle="Regalía Pascual · Ciclos ya liquidados y pagados"
          actions={
            <button
              onClick={() => setPantalla('elegir')}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Layers className="h-4 w-4" />
              Cambiar de vista
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ciclo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Pagado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de Pago</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {historialRegalia.map(p => (
                    <tr key={p.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-zinc-100">Regalía Pascual {p.anio}</td>
                      <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-400">{p.totalEmpleados}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatRD(p.totales.bruto)}</td>
                      <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{p.fechaPago ? formatDate(p.fechaPago) : '—'}</td>
                      <td className="px-4 py-3.5">
                        {p.pagada
                          ? <Badge variant="success">Pagada</Badge>
                          : <Badge variant="warning">Cerrada — pago sin confirmar</Badge>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href="/nomina"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Ver en Nómina
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Regalía Pascual"
        subtitle={`Art. 219 · Código de Trabajo · Ley 16-92 · Ciclo en acumulación: ${anioActual}`}
        actions={
          <div className="flex items-center gap-2">
            {tieneHistorial && (
              <button
                onClick={() => setPantalla('elegir')}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <Layers className="h-4 w-4" />
                Cambiar de vista
              </button>
            )}
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
            {periodoRegaliaExistente ? (
              <Link
                href="/nomina"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Liquidación {anioActual} en Nómina
              </Link>
            ) : periodoRegaliaPagado ? (
              <Link
                href={periodoRegaliaPagado.pagada ? '/nomina/envios' : '/nomina'}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] transition-colors"
                title={periodoRegaliaPagado.pagada
                  ? 'Ya se pagó y se confirmó el envío — para corregirlo, deshaz el pago primero en Gestión de Envíos'
                  : 'Ya se pagó este ciclo — para corregirlo, reabre el período desde Nómina'}
              >
                <CheckCircle2 className="h-4 w-4" />
                {periodoRegaliaPagado.pagada ? `${anioActual} pagada — Gestión de Envíos` : `${anioActual} ya pagada — ver en Nómina`}
              </Link>
            ) : (
              <button
                onClick={abrirSolicitud}
                disabled={filas.every(f => f.acumulado <= 0)}
                className={cn(BTN_PRIMARY, 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none')}
              >
                <Send className="h-4 w-4" />
                Solicitar Liquidación de Regalía
              </button>
            )}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {periodoRegaliaExistente && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-3.5 text-sm">
            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Ya se solicitó la liquidación de Regalía Pascual {anioActual} — continúa el pago desde Nómina.
            </div>
            <Link href="/nomina" className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              Ir a Nómina <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {periodoRegaliaPagado && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3.5 text-sm">
            <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {periodoRegaliaPagado.pagada
                ? <>La Regalía Pascual {anioActual} ya se pagó y se confirmó el envío — no se puede solicitar de nuevo.
                    Si necesitas corregirla, primero deshaz el pago en Gestión de Envíos y luego reabre el período desde Nómina.</>
                : <>La Regalía Pascual {anioActual} ya se pagó — no se puede solicitar de nuevo. Si necesitas corregirla,
                    reabre el período desde Nómina.</>}
            </div>
            <Link
              href={periodoRegaliaPagado.pagada ? '/nomina/envios' : '/nomina'}
              className="flex items-center gap-1 font-semibold text-zinc-600 dark:text-zinc-300 hover:underline"
            >
              {periodoRegaliaPagado.pagada ? 'Ir a Gestión de Envíos' : 'Ir a Nómina'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Acumulado al Mes Actual"
            value={formatRD(totalAcumulado)}
            sub={`${mesActual}/12 meses del año`}
            icon={Gift}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Proyección Anual Total"
            value={formatRD(totalProyectado)}
            sub="Si todos completan el año"
            icon={Calendar}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Días para Vencimiento"
            value={`${diasParaDic20} días`}
            sub="Fecha límite: 20 de diciembre"
            icon={AlertTriangle}
            iconColor={diasParaDic20 < 30 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}
            trend={diasParaDic20 < 30 ? 'down' : 'neutral'}
            trendLabel={diasParaDic20 < 30 ? 'Urgente' : 'En tiempo'}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Provisión por Empleado — Año {hoy.getFullYear()}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cálculo: Salario mensual ÷ 12 × meses laborados en el año. Pago obligatorio entre el 1 y 20 de diciembre.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o cédula…"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              />
            </div>
            <select
              value={filtroDepto}
              onChange={e => setFiltroDepto(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
            >
              <option value="todos">Todos los departamentos</option>
              {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {hayFiltrosActivos && (
              <button
                onClick={() => { setBusqueda(''); setFiltroDepto('todos') }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Ver todos
              </button>
            )}
            <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
              {filasVisibles.length} de {filas.length} empleado(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Mensual</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Meses Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Acumulado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Proyección Anual</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12V22H4V12" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 7H2v5h20V7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados activos</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Registra empleados para calcular la provisión de regalía pascual del año.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.length > 0 && filasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      Ningún empleado coincide con el filtro.
                    </td>
                  </tr>
                )}
                {filasVisibles.map(({ empleado, mesesAcumulados, acumulado, proyeccionAnual, porcentaje }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setEmpleadoInfo(empleado)}
                        title="Ver ficha del empleado"
                        className="flex items-center gap-3 text-left"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-[#1B2980] dark:hover:text-indigo-400 hover:underline">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingreso: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(empleado.salarioBase)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-400">
                        {mesesAcumulados}/12
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatRD(acumulado)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRD(proyeccionAnual)}
                    </td>
                    <td className="px-4 py-3.5 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-8 text-right">
                          {Math.round(porcentaje)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-400">
                    {hayFiltrosActivos ? 'TOTAL (filtrado)' : 'TOTAL'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-300">{formatRD(totalAcumuladoVisible)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-zinc-700 dark:text-zinc-300">{formatRD(totalProyectadoVisible)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Art. 219, Código de Trabajo — República Dominicana</p>
          <p>Todo empleador tiene la obligación de pagar a cada uno de sus trabajadores, en el período navideño, <strong>una regalía pascual equivalente a un salario ordinario del mes de diciembre</strong>. Dicha regalía deberá pagarse en la primera quincena del mes de diciembre. El trabajador que al 30 de noviembre no haya completado el año de servicio recibirá la parte proporcional correspondiente.</p>
        </div>
      </div>

      {solicitudAbierta && (() => {
        const filasSolicitud = filas.filter(f => montoDe(f.empleado.id, f.acumulado) > 0 || overrides[f.empleado.id])
        const totalSolicitud = filasSolicitud.reduce((s, f) => s + montoDe(f.empleado.id, f.acumulado), 0)

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
              onClick={() => setSolicitudAbierta(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
                {periodoCreado ? (
                  <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Liquidación solicitada</p>
                    <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                      Se creó el período <strong>Regalía Pascual {anioActual}</strong> en Nómina con{' '}
                      {periodoCreado.totalEmpleados} empleado(s) por un total de {formatRD(periodoCreado.totales.bruto)}.
                      Al procesar el pago allí, el acumulado de cada empleado vuelve a cero.
                    </p>
                    <Link
                      href="/nomina"
                      className={cn(BTN_PRIMARY, 'mt-6')}
                    >
                      Ir a Nómina a procesar el pago <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                      <div className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Solicitar Liquidación de Regalía Pascual {anioActual}
                        </h2>
                      </div>
                      <button onClick={() => setSolicitudAbierta(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Esto crea un período especial en Nómina con el acumulado congelado de cada empleado, listo
                        para procesar el pago. Puedes ajustar manualmente el monto de un empleado antes de confirmar
                        (motivo obligatorio) — útil si hace falta un ajuste puntual.
                      </p>

                      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                              <th className="px-3 py-2 font-medium">Empleado</th>
                              <th className="px-3 py-2 font-medium text-right">Monto a Liquidar</th>
                              <th className="px-3 py-2 font-medium text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                            {filasSolicitud.map(({ empleado, acumulado }) => {
                              const monto = montoDe(empleado.id, acumulado)
                              const ov = overrides[empleado.id]
                              const editando = editandoId === empleado.id
                              return (
                                <tr key={empleado.id}>
                                  <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                                    {fullName(empleado)}
                                    {ov && (
                                      <p className="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400" title={ov.motivo}>
                                        Ajustado: {ov.motivo}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {editando ? (
                                      <input
                                        type="number"
                                        autoFocus
                                        value={montoEdit}
                                        onChange={e => setMontoEdit(e.target.value)}
                                        className="w-28 rounded-md border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#0d0f1a] dark:text-zinc-200 px-2 py-1 text-right text-xs focus:border-[#1B2980] focus:outline-none"
                                      />
                                    ) : (
                                      <span className={`tabular-nums font-semibold ${ov ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        {formatRD(monto)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {editando ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <input
                                          type="text"
                                          placeholder="Motivo del ajuste (obligatorio)"
                                          value={motivoEdit}
                                          onChange={e => setMotivoEdit(e.target.value)}
                                          className="w-40 rounded-md border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#0d0f1a] dark:text-zinc-200 px-2 py-1 text-xs focus:border-[#1B2980] focus:outline-none"
                                        />
                                        <button
                                          onClick={() => guardarEdicion(empleado.id)}
                                          disabled={!motivoEdit.trim() || montoEdit === '' || isNaN(parseFloat(montoEdit))}
                                          title="Guardar"
                                          className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setEditandoId(null)}
                                          title="Cancelar"
                                          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e]"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => abrirEdicion(empleado.id, monto)}
                                          title="Ajustar manualmente"
                                          className="rounded-md p-1 text-zinc-400 hover:text-[#1B2980] dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {ov && (
                                          <button
                                            onClick={() => quitarEdicion(empleado.id)}
                                            title="Quitar ajuste manual"
                                            className="rounded-md p-1 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {filasSolicitud.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-zinc-400 dark:text-zinc-500">
                                  Ningún empleado tiene acumulado por liquidar todavía.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-[#eef0fb] dark:bg-indigo-950/20 px-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-300">Total a Liquidar</span>
                        <span className="text-base font-bold tabular-nums text-[#1B2980] dark:text-indigo-300">{formatRD(totalSolicitud)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                      <button
                        onClick={() => setSolicitudAbierta(false)}
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmarSolicitud}
                        disabled={filasSolicitud.length === 0}
                        className={cn(BTN_PRIMARY, 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none')}
                      >
                        <Send className="h-4 w-4" />
                        Confirmar y Crear Período
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {empleadoInfo && (
        <EmpleadoInfoReadOnly
          empleado={empleadoInfo}
          todosEmpleados={empleados}
          onClose={() => setEmpleadoInfo(null)}
        />
      )}
    </div>
  )
}
