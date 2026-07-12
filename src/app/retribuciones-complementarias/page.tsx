'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { formatRD, fullName } from '@/lib/utils'
import { Landmark, Percent, CalendarClock, Plus, Trash2, Info, Download } from 'lucide-react'

// Impuesto Sustitutivo sobre Retribuciones Complementarias — guía oficial DGII
const TASA_IMPUESTO_SUSTITUTIVO = 0.27

// Categorías genéricas de beneficios en especie más comunes en la práctica dominicana
const CATEGORIAS_RETRIBUCION = [
  'Vehículo de la empresa',
  'Vivienda',
  'Colegios / Educación',
  'Otros beneficios en especie',
] as const

interface LineaRetribucion {
  id: string
  concepto: string
  valorMensual: number
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 tabular-nums focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'

export default function RetribucionesComplementariasPage() {
  const { empleadosActivos } = useEmpleados()
  const { empresa } = useEmpresa()

  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [lineas, setLineas] = useState<LineaRetribucion[]>([])
  const [concepto, setConcepto] = useState<string>(CATEGORIAS_RETRIBUCION[0])
  const [valorMensual, setValorMensual] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)

  const empleado = useMemo(
    () => empleadosActivos.find(e => e.id === empleadoId),
    [empleadosActivos, empleadoId]
  )

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(valorMensual) || 0
    if (valor <= 0) return
    setLineas(prev => [
      ...prev,
      { id: `retribucion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, concepto, valorMensual: valor },
    ])
    setValorMensual('')
  }

  function handleEliminar(id: string) {
    setLineas(prev => prev.filter(l => l.id !== id))
  }

  const totalMensual = lineas.reduce((s, l) => s + l.valorMensual, 0)
  const impuestoMensual = totalMensual * TASA_IMPUESTO_SUSTITUTIVO
  const impuestoAnualizado = impuestoMensual * 12

  // Exporta las líneas ingresadas (valores ya calculados en pantalla) más un
  // resumen del Impuesto Sustitutivo — mensual y anualizado de referencia —
  // en una segunda hoja, ya que "totales" solo admite una fila.
  async function handleExportarExcel() {
    if (lineas.length === 0) return
    const { exportarExcel } = await import('@/lib/excel-export')
    const filas = lineas.map(l => [l.concepto, l.valorMensual, l.valorMensual * TASA_IMPUESTO_SUSTITUTIVO])
    const subtitulo = empleado
      ? `Beneficiario de referencia: ${fullName(empleado)}`
      : 'Sin beneficiario asignado — cálculo general'
    await exportarExcel({
      nombreArchivo: `retribuciones-complementarias-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [
        {
          nombre: 'Detalle',
          titulo: 'Retribuciones Complementarias',
          subtitulo,
          encabezados: ['Concepto', 'Valor Mensual (RD$)', 'Impuesto Sustitutivo 27%'],
          filas,
          totales: [`TOTAL — ${lineas.length} concepto(s)`, totalMensual, impuestoMensual],
          anchos: [30, 20, 22],
        },
        {
          nombre: 'Resumen',
          titulo: 'Resumen del Impuesto Sustitutivo',
          subtitulo: 'Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII',
          encabezados: ['Concepto', 'Monto (RD$)'],
          filas: [
            ['Suma Total Mensual', totalMensual],
            ['Impuesto Sustitutivo 27% Mensual', impuestoMensual],
            ['Impuesto Anualizado (referencia)', impuestoAnualizado],
          ],
          anchos: [34, 20],
        },
      ],
    })
    setToast('Retribuciones complementarias exportadas a Excel')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Retribuciones Complementarias"
        subtitle="Impuesto Sustitutivo 27% · Guía DGII"
        actions={
          <button
            onClick={handleExportarExcel}
            disabled={lineas.length === 0}
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
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Retribuciones Complementarias del Mes</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Registre el valor mensual de cada beneficio en especie otorgado (vehículo, vivienda, colegios, etc.)
              para calcular el Impuesto Sustitutivo que asume la empresa.
            </p>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="max-w-sm space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Empleado beneficiario (opcional)
              </label>
              <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} className={INPUT_CLASS}>
                <option value="">— General / sin asignar —</option>
                {empleadosActivos.map(e => (
                  <option key={e.id} value={e.id}>{fullName(e)} — {e.cargo}</option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Solo es de referencia interna: el Impuesto Sustitutivo lo paga la empresa y no cambia según quién
                reciba el beneficio.
              </p>
            </div>

            <form onSubmit={handleAgregar} className="flex flex-col gap-2 sm:flex-row sm:items-end border-t border-zinc-100 dark:border-[#1d2035] pt-4">
              <div className="flex-[2] space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Concepto
                </label>
                <select value={concepto} onChange={e => setConcepto(e.target.value)} className={INPUT_CLASS}>
                  {CATEGORIAS_RETRIBUCION.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Valor Mensual (RD$)
                </label>
                <input
                  type="number"
                  min="0"
                  value={valorMensual}
                  onChange={e => setValorMensual(e.target.value)}
                  placeholder="0.00"
                  className={INPUT_CLASS}
                />
              </div>
              <button
                type="submit"
                disabled={!(parseFloat(valorMensual) > 0)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </form>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Retribuciones (Mensual)"
            value={formatRD(totalMensual)}
            sub={`${lineas.length} concepto(s) registrado(s)`}
            icon={Landmark}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Impuesto Sustitutivo (27%)"
            value={formatRD(impuestoMensual)}
            sub="Sobre el valor mensual de los beneficios"
            icon={Percent}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="Impuesto Anualizado (referencia)"
            value={formatRD(impuestoAnualizado)}
            sub="Impuesto mensual × 12 — para presupuesto"
            icon={CalendarClock}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Detalle de Retribuciones Complementarias</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {empleado ? `Beneficiario de referencia: ${fullName(empleado)}` : 'Sin beneficiario asignado — cálculo general'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concepto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Mensual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Impuesto Sustitutivo (27%)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <Landmark className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                          Sin retribuciones registradas
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                          Agregue arriba el valor mensual de cada beneficio en especie (vehículo, vivienda, colegios,
                          etc.) para calcular el Impuesto Sustitutivo.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {lineas.map(l => (
                  <tr key={l.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[#1B2980] dark:text-indigo-400">{l.concepto}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(l.valorMensual)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(l.valorMensual * TASA_IMPUESTO_SUSTITUTIVO)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleEliminar(l.id)}
                        className="rounded-lg p-1.5 text-zinc-300 dark:text-zinc-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {lineas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                    <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                      TOTAL — {lineas.length} concepto(s)
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-600 dark:text-zinc-400">
                      {formatRD(totalMensual)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#1B2980] dark:text-indigo-300">
                      {formatRD(impuestoMensual)}
                    </td>
                    <td></td>
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
              <p className="font-semibold">Impuesto Sustitutivo sobre Retribuciones Complementarias — DGII, República Dominicana</p>
              <p>
                Las <strong>Retribuciones Complementarias</strong> son beneficios en especie que el empleador otorga
                a determinados empleados (típicamente ejecutivos) además de su salario — uso de vehículo de la
                empresa, vivienda, colegios u otros beneficios similares. La DGII grava el valor de estos beneficios
                con un <strong>Impuesto Sustitutivo del 27%</strong> que <strong>paga la empresa</strong>, en lugar de
                sumarlos al salario del empleado y tributar el ISR progresivo normal.
              </p>
              <p>
                Este impuesto <strong>no se descuenta al empleado ni se combina con el ISR regular de su salario</strong> —
                es una obligación tributaria independiente de la empresa sobre el valor de las retribuciones
                complementarias otorgadas. Consulte la guía oficial de la DGII (dgii.gov.do) para confirmar el
                tratamiento aplicable a cada tipo de beneficio antes de declarar.
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
