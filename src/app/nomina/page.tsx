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
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
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
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between rounded-t-2xl bg-zinc-950 px-6 py-5 text-white">
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

        <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-100">
          {/* Devengos */}
          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600">Devengos</p>
            <div className="space-y-2">
              {[
                { label: 'Salario Básico',     value: nomina.salarioBruto },
                { label: 'H.E. 35% Recargo',  value: nomina.importeHE35,    hide: nomina.importeHE35 === 0 },
                { label: 'H.E. 100% Recargo', value: nomina.importeHE100,   hide: nomina.importeHE100 === 0 },
                { label: 'Bonificaciones',     value: nomina.bonificaciones, hide: nomina.bonificaciones === 0 },
                { label: 'Comisiones',         value: nomina.comisiones,     hide: nomina.comisiones === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-zinc-600">{row.label}</span>
                  <span className="tabular-nums font-medium text-zinc-900">{formatRD(row.value)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800">Total Bruto</span>
                <span className="text-emerald-700 tabular-nums">{formatRD(nomina.totalBruto)}</span>
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
                  <span className="text-zinc-600">{row.label}</span>
                  <span className="tabular-nums font-medium text-rose-700">({formatRD(row.value)})</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 pt-2 flex justify-between font-semibold text-sm">
                <span className="text-zinc-800">Total Descuentos</span>
                <span className="text-rose-700 tabular-nums">({formatRD(nomina.totalDescuentos)})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Neto + Costo empleador */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 bg-zinc-50 p-6 rounded-b-2xl">
          <div className="rounded-xl bg-white border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Salario Neto a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-teal-700 tabular-nums">{formatRD(nomina.salarioNeto, 0)}</p>
          </div>
          <div className="rounded-xl bg-white border border-zinc-200 p-4 space-y-1.5">
            <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wide mb-2">Aportes Empresa (TSS)</p>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">AFP Empleador (7.10%)</span>
              <span className="tabular-nums font-medium">{formatRD(nomina.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">SFS Empleador (7.09%)</span>
              <span className="tabular-nums font-medium">{formatRD(nomina.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">SRL Empleador</span>
              <span className="tabular-nums font-medium">{formatRD(nomina.srlEmpleador)}</span>
            </div>
            <div className="border-t border-zinc-100 pt-1.5 flex justify-between text-xs font-bold">
              <span>Costo Total Empresa</span>
              <span className="text-amber-700 tabular-nums">{formatRD(nomina.totalCostoEmpleador)}</span>
            </div>
          </div>
        </div>

        {/* Provisiones y pie legal */}
        <div className="border-t border-zinc-100 px-6 py-4 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-zinc-500">
            <span>Regalía/mes: <strong className="text-zinc-800">{formatRD(nomina.regaliaPascual, 0)}</strong></span>
            <span>Vacaciones/mes: <strong className="text-zinc-800">{nomina.vacacionesMensualesDias.toFixed(2)} días</strong></span>
          </div>
          <p className="text-[10px] text-zinc-400 text-right">
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

  const nominas = EMPLEADOS_ACTIVOS.map(e => ({
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
            <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Download className="h-4 w-4" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Selector de período */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-zinc-600">Período:</span>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
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
            iconColor="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Total Neto"
            value={formatRD(totales.neto, 0)}
            sub="A transferir empleados"
            icon={BarChart3}
            iconColor="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="Aportes TSS Empresa"
            value={formatRD(totales.aportes, 0)}
            sub="AFP + SFS + SRL"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="ISR Retenido"
            value={formatRD(totales.isr, 0)}
            sub="Por remitir a DGII"
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Tabla principal */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Detalle por Empleado — {periodo}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Info className="h-3.5 w-3.5" />
              Haz clic en una fila para ver el comprobante completo
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">S. Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">AFP Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">SFS Emp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">ISR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">T. Desc.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 bg-teal-50">S. Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Costo Emp.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {nominas.map(({ empleado, resultado }) => (
                  <tr
                    key={empleado.id}
                    className="hover:bg-teal-50/30 transition-colors cursor-pointer"
                    onClick={() => setDetalle({ emp: empleado, nom: resultado })}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500">{empleado.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-900">
                      {formatRD(resultado.totalBruto, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700">
                      {formatRD(resultado.afpEmpleado, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-700">
                      {formatRD(resultado.sfsEmpleado, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-violet-700">
                      {formatRD(resultado.isrMensual, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-rose-800 font-medium">
                      {formatRD(resultado.totalDescuentos, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-teal-700 bg-teal-50/60">
                      {formatRD(resultado.salarioNeto, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-amber-700">
                      {formatRD(resultado.totalCostoEmpleador, 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totales */}
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-950 text-white">
                  <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">
                    TOTALES — {nominas.length} empleados
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
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-teal-500 shrink-0" />
            <div className="text-xs text-teal-700 space-y-0.5">
              <p className="font-semibold">Normativa aplicada en este cálculo</p>
              <p>AFP 2.87% empleado / 7.10% empleador · SFS 3.04% empleado / 7.09% empleador · SRL 1.10% empleador (riesgo bajo)</p>
              <p>ISR retención según tramos DGII vigentes · Tope TSS: RD$ 420,000 (20 × salario mínimo grandes empresas)</p>
              <p>Ley 16-92 (Código de Trabajo) · Ley 87-01 (Seguridad Social) · Ley 11-92 (Impuesto sobre la Renta) · República Dominicana</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm" />
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
