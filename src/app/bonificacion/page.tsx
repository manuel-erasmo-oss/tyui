'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { getAnosServicio } from '@/lib/dominican-labor'
import { formatRD, formatAnosServicio, fullName } from '@/lib/utils'
import { Percent, Users, Banknote, Info, Download } from 'lucide-react'

// Tarifa diaria estándar del sistema (salario mensual / 23.83 días)
const DIAS_MES = 23.83

export default function BonificacionPage() {
  const { empleadosActivos } = useEmpleados()
  const { empresa } = useEmpresa()
  const [utilidadNeta, setUtilidadNeta] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)

  const utilidad = parseFloat(utilidadNeta) || 0
  const distribuible = utilidad * 0.10

  // Elegibles: empleados de tiempo indefinido (fijo)
  const elegibles = useMemo(
    () => empleadosActivos.filter(e => e.tipoContrato === 'fijo'),
    [empleadosActivos]
  )

  const totalSalarios = elegibles.reduce((s, e) => s + e.salarioBase, 0)

  const filas = useMemo(() => {
    return elegibles.map(e => {
      const anos = getAnosServicio(e.fechaIngreso)
      const diasTope = anos >= 3 ? 60 : 45
      const salarioDiario = e.salarioBase / DIAS_MES
      const topeIndividual = diasTope * salarioDiario
      const proporcional = totalSalarios > 0 ? (e.salarioBase / totalSalarios) * distribuible : 0
      const montoFinal = Math.min(proporcional, topeIndividual)
      const topeAplicado = proporcional > topeIndividual
      return { empleado: e, anos, diasTope, salarioDiario, topeIndividual, proporcional, montoFinal, topeAplicado }
    }).sort((a, b) => b.montoFinal - a.montoFinal)
  }, [elegibles, totalSalarios, distribuible])

  const totalRepartido = filas.reduce((s, f) => s + f.montoFinal, 0)
  const empleadosConTope = filas.filter(f => f.topeAplicado).length

  // Exporta el cálculo de bonificación tal como está en pantalla — mismas
  // filas ya calculadas (proporcional al salario, con el tope de 45/60 días
  // ya aplicado), no un recálculo aparte.
  async function handleExportarExcel() {
    if (filas.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasExcel = filas.map(({ empleado, anos, diasTope, proporcional, montoFinal }) => [
      fullName(empleado),
      formatAnosServicio(anos),
      empleado.salarioBase,
      diasTope,
      proporcional,
      montoFinal,
    ])
    await exportarExcel({
      nombreArchivo: `bonificacion-utilidades-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Bonificación',
        titulo: 'Bonificación por Participación en Utilidades',
        subtitulo: `Art. 223 · Utilidad Neta: ${formatRD(utilidad)} · 10% Distribuible: ${formatRD(distribuible)}`,
        encabezados: ['Empleado', 'Antigüedad', 'Salario Base', 'Tope (días)', 'Proporcional', 'Monto a Pagar'],
        filas: filasExcel,
        totales: [
          `TOTAL — ${filas.length} empleado(s)`, '', '',
          '', filas.reduce((s, f) => s + f.proporcional, 0), totalRepartido,
        ],
        anchos: [26, 16, 16, 14, 16, 18],
        columnasEnteras: [3],
      }],
    })
    setToast('Bonificación por utilidades exportada a Excel')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Bonificación por Utilidades"
        subtitle="Art. 223 · Código de Trabajo · Ley 16-92"
        actions={
          <button
            onClick={handleExportarExcel}
            disabled={filas.length === 0}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* ── Input card ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Utilidad Neta Anual</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Ingrese la utilidad neta anual de la empresa para calcular el 10% distribuible entre los empleados
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="max-w-xs space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Utilidad Neta Anual (RD$)
              </label>
              <input
                type="number"
                min="0"
                value={utilidadNeta}
                onChange={e => setUtilidadNeta(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="10% Distribuible"
            value={formatRD(distribuible)}
            sub="Utilidad neta × 10% (Art. 223)"
            icon={Percent}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Total a Repartir"
            value={formatRD(totalRepartido)}
            sub={`${filas.length} empleado(s) de tiempo indefinido`}
            icon={Banknote}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Empleados con Tope Aplicado"
            value={`${empleadosConTope} / ${filas.length}`}
            sub="45 días (menos de 3 años) · 60 días (3+ años)"
            icon={Users}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Distribución por Empleado</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Reparto proporcional al salario, respetando el tope individual de 45 días (menos de 3 años) o 60 días (3+ años) de salario diario.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Base</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tope (días)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Proporcional</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <Percent className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                          {empleadosActivos.length === 0 ? 'Sin empleados activos' : 'Sin empleados elegibles'}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                          {empleadosActivos.length === 0
                            ? 'Registra empleados en la sección de Empleados para calcular la bonificación.'
                            : 'Solo los empleados de contrato Fijo (tiempo indefinido) tienen derecho a esta bonificación.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.map(({ empleado, anos, diasTope, topeIndividual, proporcional, montoFinal, topeAplicado }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef0fb] dark:bg-indigo-900/40 text-xs font-bold text-[#1B2980] dark:text-indigo-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-[#1B2980] dark:text-indigo-400">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">{empleado.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatRD(empleado.salarioBase)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {diasTope} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(proporcional)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#1B2980] dark:text-indigo-300">
                      <div className="flex items-center justify-end gap-1.5">
                        {formatRD(montoFinal)}
                        {topeAplicado && <Badge variant="warning">Tope</Badge>}
                      </div>
                      {topeAplicado && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">
                          Tope: {formatRD(topeIndividual)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={4} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                    TOTAL — {filas.length} empleado(s)
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-600 dark:text-zinc-400">
                    {formatRD(filas.reduce((s, f) => s + f.proporcional, 0))}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                    {formatRD(totalRepartido)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Legal note ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1">
              <p className="font-semibold">Art. 223 — Código de Trabajo, República Dominicana</p>
              <p>
                El empleador debe repartir el <strong>10% de sus utilidades netas anuales</strong> entre los empleados
                de tiempo indefinido, con un tope individual de <strong>45 días de salario</strong> (empleados con menos
                de 3 años en la empresa) o <strong>60 días de salario</strong> (empleados con 3 años o más de antigüedad).
                Esta bonificación es distinta de la Regalía Pascual (Art. 219).
              </p>
            </div>
          </div>
        </div>

      </div>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  )
}
