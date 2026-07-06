'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useBandasSalariales, normalizarPosicion } from '@/lib/bandas-salariales-context'
import { formatRD, fullName, cn } from '@/lib/utils'
import type { BandaSalarial, Empleado } from '@/types'
import {
  BarChart2, Plus, Pencil, Trash2, X, AlertTriangle, ArrowDown, ArrowUp,
  ListChecks, Info,
} from 'lucide-react'

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

const EMPTY_FORM = { posicion: '', salarioMinimo: '', salarioMedio: '', salarioMaximo: '' }

type EmpleadoFueraDeBanda = {
  empleado: Empleado
  banda: BandaSalarial
  direccion: 'debajo' | 'encima'
  diferencia: number
}

export default function BandasSalarialesPage() {
  const { empleadosActivos } = useEmpleados()
  const { bandas, crear, actualizar, eliminar } = useBandasSalariales()

  const [form, setForm] = useState(EMPTY_FORM)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditandoId(null)
  }

  function handleEditar(banda: BandaSalarial) {
    setEditandoId(banda.id)
    setForm({
      posicion: banda.posicion,
      salarioMinimo: String(banda.salarioMinimo),
      salarioMedio: String(banda.salarioMedio),
      salarioMaximo: String(banda.salarioMaximo),
    })
  }

  function handleGuardar() {
    const posicion = form.posicion.trim()
    const min = Number(form.salarioMinimo)
    const medio = Number(form.salarioMedio)
    const max = Number(form.salarioMaximo)

    if (!posicion) {
      setToast('Indique la posición/cargo')
      return
    }
    if (!min || !medio || !max) {
      setToast('Indique los 3 montos de la banda')
      return
    }
    if (!(min <= medio && medio <= max)) {
      setToast('El orden debe ser: mínimo ≤ medio ≤ máximo')
      return
    }

    // Evita bandas duplicadas para la misma posición (case-insensitive)
    const duplicada = bandas.find(b =>
      normalizarPosicion(b.posicion) === normalizarPosicion(posicion) && b.id !== editandoId,
    )
    if (duplicada) {
      setToast(`Ya existe una banda para "${duplicada.posicion}"`)
      return
    }

    if (editandoId) {
      actualizar(editandoId, { posicion, salarioMinimo: min, salarioMedio: medio, salarioMaximo: max })
      setToast(`Banda "${posicion}" actualizada`)
    } else {
      crear({ posicion, salarioMinimo: min, salarioMedio: medio, salarioMaximo: max })
      setToast(`Banda "${posicion}" creada`)
    }
    resetForm()
  }

  function handleEliminar(banda: BandaSalarial) {
    eliminar(banda.id)
    if (editandoId === banda.id) resetForm()
    setToast(`Banda "${banda.posicion}" eliminada`)
  }

  // ── Empleados fuera de banda ──────────────────────────────────────────────
  const fueraDeBanda: EmpleadoFueraDeBanda[] = useMemo(() => {
    const resultado: EmpleadoFueraDeBanda[] = []
    for (const emp of empleadosActivos) {
      const banda = bandas.find(b => normalizarPosicion(b.posicion) === normalizarPosicion(emp.cargo))
      if (!banda) continue
      if (emp.salarioBase < banda.salarioMinimo) {
        resultado.push({ empleado: emp, banda, direccion: 'debajo', diferencia: banda.salarioMinimo - emp.salarioBase })
      } else if (emp.salarioBase > banda.salarioMaximo) {
        resultado.push({ empleado: emp, banda, direccion: 'encima', diferencia: emp.salarioBase - banda.salarioMaximo })
      }
    }
    return resultado.sort((a, b) => b.diferencia - a.diferencia)
  }, [empleadosActivos, bandas])

  const posicionesSinBanda = useMemo(() => {
    const cargos = new Set(empleadosActivos.map(e => normalizarPosicion(e.cargo)))
    const cargosConBanda = new Set(bandas.map(b => normalizarPosicion(b.posicion)))
    return [...cargos].filter(c => c && !cargosConBanda.has(c)).length
  }, [empleadosActivos, bandas])

  // ── Distribución salarial (buckets) ───────────────────────────────────────
  const distribucion = useMemo(() => {
    if (empleadosActivos.length === 0) return []
    const salarios = empleadosActivos.map(e => e.salarioBase)
    const min = Math.min(...salarios)
    const max = Math.max(...salarios)
    const NUM_BUCKETS = 6
    if (min === max) {
      return [{ label: formatRD(min, 0), count: salarios.length, pct: 100 }]
    }
    const ancho = (max - min) / NUM_BUCKETS
    const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => {
      const desde = min + i * ancho
      const hasta = i === NUM_BUCKETS - 1 ? max : min + (i + 1) * ancho
      return { desde, hasta, count: 0 }
    })
    for (const s of salarios) {
      const idx = Math.min(NUM_BUCKETS - 1, Math.floor((s - min) / ancho))
      buckets[idx].count++
    }
    const maxCount = Math.max(...buckets.map(b => b.count))
    return buckets.map(b => ({
      label: `${formatRD(b.desde, 0)} – ${formatRD(b.hasta, 0)}`,
      count: b.count,
      pct: maxCount > 0 ? (b.count / maxCount) * 100 : 0,
    }))
  }, [empleadosActivos])

  const bandasOrdenadas = [...bandas].sort((a, b) => a.posicion.localeCompare(b.posicion))

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Bandas Salariales"
        subtitle="Niveles por posición, empleados fuera de banda y distribución"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            label="Bandas Definidas"
            value={`${bandas.length}`}
            sub="Posiciones con niveles salariales"
            icon={ListChecks}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Empleados Fuera de Banda"
            value={`${fueraDeBanda.length}`}
            sub="Por debajo del mínimo o sobre el máximo"
            icon={AlertTriangle}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="Por Debajo del Mínimo"
            value={`${fueraDeBanda.filter(f => f.direccion === 'debajo').length}`}
            sub="Requieren revisión de ajuste salarial"
            icon={ArrowDown}
            iconColor="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          />
          <StatCard
            label="Posiciones Sin Banda"
            value={`${posicionesSinBanda}`}
            sub="Cargos activos sin nivel definido"
            icon={Info}
            iconColor="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          />
        </div>

        {/* ── Form: crear/editar banda ─────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {editandoId ? 'Editar Banda Salarial' : 'Nueva Banda Salarial'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                La posición se compara contra el cargo del empleado (sin distinguir mayúsculas)
              </p>
            </div>
            {editandoId && (
              <button
                onClick={resetForm}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Cancelar edición
              </button>
            )}
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Posición / Cargo</label>
                <input
                  type="text"
                  value={form.posicion}
                  onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))}
                  placeholder="Ej. Analista Contable"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-40">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Mínimo (RD$)</label>
                <input
                  type="number"
                  min="0"
                  value={form.salarioMinimo}
                  onChange={e => setForm(f => ({ ...f, salarioMinimo: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-40">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Medio (RD$)</label>
                <input
                  type="number"
                  min="0"
                  value={form.salarioMedio}
                  onChange={e => setForm(f => ({ ...f, salarioMedio: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-40">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Máximo (RD$)</label>
                <input
                  type="number"
                  min="0"
                  value={form.salarioMaximo}
                  onChange={e => setForm(f => ({ ...f, salarioMaximo: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT_CLASS}
                />
              </div>

              <button
                onClick={handleGuardar}
                className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] transition-colors"
              >
                <Plus className="h-4 w-4" />
                {editandoId ? 'Guardar Cambios' : 'Crear Banda'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Table: bandas definidas ──────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bandas Definidas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Posición</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mínimo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Medio</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Máximo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {bandasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <BarChart2 className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin bandas salariales definidas</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Usa el formulario de arriba para crear la primera banda por posición.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {bandasOrdenadas.map(b => {
                  const empleadosEnBanda = empleadosActivos.filter(
                    e => normalizarPosicion(e.cargo) === normalizarPosicion(b.posicion),
                  ).length
                  return (
                    <tr key={b.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">{b.posicion}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(b.salarioMinimo, 0)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(b.salarioMedio, 0)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(b.salarioMaximo, 0)}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-zinc-500 dark:text-zinc-400">{empleadosEnBanda}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditar(b)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:text-[#1B2980] hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400 transition-colors"
                            title="Editar banda"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleEliminar(b)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                            title="Eliminar banda"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* ── Empleados fuera de banda ─────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Empleados Fuera de Banda</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Empleados activos cuyo salario base está fuera del rango mínimo–máximo de su posición
            </p>
          </div>
          {fueraDeBanda.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                <ListChecks className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
              </div>
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Todos los empleados están dentro de banda</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                Ningún empleado con banda definida está por debajo del mínimo o por encima del máximo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Banda</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Actual</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Situación</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {fueraDeBanda.map(({ empleado, banda, direccion, diferencia }) => (
                    <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(empleado)}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{empleado.cargo}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatRD(banda.salarioMinimo, 0)} – {formatRD(banda.salarioMaximo, 0)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(empleado.salarioBase, 0)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            direccion === 'debajo'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                          )}
                        >
                          {direccion === 'debajo' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          {direccion === 'debajo' ? 'Bajo el mínimo' : 'Sobre el máximo'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatRD(diferencia, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Distribución salarial ────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400 mb-4">
            Distribución Salarial — Empleados Activos
          </p>
          {distribucion.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay empleados activos para graficar.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {distribucion.map(bucket => (
                <div key={bucket.label} className="flex flex-1 flex-col items-center justify-end h-full gap-2">
                  <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{bucket.count}</span>
                  <div
                    className="w-full rounded-t-md bg-[#1B2980] dark:bg-indigo-500 opacity-80 transition-all"
                    style={{ height: `${Math.max(4, bucket.pct)}%` }}
                    title={`${bucket.label}: ${bucket.count} empleado(s)`}
                  />
                </div>
              ))}
            </div>
          )}
          {distribucion.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {distribucion.map(bucket => (
                <p key={bucket.label} className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {bucket.label}
                </p>
              ))}
            </div>
          )}
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
