'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useLicencias, DIAS_LICENCIA, labelLicencia } from '@/lib/licencias-context'
import { formatRD, formatDate, fullName } from '@/lib/utils'
import type { TipoLicencia } from '@/types'
import { FileClock, CalendarPlus, Banknote, Trash2, Plus, Info, Heart, HeartCrack, Baby } from 'lucide-react'

const TIPOS: TipoLicencia[] = ['matrimonial', 'fallecimiento', 'alumbramiento']

function iconoTipo(tipo: TipoLicencia) {
  switch (tipo) {
    case 'matrimonial':   return Heart
    case 'fallecimiento': return HeartCrack
    case 'alumbramiento': return Baby
  }
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

export default function LicenciasPage() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { licencias, registrar, eliminar } = useLicencias()

  const [empleadoId, setEmpleadoId] = useState('')
  const [tipo, setTipo] = useState<TipoLicencia>('matrimonial')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [toast, setToast] = useState<string | null>(null)

  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  const hoy = new Date()
  const licenciasMes = licencias.filter(l => {
    const f = new Date(l.fechaInicio)
    return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear()
  })
  const totalPagadoMes = licenciasMes.reduce((s, l) => s + l.montoPagado, 0)
  const totalPagadoGeneral = licencias.reduce((s, l) => s + l.montoPagado, 0)

  function handleRegistrar() {
    const emp = empMap[empleadoId]
    if (!emp) {
      setToast('Seleccione un empleado')
      return
    }
    registrar(empleadoId, tipo, fechaInicio, emp.salarioBase)
    setToast(`Licencia ${labelLicencia(tipo).toLowerCase()} registrada — ${fullName(emp)}`)
    setEmpleadoId('')
    setFechaInicio(new Date().toISOString().split('T')[0])
  }

  function handleEliminar(id: string) {
    eliminar(id)
    setToast('Licencia eliminada')
  }

  const licenciasOrdenadas = [...licencias].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Licencias Remuneradas"
        subtitle="Matrimonial · Fallecimiento · Alumbramiento — Código de Trabajo"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Licencias Este Mes"
            value={`${licenciasMes.length}`}
            sub="Registradas en el mes actual"
            icon={FileClock}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Total Pagado Este Mes"
            value={formatRD(totalPagadoMes, 0)}
            sub="Salario diario × días de licencia"
            icon={Banknote}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Total Histórico Pagado"
            value={formatRD(totalPagadoGeneral, 0)}
            sub={`${licencias.length} licencia(s) registrada(s)`}
            icon={CalendarPlus}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>

        {/* ── Form: registrar nueva licencia ──────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Registrar Nueva Licencia</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              La fecha fin y el monto a pagar se calculan automáticamente según el tipo de licencia
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Empleado</label>
                <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} className={INPUT_CLASS}>
                  <option value="">— Seleccionar empleado —</option>
                  {empleadosActivos.map(e => (
                    <option key={e.id} value={e.id}>{fullName(e)} — {e.cargo}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tipo de Licencia</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoLicencia)} className={INPUT_CLASS}>
                  {TIPOS.map(t => (
                    <option key={t} value={t}>{labelLicencia(t)} ({DIAS_LICENCIA[t]} días)</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Fecha de Inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <button
                onClick={handleRegistrar}
                disabled={!empleadoId}
                className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Registrar
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Licencias Registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fin</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto Pagado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {licenciasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <FileClock className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin licencias registradas</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Usa el formulario de arriba para registrar la primera licencia remunerada.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {licenciasOrdenadas.map(l => {
                  const emp = empMap[l.empleadoId]
                  const Icon = iconoTipo(l.tipo)
                  return (
                    <tr key={l.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        {emp ? (
                          <div>
                            <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(emp)}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">{emp.cargo}</p>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs">Empleado eliminado</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          <Icon className="h-3 w-3" />
                          {labelLicencia(l.tipo)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaInicio)}</td>
                      <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaFin)}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-zinc-500 dark:text-zinc-400">{l.dias}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                        {formatRD(l.montoPagado, 2)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleEliminar(l.id)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                          title="Eliminar licencia"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {licenciasOrdenadas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                    <td colSpan={5} className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      TOTAL — {licenciasOrdenadas.length} licencia(s)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                      {formatRD(totalPagadoGeneral, 2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Legal note ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1">
              <p className="font-semibold">Licencias Remuneradas — Código de Trabajo, República Dominicana</p>
              <p>
                <strong>Matrimonial:</strong> 5 días calendario pagados al 100%. <strong>Fallecimiento de familiar</strong>
                {' '}(abuelos, padres, hijos, cónyuge): 3 días calendario pagados al 100%. <strong>Alumbramiento</strong> de
                esposa o compañera registrada: 2 días calendario pagados al 100%. El monto se calcula sobre el salario
                diario (salario base ÷ 23.83 días).
              </p>
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
