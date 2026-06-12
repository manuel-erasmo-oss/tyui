'use client'

import { useState } from 'react'
import { Download, FileText, Info } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { EMPLEADOS_ACTIVOS } from '@/lib/mock-data'
import { calcularNomina } from '@/lib/dominican-labor'
import { formatRD, formatPeriodo, formatCedula, fullName } from '@/lib/utils'
import { Receipt, TrendingUp, Wallet, BarChart3 } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const hoy = new Date()

type ReporteTab = 'tss' | 'isr' | 'resumen'

export default function ReportesPage() {
  const [mes, setMes]   = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [tab, setTab]   = useState<ReporteTab>('tss')

  const nominas = EMPLEADOS_ACTIVOS.map(e => ({
    empleado: e,
    resultado: calcularNomina(e),
  }))

  const totales = {
    bruto:          nominas.reduce((s, n) => s + n.resultado.totalBruto, 0),
    afpEmpleado:    nominas.reduce((s, n) => s + n.resultado.afpEmpleado, 0),
    sfsEmpleado:    nominas.reduce((s, n) => s + n.resultado.sfsEmpleado, 0),
    afpEmpleador:   nominas.reduce((s, n) => s + n.resultado.afpEmpleador, 0),
    sfsEmpleador:   nominas.reduce((s, n) => s + n.resultado.sfsEmpleador, 0),
    srl:            nominas.reduce((s, n) => s + n.resultado.srlEmpleador, 0),
    isr:            nominas.reduce((s, n) => s + n.resultado.isrMensual, 0),
    regalia:        nominas.reduce((s, n) => s + n.resultado.regaliaPascual, 0),
    costoTotal:     nominas.reduce((s, n) => s + n.resultado.totalCostoEmpleador, 0),
  }

  const totalTSSEmpleado   = totales.afpEmpleado + totales.sfsEmpleado
  const totalTSSEmpleador  = totales.afpEmpleador + totales.sfsEmpleador + totales.srl
  const totalTSS           = totalTSSEmpleado + totalTSSEmpleador

  const periodo = formatPeriodo(anio, mes)

  const TABS: { id: ReporteTab; label: string }[] = [
    { id: 'tss',     label: 'Reporte TSS (CNSS)' },
    { id: 'isr',     label: 'Retención ISR (DGII)' },
    { id: 'resumen', label: 'Resumen General' },
  ]

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Reportes"
        subtitle={`Período: ${periodo}`}
        actions={
          <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
            <Download className="h-4 w-4" />
            Exportar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Selector período */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-zinc-600">Período:</span>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
          >
            {MESES.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
          >
            {[anio-1, anio, anio+1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total TSS"
            value={formatRD(totalTSS, 0)}
            sub="Empleado + Empleador"
            icon={TrendingUp}
            iconColor="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="TSS Empleado"
            value={formatRD(totalTSSEmpleado, 0)}
            sub="AFP + SFS descontado"
            icon={Wallet}
            iconColor="bg-rose-50 text-rose-600"
          />
          <StatCard
            label="TSS Empleador"
            value={formatRD(totalTSSEmpleador, 0)}
            sub="AFP + SFS + SRL empresa"
            icon={BarChart3}
            iconColor="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="ISR Retenido"
            value={formatRD(totales.isr, 0)}
            sub="Por remitir DGII día 10"
            icon={Receipt}
            iconColor="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Tabs */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex border-b border-zinc-100">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t.id
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <FileText className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* TSS Tab */}
          {tab === 'tss' && (
            <div>
              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-700">Formulario TSS — Nómina Mensual</p>
                  <p className="text-[11px] text-zinc-500">Para remisión a la Tesorería de la Seguridad Social (CNSS) · Ley 87-01</p>
                </div>
                <Badge variant="info">Período: {periodo}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cédula</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">S. Cotizable</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">AFP Emp</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">AFP Empr</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">SFS Emp</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">SFS Empr</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">SRL</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total TSS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {nominas.map(({ empleado, resultado }) => {
                      const totalTSSFila = resultado.afpEmpleado + resultado.sfsEmpleado +
                        resultado.afpEmpleador + resultado.sfsEmpleador + resultado.srlEmpleador
                      return (
                        <tr key={empleado.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-900">{fullName(empleado)}</p>
                            <p className="text-[11px] text-zinc-500">{empleado.cargo}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                            {formatCedula(empleado.cedula)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                            {formatRD(resultado.salarioCotizable, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                            {formatRD(resultado.afpEmpleado, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                            {formatRD(resultado.afpEmpleador, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                            {formatRD(resultado.sfsEmpleado, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                            {formatRD(resultado.sfsEmpleador, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                            {formatRD(resultado.srlEmpleador, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">
                            {formatRD(totalTSSFila, 0)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 bg-zinc-950 text-white font-bold">
                      <td colSpan={3} className="px-5 py-3 text-xs uppercase tracking-wide">TOTALES</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-300">{formatRD(totales.afpEmpleado, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-300">{formatRD(totales.afpEmpleador, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-300">{formatRD(totales.sfsEmpleado, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-300">{formatRD(totales.sfsEmpleador, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-300">{formatRD(totales.srl, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-indigo-300">{formatRD(totalTSS, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ISR Tab */}
          {tab === 'isr' && (
            <div>
              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-700">Retención ISR — Asalariados</p>
                  <p className="text-[11px] text-zinc-500">Para remisión a la DGII · Art. 309 Ley 11-92 · Vencimiento: día 10 del mes siguiente</p>
                </div>
                <Badge variant="info">Período: {periodo}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cédula</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Salario Bruto</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">AFP+SFS Ded.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Base Gravable</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Base Anual</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Tramo ISR</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">ISR Mensual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {nominas.map(({ empleado, resultado }) => {
                      const afpSfs       = resultado.afpEmpleado + resultado.sfsEmpleado
                      const baseGravable = resultado.totalBruto - afpSfs
                      const baseAnual    = baseGravable * 12
                      const tramo =
                        baseAnual <= 416_220 ? 'Exento (0%)' :
                        baseAnual <= 624_329 ? 'Tramo II (15%)' :
                        baseAnual <= 867_123 ? 'Tramo III (20%)' : 'Tramo IV (25%)'

                      return (
                        <tr key={empleado.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-900">{fullName(empleado)}</p>
                            <p className="text-[11px] text-zinc-500">{empleado.cargo}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                            {formatCedula(empleado.cedula)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                            {formatRD(resultado.totalBruto, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                            ({formatRD(afpSfs, 0)})
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                            {formatRD(baseGravable, 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-500 text-xs">
                            {formatRD(baseAnual, 0)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                              resultado.isrMensual === 0
                                ? 'bg-zinc-50 text-zinc-600 ring-zinc-200'
                                : resultado.isrMensual < 3000
                                ? 'bg-sky-50 text-sky-700 ring-sky-200'
                                : resultado.isrMensual < 8000
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-rose-50 text-rose-700 ring-rose-200'
                            }`}>
                              {tramo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-violet-700">
                            {formatRD(resultado.isrMensual)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 bg-zinc-950 text-white font-bold">
                      <td colSpan={7} className="px-5 py-3 text-xs uppercase tracking-wide">TOTAL ISR A REMITIR — {periodo}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-violet-300">{formatRD(totales.isr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Resumen Tab */}
          {tab === 'resumen' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Costos empresa */}
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">Costo Total Empresa</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Salarios Brutos',        value: totales.bruto,                  color: 'text-zinc-900' },
                      { label: 'AFP Empleador (7.10%)',   value: totales.afpEmpleador,            color: 'text-amber-700' },
                      { label: 'SFS Empleador (7.09%)',   value: totales.sfsEmpleador,            color: 'text-amber-700' },
                      { label: 'SRL Empleador (1.10%)',   value: totales.srl,                     color: 'text-amber-700' },
                      { label: 'Total TSS Empleador',     value: totalTSSEmpleador,               color: 'text-amber-800', bold: true },
                      { label: 'Provisión Regalía',       value: totales.regalia,                 color: 'text-emerald-700' },
                    ].map(r => (
                      <div key={r.label} className={`flex items-center justify-between py-2 ${r.bold ? 'border-t border-zinc-200 font-semibold' : ''}`}>
                        <span className="text-sm text-zinc-600">{r.label}</span>
                        <span className={`text-sm tabular-nums font-medium ${r.color}`}>{formatRD(r.value, 0)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-lg bg-zinc-950 text-white px-4 py-3 mt-2">
                      <span className="text-sm font-semibold">Costo Total Empresa</span>
                      <span className="text-sm font-bold tabular-nums">{formatRD(totales.costoTotal, 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Obligaciones fiscales */}
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">Obligaciones a Remitir</h3>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-amber-800">TSS — CNSS</p>
                          <p className="text-[11px] text-amber-600">Ley 87-01 · Vence día 10</p>
                        </div>
                        <p className="text-lg font-bold text-amber-900 tabular-nums">{formatRD(totalTSS, 0)}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-white/70 px-2 py-1.5 text-center">
                          <p className="text-amber-600">Descuento empleados</p>
                          <p className="font-bold text-amber-900">{formatRD(totalTSSEmpleado, 0)}</p>
                        </div>
                        <div className="rounded bg-white/70 px-2 py-1.5 text-center">
                          <p className="text-amber-600">Aporte empleador</p>
                          <p className="font-bold text-amber-900">{formatRD(totalTSSEmpleador, 0)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-violet-800">ISR Asalariados — DGII</p>
                          <p className="text-[11px] text-violet-600">Ley 11-92 Art. 309 · Vence día 10</p>
                        </div>
                        <p className="text-lg font-bold text-violet-900 tabular-nums">{formatRD(totales.isr, 0)}</p>
                      </div>
                      <p className="mt-2 text-[11px] text-violet-600">
                        Empleados gravados: {nominas.filter(n => n.resultado.isrMensual > 0).length} de {nominas.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-emerald-800">Provisión Regalía Pascual</p>
                          <p className="text-[11px] text-emerald-600">Art. 219 Código de Trabajo · Vence 20 dic</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-900 tabular-nums">{formatRD(totales.regalia, 0)}</p>
                      </div>
                      <p className="mt-2 text-[11px] text-emerald-600">
                        Acumulado mensual · Pago mínimo: 1 salario mensual por empleado
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nota legal */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 text-zinc-500 shrink-0" />
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Este reporte es informativo y fue generado automáticamente con base en la legislación dominicana vigente.
                  Para declaraciones formales, consulte siempre con un contador certificado y verifique las tasas actualizadas
                  en los portales de <strong>DGII</strong> (dgii.gov.do) y <strong>TSS</strong> (tss.gov.do).
                  Ley 16-92 · Ley 87-01 · Ley 11-92 y sus modificaciones.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
