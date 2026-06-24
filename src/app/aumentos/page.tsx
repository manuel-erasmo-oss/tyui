'use client'

import { useState } from 'react'
import { TrendingUp, Users, Building2, Check, ChevronDown } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { formatRD, fullName } from '@/lib/utils'
import type { Empleado } from '@/types'

export default function AumentosPage() {
  const [tipoAjuste, setTipoAjuste] = useState<'porcentaje' | 'fijo'>('porcentaje')
  const [valor, setValor] = useState('')
  const [filtroDepto, setFiltroDepto] = useState<string>('todos')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [aplicado, setAplicado] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { empleadosActivos, update } = useEmpleados()
  const departamentos = ['todos', ...Array.from(new Set(empleadosActivos.map(e => e.departamento))).sort()]
  const empleadosFiltrados = filtroDepto === 'todos'
    ? empleadosActivos
    : empleadosActivos.filter(e => e.departamento === filtroDepto)

  const valorNum = parseFloat(valor) || 0

  function nuevoSalario(emp: Empleado): number {
    if (!valorNum) return emp.salarioBase
    if (tipoAjuste === 'porcentaje') return Math.round(emp.salarioBase * (1 + valorNum / 100))
    return Math.round(emp.salarioBase + valorNum)
  }

  function diferencia(emp: Empleado): number {
    return nuevoSalario(emp) - emp.salarioBase
  }

  const totalActual = empleadosFiltrados
    .filter(e => seleccionados.has(e.id))
    .reduce((s, e) => s + e.salarioBase, 0)

  const totalNuevo = empleadosFiltrados
    .filter(e => seleccionados.has(e.id))
    .reduce((s, e) => s + nuevoSalario(e), 0)

  const totalImpacto = totalNuevo - totalActual

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(empleadosFiltrados.map(e => e.id)))
  }

  function deseleccionarTodos() {
    setSeleccionados(new Set())
  }

  function aplicarAumentos() {
    if (!valorNum || seleccionados.size === 0) return
    seleccionados.forEach(id => {
      const emp = empleadosActivos.find(e => e.id === id)
      if (emp) update(id, { salarioBase: nuevoSalario(emp) })
    })
    const tipoLabel = tipoAjuste === 'porcentaje' ? `${valorNum}%` : formatRD(valorNum, 0)
    setToast(`Aumento de ${tipoLabel} aplicado a ${seleccionados.size} empleado(s) — impacto mensual: +${formatRD(totalImpacto, 0)}`)
    setAplicado(true)
    setSeleccionados(new Set())
    setValor('')
  }

  const canApply = valorNum > 0 && seleccionados.size > 0

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Aumentos Salariales" subtitle="Ajuste masivo de salarios" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Section 1 — Config card */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Configurar Ajuste</h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Seleccione el tipo de aumento, ingrese el valor y filtre por departamento.
            </p>
          </div>

          <div className="px-5 py-4 flex flex-wrap items-center gap-6">
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
                  onChange={e => { setValor(e.target.value); setAplicado(false) }}
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
          </div>
        </div>

        {/* Section 2 — Preview table */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          {/* Table header with selection controls */}
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
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
                      No hay empleados en este departamento.
                    </td>
                  </tr>
                ) : (
                  empleadosFiltrados.map(emp => {
                    const isSelected = seleccionados.has(emp.id)
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => toggleSeleccion(emp.id)}
                        className={`hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#eef0fb]/40 dark:bg-indigo-950/20' : ''
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
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
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

        {/* Section 3 — Impact summary + Apply */}
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
                Impacto mensual: <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatRD(totalImpacto, 0)}</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
              <span className="text-zinc-600 dark:text-zinc-400">
                Impacto anual: <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatRD(totalImpacto * 12, 0)}</span>
              </span>
            </div>

            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              {/* Warning note */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex-1 min-w-0">
                Esta acción actualizará los salarios base de los empleados seleccionados y se reflejará en la próxima nómina.
              </div>

              {/* Apply button */}
              <button
                onClick={aplicarAumentos}
                disabled={!canApply}
                className={`shrink-0 px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  canApply
                    ? 'bg-[#1B2980] text-white hover:bg-[#152070]'
                    : 'bg-zinc-200 dark:bg-[#252840] text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                Aplicar Aumentos
              </button>
            </div>
          </div>
        )}

        {/* Disabled apply button shown when conditions not met */}
        {(seleccionados.size === 0 || valorNum === 0) && (
          <div className="flex justify-end">
            <button
              disabled
              className="px-6 py-2 rounded-lg font-semibold text-sm bg-zinc-200 dark:bg-[#252840] text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            >
              Aplicar Aumentos
            </button>
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast}
          type="success"
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
