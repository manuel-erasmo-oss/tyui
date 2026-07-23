'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { useEmpleados } from '@/lib/empleados-context'
import { useVacaciones } from '@/lib/vacaciones-context'
import {
  getAnosServicio,
  getDivisorSalarioDiario,
  calcularNomina,
  contarDiasLaborables,
  calcularDiasVacacionesAcumulados,
  DIAS_VACACIONES_HASTA_5_ANOS,
  DIAS_VACACIONES_MAS_5_ANOS,
} from '@/lib/dominican-labor'
import { useEmpresa } from '@/lib/empresa-context'
import { formatRD, formatDate, formatAnosServicio, fullName, BTN_PRIMARY, parseFechaLocal } from '@/lib/utils'
import { CalendarDays, Users, Wallet, AlertCircle, Download, Plane, Plus, X, Trash2, Banknote, Search, RotateCcw } from 'lucide-react'

export default function VacacionesPage() {
  const { empleadosEnNomina } = useEmpleados()
  const { empresa } = useEmpresa()
  const { disfrutes, registrarDisfrute, registrarVenta, eliminarDisfrute, diasTomados, estaDeVacaciones } = useVacaciones()

  const [toast, setToast] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [empId, setEmpId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [notas, setNotas] = useState('')

  // Venta de vacaciones — el empleado sigue trabajando, solo cambia días de
  // descanso futuro por un pago extra en la fecha efectiva elegida.
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false)
  const [empIdVenta, setEmpIdVenta] = useState('')
  const [diasVenta, setDiasVenta] = useState('')
  const [fechaEfectivaVenta, setFechaEfectivaVenta] = useState('')
  const [notasVenta, setNotasVenta] = useState('')

  const filas = empleadosEnNomina.map(e => {
    const anos            = getAnosServicio(e.fechaIngreso)
    const diasAnuales     = anos >= 5 ? DIAS_VACACIONES_MAS_5_ANOS : DIAS_VACACIONES_HASTA_5_ANOS
    // Compone TODOS los años completos de servicio (a la tasa vigente en cada
    // uno) + la fracción del año en curso — no solo el ciclo actual, que
    // descartaría años completos nunca disfrutados. + saldo inicial:
    // empleados con historial previo a Cielo Cloud (migración).
    const diasAcumulados  = calcularDiasVacacionesAcumulados(anos, e.saldoVacacionesInicial ?? 0)
    const tomados         = diasTomados(e.id)
    const diasDisponibles = Math.max(0, diasAcumulados - tomados)
    const valorDiario     = e.salarioBase / getDivisorSalarioDiario(e)
    const valorAcumulado  = diasAcumulados * valorDiario
    // Las vacaciones son salario ordinario (Art. 178) — llevan AFP/SFS/ISR
    // normales si el monto supera la exención del ISR, igual que al pagarse
    // en Liquidación. Este neto es un ESTIMADO de lo que el empleado
    // recibiría si se le pagara hoy — el monto real se calcula (y puede
    // ajustarse) al momento de pagarlo de verdad.
    const retencionEstimada = calcularNomina({ ...e, salarioBase: valorAcumulado })
    const valorNetoEstimado = retencionEstimada.salarioNeto
    const puedeGozar      = anos >= 1
    const deVacacionesHoy = estaDeVacaciones(e.id)
    return { empleado: e, anos, diasAnuales, diasAcumulados, tomados, diasDisponibles, valorDiario, valorAcumulado, valorNetoEstimado, puedeGozar, deVacacionesHoy }
  })

  const totalDias        = filas.reduce((s, f) => s + f.diasAcumulados, 0)
  const totalDisponibles = filas.reduce((s, f) => s + f.diasDisponibles, 0)
  const totalValor       = filas.reduce((s, f) => s + f.valorAcumulado, 0)
  const totalValorNeto   = filas.reduce((s, f) => s + f.valorNetoEstimado, 0)
  const empleadosAptos   = filas.filter(f => f.puedeGozar).length
  const deVacacionesAhora = filas.filter(f => f.deVacacionesHoy).length

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
  const totalDiasVisible        = filasVisibles.reduce((s, f) => s + f.diasAcumulados, 0)
  const totalDisponiblesVisible = filasVisibles.reduce((s, f) => s + f.diasDisponibles, 0)
  const totalValorVisible       = filasVisibles.reduce((s, f) => s + f.valorAcumulado, 0)
  const totalValorNetoVisible   = filasVisibles.reduce((s, f) => s + f.valorNetoEstimado, 0)

  const disfrutesOrdenados = [...disfrutes].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))

  // Preview en vivo del registro que se está armando en el modal
  const empSeleccionado = empleadosEnNomina.find(e => e.id === empId) ?? null
  const diasLaborablesPreview = (empSeleccionado && fechaInicio && fechaFin && fechaFin >= fechaInicio)
    ? contarDiasLaborables(parseFechaLocal(fechaInicio), parseFechaLocal(fechaFin))
    : 0
  const disponiblesSeleccionado = empSeleccionado
    ? filas.find(f => f.empleado.id === empSeleccionado.id)?.diasDisponibles ?? 0
    : 0
  const excedeDisponibles = diasLaborablesPreview > disponiblesSeleccionado

  // Preview en vivo del modal de venta
  const empSeleccionadoVenta = empleadosEnNomina.find(e => e.id === empIdVenta) ?? null
  const diasVentaNum = Number(diasVenta) || 0
  const disponiblesVenta = empSeleccionadoVenta
    ? filas.find(f => f.empleado.id === empSeleccionadoVenta.id)?.diasDisponibles ?? 0
    : 0
  const excedeDisponiblesVenta = diasVentaNum > disponiblesVenta
  const valorVentaPreview = empSeleccionadoVenta
    ? diasVentaNum * (empSeleccionadoVenta.salarioBase / getDivisorSalarioDiario(empSeleccionadoVenta))
    : 0

  function abrirModal(id?: string) {
    setEmpId(id ?? '')
    setFechaInicio('')
    setFechaFin('')
    setNotas('')
    setModalAbierto(true)
  }

  function abrirModalVenta(id?: string) {
    setEmpIdVenta(id ?? '')
    setDiasVenta('')
    setFechaEfectivaVenta('')
    setNotasVenta('')
    setModalVentaAbierto(true)
  }

  function handleRegistrar() {
    if (!empSeleccionado || !fechaInicio || !fechaFin || fechaFin < fechaInicio) return
    registrarDisfrute(empSeleccionado.id, fechaInicio, fechaFin, notas || undefined)
    setModalAbierto(false)
    setToast(`Disfrute registrado — ${fullName(empSeleccionado)} · ${diasLaborablesPreview} día(s) laborables`)
  }

  function handleRegistrarVenta() {
    if (!empSeleccionadoVenta || diasVentaNum <= 0 || !fechaEfectivaVenta) return
    registrarVenta(empSeleccionadoVenta.id, diasVentaNum, fechaEfectivaVenta, notasVenta || undefined)
    setModalVentaAbierto(false)
    setToast(`Venta registrada — ${fullName(empSeleccionadoVenta)} · ${diasVentaNum} día(s) · ${formatRD(valorVentaPreview)}`)
  }

  function handleEliminar(id: string) {
    eliminarDisfrute(id)
    setToast('Registro eliminado')
  }

  // Exporta exactamente las mismas filas ya calculadas para la tabla en
  // pantalla (mismo desglose, mismo total). Carga la librería bajo demanda.
  async function handleExportar() {
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasExcel = filas.map(({ empleado, anos, diasAnuales, diasAcumulados, tomados, diasDisponibles, valorDiario, valorAcumulado, valorNetoEstimado, puedeGozar }) => [
      fullName(empleado),
      empleado.cedula,
      formatAnosServicio(anos),
      diasAnuales,
      valorDiario,
      Number(diasAcumulados.toFixed(2)),
      Number(tomados.toFixed(2)),
      Number(diasDisponibles.toFixed(2)),
      Number(valorAcumulado.toFixed(2)),
      Number(valorNetoEstimado.toFixed(2)),
      puedeGozar ? 'Puede gozar' : 'En acumulación',
    ])
    await exportarExcel({
      nombreArchivo: `vacaciones-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Vacaciones',
        titulo: 'Vacaciones por Empleado',
        subtitulo: 'Art. 177/178 · Código de Trabajo · Ley 16-92 · Neto estimado con AFP/SFS/ISR',
        encabezados: ['Empleado', 'Cédula', 'Antigüedad', 'Días/Año', 'Tarifa Diaria', 'Días Acumulados', 'Días Tomados', 'Días Disponibles', 'Valor Bruto', 'Neto Estimado', 'Estado'],
        filas: filasExcel,
        totales: ['TOTAL', '', '', '', '', Number(totalDias.toFixed(2)), '', Number(totalDisponibles.toFixed(2)), Number(totalValor.toFixed(2)), Number(totalValorNeto.toFixed(2)), ''],
        anchos: [26, 16, 14, 10, 14, 16, 14, 16, 16, 16, 16],
        columnasEnteras: [3],
      }],
    })
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Vacaciones"
        subtitle="Art. 177 · Código de Trabajo · Ley 16-92"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportar}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
            <button
              onClick={() => abrirModalVenta()}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Banknote className="h-4 w-4" />
              Vender Vacaciones
            </button>
            <button onClick={() => abrirModal()} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" />
              Registrar Disfrute
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Días Acumulados"
            value={`${totalDias.toFixed(1)} días`}
            sub="Total planilla activa"
            icon={CalendarDays}
            iconColor="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          />
          <StatCard
            label="Días Disponibles"
            value={`${totalDisponibles.toFixed(1)} días`}
            sub="Acumulados − ya tomados"
            icon={CalendarDays}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Valor Bruto"
            value={formatRD(totalValor)}
            sub="Días acumulados × tarifa diaria"
            icon={Wallet}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Neto Estimado"
            value={formatRD(totalValorNeto)}
            sub="Si se pagara hoy — con AFP/SFS/ISR"
            icon={Wallet}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="Empleados con Derecho"
            value={`${empleadosAptos} / ${filas.length}`}
            sub="Completaron 1 año de servicio"
            icon={Users}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="De Vacaciones Ahora"
            value={`${deVacacionesAhora}`}
            sub={`de ${filas.length} empleado(s)`}
            icon={Plane}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vacaciones por Empleado</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              14 días laborables (1–5 años) · 18 días laborables (más de 5 años). Tarifa diaria = salario ÷ 23.83
              (÷ 26 en régimen de trabajo intermitente). Días Disponibles resta lo ya tomado en Disfrutes registrados.
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días/Año</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disponibles</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Neto Estimado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4M10 15h4" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados activos</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Registra empleados en la sección de Empleados para ver sus vacaciones acumuladas.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.length > 0 && filasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      Ningún empleado coincide con el filtro.
                    </td>
                  </tr>
                )}
                {filasVisibles.map(({ empleado, anos, diasAnuales, diasAcumulados, diasDisponibles, valorAcumulado, valorNetoEstimado, puedeGozar, deVacacionesHoy }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-xs font-bold text-sky-700 dark:text-sky-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingresó: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        diasAnuales === DIAS_VACACIONES_MAS_5_ANOS
                          ? 'bg-[#eef0fb] text-[#151f66] dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-[#1a1d2e] dark:text-zinc-400'
                      }`}>
                        {diasAnuales} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {diasAcumulados.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {diasDisponibles.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(valorAcumulado)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {formatRD(valorNetoEstimado)}
                    </td>
                    <td className="px-4 py-3.5">
                      {deVacacionesHoy
                        ? <Badge variant="success"><Plane className="mr-1 h-3 w-3" />De Vacaciones</Badge>
                        : puedeGozar
                        ? <Badge variant="success">Puede gozar</Badge>
                        : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">En acumulación</span>
                          </div>
                        )
                      }
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => abrirModal(empleado.id)}
                        className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
                      >
                        Registrar
                      </button>
                      <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                      <button
                        onClick={() => abrirModalVenta(empleado.id)}
                        className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
                      >
                        Vender
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-400">
                    {hayFiltrosActivos ? 'TOTAL (filtrado)' : 'TOTAL'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-zinc-500 dark:text-zinc-400">{totalDiasVisible.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-700 dark:text-sky-300">{totalDisponiblesVisible.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-500 dark:text-zinc-400">{formatRD(totalValorVisible)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-700 dark:text-sky-300">{formatRD(totalValorNetoVisible)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Disfrutes y Ventas Registradas</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cada registro resta de los días disponibles. Un <strong>Disfrute</strong> prorratea el salario normal
              del período de Nómina que se solape con sus fechas. Una <strong>Venta</strong> no reduce días
              trabajados — solo agrega el valor de los días vendidos como pago extra en el período que cubra la
              fecha efectiva. Ambos con AFP/SFS/ISR (Art. 178).
            </p>
          </div>
          {disfrutesOrdenados.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Plane}
                message="Aún no se ha registrado ningún disfrute ni venta de vacaciones."
                action={{ label: 'Registrar Disfrute', onClick: () => abrirModal() }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Desde</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Hasta</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días Laborables</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Notas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {disfrutesOrdenados.map(d => {
                    const emp = empleadosEnNomina.find(e => e.id === d.empleadoId)
                    const esVenta = d.tipo === 'venta'
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{emp ? fullName(emp) : '—'}</td>
                        <td className="px-4 py-3.5">
                          {esVenta
                            ? <Badge variant="info"><Banknote className="mr-1 h-3 w-3" />Venta</Badge>
                            : <Badge variant="default"><Plane className="mr-1 h-3 w-3" />Disfrute</Badge>}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{formatDate(d.fechaInicio)}</td>
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">{esVenta ? '—' : formatDate(d.fechaFin)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">{d.diasLaborables}</td>
                        <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{d.notas || '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleEliminar(d.id)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 px-5 py-4 text-xs text-sky-800 dark:text-sky-300">
          <p className="font-semibold mb-1">Art. 177–179, Código de Trabajo — República Dominicana</p>
          <p>Después de un trabajo continuo no menor de un año, el trabajador tendrá derecho a <strong>un período de vacaciones remuneradas de catorce (14) días laborables</strong>. Después de cinco años de servicio ininterrumpido, el trabajador tendrá derecho a <strong>dieciocho (18) días laborables</strong> de vacaciones. Las vacaciones no pueden ser sustituidas por una compensación en dinero, excepto cuando el contrato termina sin que hayan sido disfrutadas.</p>
          <p className="mt-2">A diferencia de la cesantía/preaviso (indemnizaciones exentas) y de la Regalía Pascual (100% exenta, Art. 219), las vacaciones son salario ordinario continuado (Art. 178) — llevan AFP, SFS e ISR normales si el monto supera la exención del ISR. La columna "Neto Estimado" muestra lo que el empleado recibiría hoy después de esas retenciones.</p>
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalAbierto(false)}>
          <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 animate-backdrop-in" />
          <div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Registrar Disfrute de Vacaciones</h3>
              <button onClick={() => setModalAbierto(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Empleado</label>
                <select
                  value={empId}
                  onChange={e => setEmpId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecciona un empleado…</option>
                  {empleadosEnNomina.map(e => (
                    <option key={e.id} value={e.id}>{fullName(e)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha Inicio</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={e => setFechaInicio(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha Fin (regreso)</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={e => setFechaFin(e.target.value)}
                    min={fechaInicio || undefined}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Notas (opcional)</label>
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej. Viaje familiar"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              {diasLaborablesPreview > 0 && (
                <div className={`rounded-lg px-3 py-2.5 text-xs ${excedeDisponibles
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                  : 'bg-[#eef0fb] text-[#151f66] dark:bg-indigo-950/30 dark:text-indigo-300'}`}
                >
                  <p><strong>{diasLaborablesPreview} día(s) laborables</strong> (excluye domingos) — {empSeleccionado ? `${disponiblesSeleccionado.toFixed(2)} disponible(s)` : ''}</p>
                  {excedeDisponibles && (
                    <p className="mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Supera los días disponibles del empleado — se puede registrar igual, pero revisa el acumulado.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <button
                onClick={() => setModalAbierto(false)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrar}
                disabled={!empSeleccionado || !fechaInicio || !fechaFin || fechaFin < fechaInicio}
                className={`${BTN_PRIMARY} disabled:opacity-40 disabled:pointer-events-none`}
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalVentaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalVentaAbierto(false)}>
          <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 animate-backdrop-in" />
          <div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vender Vacaciones</h3>
              <button onClick={() => setModalVentaAbierto(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                El empleado sigue trabajando normal — solo se agrega el valor de los días vendidos como pago extra
                en el período de Nómina que cubra la fecha efectiva, con AFP/SFS/ISR (Art. 178).
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Empleado</label>
                <select
                  value={empIdVenta}
                  onChange={e => setEmpIdVenta(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecciona un empleado…</option>
                  {empleadosEnNomina.map(e => (
                    <option key={e.id} value={e.id}>{fullName(e)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Días a Vender</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={diasVenta}
                    onChange={e => setDiasVenta(e.target.value)}
                    placeholder="Ej. 14"
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha Efectiva</label>
                  <input
                    type="date"
                    value={fechaEfectivaVenta}
                    onChange={e => setFechaEfectivaVenta(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Notas (opcional)</label>
                <input
                  type="text"
                  value={notasVenta}
                  onChange={e => setNotasVenta(e.target.value)}
                  placeholder="Ej. Acordado con gerencia"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              {diasVentaNum > 0 && empSeleccionadoVenta && (
                <div className={`rounded-lg px-3 py-2.5 text-xs ${excedeDisponiblesVenta
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                  : 'bg-[#eef0fb] text-[#151f66] dark:bg-indigo-950/30 dark:text-indigo-300'}`}
                >
                  <p><strong>{formatRD(valorVentaPreview)} bruto</strong> ({diasVentaNum} día(s) × tarifa diaria) — {disponiblesVenta.toFixed(2)} disponible(s)</p>
                  {excedeDisponiblesVenta && (
                    <p className="mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Supera los días disponibles del empleado — se puede registrar igual, pero revisa el acumulado.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <button
                onClick={() => setModalVentaAbierto(false)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarVenta}
                disabled={!empSeleccionadoVenta || diasVentaNum <= 0 || !fechaEfectivaVenta}
                className={`${BTN_PRIMARY} disabled:opacity-40 disabled:pointer-events-none`}
              >
                Registrar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
