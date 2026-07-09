'use client'

import { useState } from 'react'
import {
  TrendingUp, Users, Building2, Check, ChevronDown, CalendarClock, Clock,
  FileSpreadsheet, ShieldCheck, UserCheck, Ban, History, X, Info, CheckCircle2,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Toast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useEmpleados } from '@/lib/empleados-context'
import { useAumentos } from '@/lib/aumentos-context'
import { useAuth } from '@/lib/auth-context'
import { ImportadorAumentosExcel } from '@/components/aumentos/ImportadorAumentosExcel'
import { formatRD, fullName, formatDate } from '@/lib/utils'
import type { Empleado, RegistroAumento, EstadoAumento } from '@/types'

function estadoLabel(estado: EstadoAumento): string {
  switch (estado) {
    case 'pendiente_aprobacion': return 'Pendiente'
    case 'aprobado':             return 'Aprobado'
    case 'rechazado':            return 'Rechazado'
    case 'aplicado':             return 'Aplicado'
  }
}

function EstadoBadge({ estado }: { estado: EstadoAumento }) {
  const variant = estado === 'pendiente_aprobacion' ? 'warning'
    : estado === 'aprobado' ? 'info'
    : estado === 'rechazado' ? 'danger'
    : 'success'
  return <Badge variant={variant}>{estadoLabel(estado)}</Badge>
}

