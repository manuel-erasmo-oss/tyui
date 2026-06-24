'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { calcularNomina } from '@/lib/dominican-labor'
import {
  formatRD,
  formatPeriodo,
  fullName,
} from '@/lib/utils'
import type { Empleado, ResultadoNomina } from '@/types'
import { Wallet, TrendingUp, Receipt, BarChart3 } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const hoy = new Date()

function DetalleNomina({
  empleado,
  nomina,
  onClose,
}: {
  empleado: Empleado
  nomina: ResultadoNomina
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between rounded-t-2xl bg-zinc-950 dark:bg-[#080a12] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Comprobante de Nómina</p>
            <p className="mt-1 text-lg font-bold">{fullName(empleado)}</p>
            <p className="text-sm text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-100 dark:divide-[#1d2035]">
          {/* Devengos */}
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Devengos</p>
            <div className="space-y-2">
              {[
                { label: 'Salario Básico',     value: nomina.salarioBruto },
                { label: 'H.E. 35% Recargo',  value: nomina.importeHE35,    hide: nomina.importeHE35 === 0 },
                { label: 'H.E. 100% Recargo', value: nomina.importeHE100,   hide: nomina.importeHE100 === 0 },
                { label: 'Bonificaciones',     value: nomina.bonificaciones, hide: nomina.bonificaciones === 0 },
                { label: 'Comisiones',         value: nomina.comisiones,     hide: nomina.comisiones === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{formatRD(row.value)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Bruto</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{formatRD(nomina.totalBruto)}</span>
              </div>
            </div>
          </div>

          {/* Descuentos */}
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-600">Descuentos</p>
            <div className="space-y-2">
              {[
                { label: `AFP Empleado (2.87%)`,  value: nomina.afpEmpleado },
                { label: `SFS Empleado (3.04%)`,  value: nomina.sfsEmpleado },
                { label: `ISR Retención`,          value: nomina.isrMensual },
                { label: `Otros Descuentos`,       value: nomina.otrosDescuentos, hide: nomina.otrosDescuentos === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
                  <span className="tabular-nums font-medium text-rose-700 dark:text-rose-400">({formatRD(row.value)})</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">Total Descuentos</span>
                <span className="text-rose-700 dark:text-rose-400 tabular-nums">({formatRD(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Neto + Costo empleador */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] p-6 rounded-b-2xl">
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide">Salario Neto a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-[#151f66] dark:text-indigo-300 tabular-nums">{formatRD(nomina.salarioNeto, 0)}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#141722] border border-zinc-200 dark:border-[#252840] p-4 space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wide mb-2">Aportes Empresa (TSS)</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">AFP Empleador (7.10%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SFS Empleador (7.09%)</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">SRL Empleador</span>
              <span className="tabular-nums font-medium dark:text-zinc-200">{formatRD(nomina.srlEmpleador)}</span>
            </div>
            <div className="border-t border-zinc-100 dark:border-[#1d2035] pt-1.5 flex justify-between text-xs font-bold">
              <span className="dark:text-zinc-200">Costo Total Empresa</span>
              <span className="text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(nomina.totalCostoEmpleador)}</span>
            </div>
          </div>
        </div>

        {/* Provisiones y pie legal */}
        <div className="border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Regalía/mes: <strong className="text-zinc-800 dark:text-zinc-200">{formatRD(nomina.regaliaPascual, 0)}</strong></span>
            <span>Vacaciones/mes: <strong className="text-zinc-800 dark:text-zinc-200">{nomina.vacacionesMensualesDias.toFixed(2)} días</strong></span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">
            Ley 16-92 · Ley 87-01 · Ley 11-92 · DGII / CNSS
          </p>
        </div>
      </div>
    </div>
  )
}

export default function NominaPage() {
  const [mes, setMes]   = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [detalle, setDetalle] = useState<{ emp: Empleado; nom: ResultadoNomina } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { empleadosActivos } = useEmpleados()

  const nominas = empleadosActivos.map(e => ({
    empleado: e,
    resultado: calcularNomina(e),
  }))

  const totales = {
    bruto:        nominas.reduce((s, n) => s + n.resultado.totalBruto, 0),
    descuentos:   nominas.reduce((s, n) => s + n.resultado.totalDescuentos, 0),
    neto:         nominas.reduce((s, n) => s + n.resultado.salarioNeto, 0),
    aportes:      nominas.reduce((s, n) => s + n.resultado.totalAportesEmpleador, 0),
    isr:          nominas.reduce((s, n) => s + n.resultado.isrMensual, 0),
    costoTotal:   nominas.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  const periodo = formatPeriodo(anio, mes)
  const anios   = [anio - 1, anio, anio + 1]

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Procesar Nómina"
        subtitle={`Período: ${periodo}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setToast('Preparando documento para imprimir…')}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              onClick={() => setToast('Nómina exportada correctamente')}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Selector de período */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-3 shadow-sm dark:shadow-none">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Período:</span>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-1.5 text-sm focus:border-[#1B2980] focus:outline-none"
          >
            {anios.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Calculada
          </Badge>
        </div>

        {/* KPIs nómina */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Bruto"
            value={formatRD(totales.bruto, 0)}
            sub="Suma devengados"
            icon={Wallet}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatCard
            label="Total Neto"
            value={formatRD(totales.neto, 0)}
            sub="A transferir empleados"
            icon={BarChart3}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Aportes TSS Empresa"
            value={formatRD(totales.aportes, 0)}
            sub="AFP + SFS + SRL"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="ISR Retenido"
            value={formatRD(totales.isr, 0)}
            sub="Por remitir a DGII"
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          />
        </div>

        {/* Tabla principal */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle por Empleado — {periodo}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Info className="h-3.5 w-3.5" />
              Haz clic en una fila para ver el comprobante completo
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">S. Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AFP Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">SFS Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ISR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">T. Desc.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 bg-[#eef0fb] dark:bg-indigo-950/40">S. Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Costo Emp.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {nominas.map(({ empleado, resultado }) => (
                  <tr
                    key={empleado.id}
                    className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                    onClick={() => setDetalle({ emp: empleado, nom: resultado })}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d5d9f4] dark:bg-indigo-900/40 text-xs font-bold text-[#151f66] dark:text-indigo-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{empleado.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {formatRD(resultado.totalBruto, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">
                      {formatRD(resultado.afpEmpleado, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">
                      {formatRD(resultado.sfsEmpleado, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-violet-700 dark:text-violet-400">
                      {formatRD(resultado.isrMensual, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-800 dark:text-rose-400 font-medium">
                      {formatRD(resultado.totalDescuentos, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#151f66] dark:text-indigo-300 bg-[#eef0fb]/60 dark:bg-indigo-950/30">
                      {formatRD(resultado.salarioNeto, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {formatRD(resultado.totalCostoEmpleador, 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totales */}
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-[#252840] bg-zinc-950 dark:bg-[#0a0c14] text-white">
                  <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">
                    TOTALES — {empleadosActivos.length} empleados
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold">
                    {formatRD(totales.bruto, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300">
                    {formatRD(nominas.reduce((s,n) => s + n.resultado.afpEmpleado, 0), 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300">
                    {formatRD(nominas.reduce((s,n) => s + n.resultado.sfsEmpleado, 0), 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-violet-300">
                    {formatRD(totales.isr, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-300 font-semibold">
                    {formatRD(totales.descuentos, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-indigo-300">
                    {formatRD(totales.neto, 0)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-amber-300 font-bold">
                    {formatRD(totales.costoTotal, 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Nota legal */}
        <div className="rounded-xl border border-teal-100 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
            <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-0.5">
              <p className="font-semibold">Normativa aplicada en este cálculo</p>
              <p>AFP 2.87% empleado / 7.10% empleador · SFS 3.04% empleado / 7.09% empleador · SRL 1.10% empleador (riesgo bajo)</p>
              <p>ISR retención según tramos DGII vigentes · Tope TSS: RD$ 420,000 (20 × salario mínimo grandes empresas)</p>
              <p>Ley 16-92 (Código de Trabajo) · Ley 87-01 (Seguridad Social) · Ley 11-92 (Impuesto sobre la Renta) · República Dominicana</p>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Modal detalle */}
      {detalle && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm" />
          <DetalleNomina
            empleado={detalle.emp}
            nomina={detalle.nom}
            onClose={() => setDetalle(null)}
          />
        </>
      )}
    </div>
  )
}