export default function AumentosPage() {
  const { empleados, empleadosActivos } = useEmpleados()
  const { user } = useAuth()
  const { solicitar, aprobar, rechazar, aplicar, getPendientes, getHistorial } = useAumentos()

  // ─── Solicitud por criterio ────────────────────────────────────────────────
  const [tipoAjuste, setTipoAjuste] = useState<'porcentaje' | 'fijo'>('porcentaje')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [filtroDepto, setFiltroDepto] = useState<string>('todos')
  const [filtroFechaIngresoAntes, setFiltroFechaIngresoAntes] = useState('')
  const [filtroSinAumentoDesde, setFiltroSinAumentoDesde] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [modo, setModo] = useState<'criterio' | 'excel'>('criterio')
  const [toast, setToast] = useState<string | null>(null)

  // ─── Workflow de aprobación ─────────────────────────────────────────────────
  const [resolverModal, setResolverModal] = useState<{ registro: RegistroAumento; accion: 'aprobar' | 'rechazar' } | null>(null)
  const [textoResolver, setTextoResolver] = useState('')
  const [filtroHistorialEmpleado, setFiltroHistorialEmpleado] = useState<string>('todos')

  function empleadoDe(id: string): Empleado | undefined {
    return empleados.find(e => e.id === id)
  }

  const departamentos = ['todos', ...Array.from(new Set(empleadosActivos.map(e => e.departamento))).sort()]

  // Última fecha en que a cada empleado se le APLICÓ un aumento. No existe un
  // campo "fecha de último cambio salarial" en Empleado — en vez de inventarlo,
  // se reconstruye a partir del propio historial de RegistroAumento (única
  // fuente de verdad de este módulo), tomando la fechaAplicacion más reciente.
  const historialGlobal = getHistorial()
  const ultimoAumentoAplicado = new Map<string, string>()
  historialGlobal.forEach(r => {
    if (r.estado === 'aplicado' && r.fechaAplicacion) {
      const previa = ultimoAumentoAplicado.get(r.empleadoId)
      if (!previa || r.fechaAplicacion > previa) ultimoAumentoAplicado.set(r.empleadoId, r.fechaAplicacion)
    }
  })

  const pendientes = getPendientes()
  const pendientesPorEmpleado = new Set(pendientes.map(p => p.empleadoId))
  const aprobadosPorAplicar = historialGlobal.filter(a => a.estado === 'aprobado')

  let empleadosFiltrados = filtroDepto === 'todos'
    ? empleadosActivos
    : empleadosActivos.filter(e => e.departamento === filtroDepto)

  if (filtroFechaIngresoAntes) {
    empleadosFiltrados = empleadosFiltrados.filter(e => e.fechaIngreso <= filtroFechaIngresoAntes)
  }
  if (filtroSinAumentoDesde) {
    empleadosFiltrados = empleadosFiltrados.filter(e => {
      const ultima = ultimoAumentoAplicado.get(e.id)
      return !ultima || ultima.slice(0, 10) < filtroSinAumentoDesde
    })
  }

  const valorNum = parseFloat(valor) || 0

  function nuevoSalario(emp: Empleado): number {
    if (!valorNum) return emp.salarioBase
    if (tipoAjuste === 'porcentaje') return Math.round(emp.salarioBase * (1 + valorNum / 100))
    return Math.round(emp.salarioBase + valorNum)
  }

  const totalActual = empleadosFiltrados
    .filter(e => seleccionados.has(e.id))
    .reduce((s, e) => s + e.salarioBase, 0)

  const totalNuevo = empleadosFiltrados
    .filter(e => seleccionados.has(e.id))
    .reduce((s, e) => s + nuevoSalario(e), 0)

  const totalImpacto = totalNuevo - totalActual

  function toggleSeleccion(id: string) {
    if (pendientesPorEmpleado.has(id)) return
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(empleadosFiltrados.filter(e => !pendientesPorEmpleado.has(e.id)).map(e => e.id)))
  }

  function deseleccionarTodos() {
    setSeleccionados(new Set())
  }

  function solicitarAumentos() {
    if (!valorNum || seleccionados.size === 0 || !motivo.trim()) return
    let enviados = 0
    seleccionados.forEach(id => {
      const emp = empleadosActivos.find(e => e.id === id)
      if (!emp) return
      solicitar({
        empleadoId: emp.id,
        salarioAnterior: emp.salarioBase,
        salarioNuevo: nuevoSalario(emp),
        tipoAjuste,
        valorAjuste: valorNum,
        motivo: motivo.trim(),
        solicitadoPor: user?.email ?? undefined,
        origen: 'manual',
      })
      enviados++
    })
    const tipoLabel = tipoAjuste === 'porcentaje' ? `${valorNum}%` : formatRD(valorNum, 0)
    setToast(`${enviados} solicitud(es) de aumento de ${tipoLabel} enviada(s) a aprobación — impacto mensual estimado: +${formatRD(totalImpacto, 0)}`)
    setSeleccionados(new Set())
    setValor('')
    setMotivo('')
  }

  const canSolicitar = valorNum > 0 && seleccionados.size > 0 && motivo.trim() !== ''

  function abrirResolver(registro: RegistroAumento, accion: 'aprobar' | 'rechazar') {
    setResolverModal({ registro, accion })
    setTextoResolver('')
  }

  function confirmarResolver() {
    if (!resolverModal) return
    const { registro, accion } = resolverModal
    const emp = empleadoDe(registro.empleadoId)
    if (accion === 'aprobar') {
      if (!textoResolver.trim()) return
      aprobar(registro.id, textoResolver.trim())
      setToast(`Aumento de ${emp ? fullName(emp) : 'empleado'} aprobado por ${textoResolver.trim()} — listo para aplicar a nómina`)
    } else {
      rechazar(registro.id, textoResolver.trim() || undefined)
      setToast(`Solicitud de aumento de ${emp ? fullName(emp) : 'empleado'} rechazada`)
    }
    setResolverModal(null)
    setTextoResolver('')
  }

  function handleAplicar(registro: RegistroAumento) {
    const ok = aplicar(registro.id)
    const emp = empleadoDe(registro.empleadoId)
    setToast(ok
      ? `Salario de ${emp ? fullName(emp) : 'empleado'} actualizado a ${formatRD(registro.salarioNuevo, 0)}`
      : 'No se pudo aplicar el aumento — verifica que esté aprobado')
  }

  const historialFiltrado = getHistorial(filtroHistorialEmpleado === 'todos' ? undefined : filtroHistorialEmpleado)

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Aumentos Salariales" subtitle="Selección por criterio, con aprobación antes de impactar nómina" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Toggle modo: por criterio vs importación Excel */}
        <div className="flex gap-2">
          <button
            onClick={() => setModo('criterio')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              modo === 'criterio'
                ? 'bg-[#1B2980] text-white'
                : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#252840] hover:border-zinc-300 dark:hover:border-[#3a3f5c]'
            }`}
          >
            Por Criterio
          </button>
          <button
            onClick={() => setModo('excel')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              modo === 'excel'
                ? 'bg-[#1B2980] text-white'
                : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#252840] hover:border-zinc-300 dark:hover:border-[#3a3f5c]'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Importar Excel
          </button>
        </div>

        {modo === 'excel' ? (
          <ImportadorAumentosExcel onFinish={() => setModo('criterio')} />
        ) : (
          <>
            {/* Section 1 — Config card */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Solicitar Aumento por Criterio</h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Seleccione el tipo de aumento, ingrese el valor, filtre y elija a los empleados. Esto crea
                  una solicitud <strong>pendiente de aprobación</strong> — el salario no cambia hasta que se
                  apruebe y se aplique explícitamente.
                </p>
              </div>

              <div className="px-5 py-4 flex flex-wrap items-end gap-6">
                {/* Tipo de ajuste */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tipo de ajuste</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTipoAjuste('porcentaje')}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        tipoAjuste === 'porcentaje'
                          ? 'bg-[#1B2980] text-white'
                          : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#252840] hover:border-zinc-300 dark:hover:border-[#3a3f5c]'
                      }`}
                    >
                      % Porcentaje
                    </button>
                    <button
                      onClick={() => setTipoAjuste('fijo')}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        tipoAjuste === 'fijo'
                          ? 'bg-[#1B2980] text-white'
                          : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#252840] hover:border-zinc-300 dark:hover:border-[#3a3f5c]'
                      }`}
                    >
                      RD$ Monto fijo
                    </button>
                  </div>
                </div>

                {/* Value input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    {tipoAjuste === 'porcentaje' ? 'Porcentaje de aumento' : 'Monto fijo (RD$)'}
                  </label>
                  <div className="flex items-center gap-1">
                    {tipoAjuste === 'fijo' && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">RD$</span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step={tipoAjuste === 'porcentaje' ? '0.1' : '100'}
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      placeholder={tipoAjuste === 'porcentaje' ? 'Ej. 10' : 'Ej. 2000'}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] focus:outline-none w-40"
                    />
                    {tipoAjuste === 'porcentaje' && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">%</span>
                    )}
                  </div>
                </div>

                {/* Department filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Departamento
                  </label>
                  <div className="relative">
                    <select
                      value={filtroDepto}
                      onChange={e => { setFiltroDepto(e.target.value); setSeleccionados(new Set()) }}
                      className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none appearance-none pr-8"
                    >
                      <option value="todos">Todos los departamentos</option>
                      {departamentos.filter(d => d !== 'todos').map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  </div>
                </div>

                {/* Fecha de ingreso filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Ingresados antes de
                  </label>
                  <input
                    type="date"
                    value={filtroFechaIngresoAntes}
                    onChange={e => { setFiltroFechaIngresoAntes(e.target.value); setSeleccionados(new Set()) }}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none"
                  />
                </div>

                {/* Sin aumento reciente filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Sin aumento aplicado desde
                  </label>
                  <input
                    type="date"
                    value={filtroSinAumentoDesde}
                    onChange={e => { setFiltroSinAumentoDesde(e.target.value); setSeleccionados(new Set()) }}
                    className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none"
                  />
                </div>
              </div>

              {/* Motivo */}
              <div className="px-5 pb-4">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Motivo (requerido)</label>
                <input
                  type="text"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej. Ajuste anual por desempeño, revisión de mercado, promoción..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] focus:outline-none"
                />
              </div>

              {filtroSinAumentoDesde && (
                <div className="px-5 pb-4 flex items-start gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  &quot;Sin aumento aplicado desde&quot; se calcula contra el historial de este mismo módulo
                  (fecha del último aumento aplicado por Cielo Cloud) — no existe un campo separado de
                  &quot;fecha de último cambio salarial&quot; en la ficha del empleado.
                </div>
              )}
            </div>

            {/* Section 2 — Preview table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
              <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Vista Previa
                  </h2>
                  {seleccionados.size > 0 && (
                    <span className="rounded-full bg-[#eef0fb] dark:bg-indigo-950/40 px-2 py-0.5 text-xs font-semibold text-[#1B2980] dark:text-indigo-400">
                      {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={seleccionarTodos}
                    className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-xs text-zinc-300 dark:text-zinc-600">|</span>
                  <button
                    onClick={deseleccionarTodos}
                    className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:underline"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Departamento</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Actual</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ajuste</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nuevo Salario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {empleadosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V10M18 20V4M6 20v-6" />
                              </svg>
                            </div>
                            <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados que coincidan con los filtros</p>
                            <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                              Ajusta el departamento o las fechas para aplicar ajustes salariales.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      empleadosFiltrados.map(emp => {
                        const isSelected = seleccionados.has(emp.id)
                        const tienePendiente = pendientesPorEmpleado.has(emp.id)
                        return (
                          <tr
                            key={emp.id}
                            onClick={() => toggleSeleccion(emp.id)}
                            className={`transition-colors ${
                              tienePendiente
                                ? 'opacity-50 cursor-not-allowed'
                                : `cursor-pointer hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 ${isSelected ? 'bg-[#eef0fb]/40 dark:bg-indigo-950/20' : ''}`
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="px-4 py-3.5">
                              <div
                                className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-[#1B2980] border-[#1B2980]'
                                    : 'border-zinc-300 dark:border-[#3a3f5c] bg-white dark:bg-[#1a1d2e]'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                            </td>

                            {/* Empleado */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef0fb] dark:bg-indigo-950/40 text-xs font-bold text-[#1B2980] dark:text-indigo-400 shrink-0">
                                  {emp.nombre[0]}{emp.apellido[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                    {fullName(emp)}
                                    {tienePendiente && <Badge variant="warning">Solicitud pendiente</Badge>}
                                  </p>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                                </div>
                              </div>
                            </td>

                            {/* Departamento */}
                            <td className="px-4 py-3.5">
                              <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                {emp.departamento}
                              </span>
                            </td>

                            {/* Salario Actual */}
                            <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                              {formatRD(emp.salarioBase, 0)}
                            </td>

                            {/* Ajuste */}
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {valorNum > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {tipoAjuste === 'porcentaje'
                                    ? `+${valorNum}%`
                                    : `+${formatRD(valorNum, 0)}`
                                  }
                                </span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-600">—</span>
                              )}
                            </td>

                            {/* Nuevo Salario */}
                            <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#151f66] dark:text-indigo-300">
                              {valorNum > 0
                                ? formatRD(nuevoSalario(emp), 0)
                                : <span className="text-zinc-300 dark:text-zinc-600 font-normal">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3 — Impact summary + Solicitar */}
            {seleccionados.size > 0 && valorNum > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
                <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Empleados: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{seleccionados.size}</span>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Costo actual: <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(totalActual, 0)}</span>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Costo nuevo: <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(totalNuevo, 0)}</span>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Impacto mensual estimado: <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatRD(totalImpacto, 0)}</span>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Impacto anual estimado: <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatRD(totalImpacto * 12, 0)}</span>
                  </span>
                </div>

                <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  {/* Warning note */}
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex-1 min-w-0">
                    Esto crea solicitudes en estado <strong>Pendiente de Aprobación</strong> — el salario base
                    de los empleados seleccionados NO cambia hasta que cada una se apruebe (con confirmación
                    explícita) y se aplique desde las secciones de abajo.
                  </div>

                  {/* Solicitar button */}
                  <button
                    onClick={solicitarAumentos}
                    disabled={!canSolicitar}
                    className={`shrink-0 px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      canSolicitar
                        ? 'bg-[#1B2980] text-white hover:bg-[#151f66]'
                        : 'bg-zinc-200 dark:bg-[#252840] text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    Solicitar Aumentos
                  </button>
                </div>
              </div>
            )}

            {/* Disabled apply button shown when conditions not met */}
            {!(seleccionados.size > 0 && valorNum > 0) && (
              <div className="flex justify-end">
                <button
                  disabled
                  className="px-6 py-2 rounded-lg font-semibold text-sm bg-zinc-200 dark:bg-[#252840] text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                >
                  Solicitar Aumentos
                </button>
              </div>
            )}
          </>
        )}

        {/* Aumentos Pendientes de Aprobación */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Aumentos Pendientes de Aprobación</h2>
              {pendientes.length > 0 && (
                <span className="rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {pendientes.length}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              La app no tiene roles de acceso multiusuario reales — la salvaguarda es esta confirmación
              explícita: escribe a mano el nombre de quien aprueba antes de que el aumento pueda pasar a
              &quot;Aplicado&quot; e impactar el salario real.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">Nuevo</th>
                  <th className="px-4 py-3">Ajuste</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Solicitado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {pendientes.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={CheckCircle2}
                        message="No hay solicitudes pendientes de aprobación."
                        className="border-none py-10"
                      />
                    </td>
                  </tr>
                ) : pendientes.map(p => {
                  const emp = empleadoDe(p.empleadoId)
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">{emp ? fullName(emp) : 'Empleado eliminado'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">{formatRD(p.salarioAnterior, 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#151f66] dark:text-indigo-300 tabular-nums">{formatRD(p.salarioNuevo, 0)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{p.tipoAjuste === 'porcentaje' ? `+${p.valorAjuste}%` : `+${formatRD(p.valorAjuste, 0)}`}</Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[220px] truncate" title={p.motivo}>{p.motivo}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        <p>{formatDate(p.fechaSolicitud)}</p>
                        {p.solicitadoPor && <p className="truncate max-w-[140px]">{p.solicitadoPor}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirResolver(p, 'aprobar')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Aprobar
                          </button>
                          <button
                            onClick={() => abrirResolver(p, 'rechazar')}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                          >
                            <Ban className="h-3.5 w-3.5" /> Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aprobados — pendientes de aplicar a nómina */}
        {aprobadosPorAplicar.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Aprobados — Pendientes de Aplicar a Nómina</h2>
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                {aprobadosPorAplicar.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Nuevo</th>
                    <th className="px-4 py-3">Aprobado por</th>
                    <th className="px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {aprobadosPorAplicar.map(a => {
                    const emp = empleadoDe(a.empleadoId)
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1B2980] dark:text-indigo-400">{emp ? fullName(emp) : 'Empleado eliminado'}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">{formatRD(a.salarioAnterior, 0)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#151f66] dark:text-indigo-300 tabular-nums">{formatRD(a.salarioNuevo, 0)}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          <p>{a.aprobadoPor}</p>
                          {a.fechaAprobacion && <p>{formatDate(a.fechaAprobacion)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleAplicar(a)}
                            className="rounded-lg bg-[#1B2980] hover:bg-[#151f66] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                          >
                            Aplicar a Nómina
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Historial de Aumentos */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Historial de Aumentos</h2>
            </div>
            <div className="relative">
              <select
                value={filtroHistorialEmpleado}
                onChange={e => setFiltroHistorialEmpleado(e.target.value)}
                className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none appearance-none pr-8"
              >
                <option value="todos">Todos los empleados</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Ajuste</th>
                  <th className="px-4 py-3 text-right">Anterior</th>
                  <th className="px-4 py-3 text-right">Nuevo</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fechas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {historialFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-zinc-400">
                      Sin registros todavía.
                    </td>
                  </tr>
                ) : historialFiltrado.map(r => {
                  const emp = empleadoDe(r.empleadoId)
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">{emp ? fullName(emp) : 'Empleado eliminado'}</p>
                        {r.origen === 'importacion_excel' && <p className="text-[10px] text-zinc-400">Importado (Excel)</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{r.tipoAjuste === 'porcentaje' ? `+${r.valorAjuste}%` : `+${formatRD(r.valorAjuste, 0)}`}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">{formatRD(r.salarioAnterior, 0)}</td>
                      <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">{formatRD(r.salarioNuevo, 0)}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate" title={r.motivo}>{r.motivo}</td>
                      <td className="px-4 py-3"><EstadoBadge estado={r.estado} /></td>
                      <td className="px-4 py-3 text-[11px] text-zinc-400 space-y-0.5">
                        <p>Solicitado: {formatDate(r.fechaSolicitud)}</p>
                        {r.fechaAprobacion && (
                          <p>
                            {r.estado === 'rechazado' ? 'Rechazado' : 'Aprobado'}: {formatDate(r.fechaAprobacion)}
                            {r.aprobadoPor ? ` — ${r.aprobadoPor}` : ''}
                          </p>
                        )}
                        {r.fechaAplicacion && <p>Aplicado: {formatDate(r.fechaAplicacion)}</p>}
                        {r.motivoRechazo && <p className="italic">Motivo: {r.motivoRechazo}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast}
          type="success"
          onClose={() => setToast(null)}
        />
      )}

      {/* Modal de aprobación/rechazo */}
      {resolverModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
            onClick={() => setResolverModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
                <div className="flex items-center gap-2">
                  {resolverModal.accion === 'aprobar' ? (
                    <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Ban className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  )}
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {resolverModal.accion === 'aprobar' ? 'Aprobar Aumento' : 'Rechazar Solicitud'}
                  </h2>
                </div>
                <button onClick={() => setResolverModal(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {(() => {
                  const emp = empleadoDe(resolverModal.registro.empleadoId)
                  const r = resolverModal.registro
                  return (
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-4 py-3 text-xs space-y-1">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{emp ? fullName(emp) : 'Empleado eliminado'}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        {formatRD(r.salarioAnterior, 0)} → <span className="font-semibold text-[#151f66] dark:text-indigo-300">{formatRD(r.salarioNuevo, 0)}</span>
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400">Motivo: {r.motivo}</p>
                    </div>
                  )
                })()}

                {resolverModal.accion === 'aprobar' ? (
                  <div>
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Aprobado por (requerido)
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={textoResolver}
                      onChange={e => setTextoResolver(e.target.value)}
                      placeholder="Nombre de quien aprueba"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                      La app no valida que esta persona sea distinta a quien solicitó el aumento (no hay
                      roles de acceso multiusuario reales) — esta confirmación explícita, con el nombre
                      escrito a mano, es el rastro auditable antes de impactar nómina.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Motivo del rechazo (opcional)
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={textoResolver}
                      onChange={e => setTextoResolver(e.target.value)}
                      placeholder="Ej. Presupuesto insuficiente este trimestre"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
                <button
                  onClick={() => setResolverModal(null)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarResolver}
                  disabled={resolverModal.accion === 'aprobar' && !textoResolver.trim()}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                    resolverModal.accion === 'aprobar'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {resolverModal.accion === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
