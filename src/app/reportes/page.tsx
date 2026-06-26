'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  BarChart3, Users, FileText, CreditCard, Shield,
  Download, FileSpreadsheet, ChevronRight, Loader2,
  TrendingUp, Wallet, Building2, Receipt, AlertCircle,
  Calendar, Briefcase, Info,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos } from '@/lib/periodos-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { calcularNomina } from '@/lib/dominican-labor'
import {
  formatRD, formatDate, formatCedula, fullName,
  formatAnosServicio, contratoLabel,
} from '@/lib/utils'
import { exportarExcel } from '@/lib/excel-export'
import type { AjusteLinea, PeriodoNomina, Empresa } from '@/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [27, 41, 128]
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportId = 'gerencial' | 'nomina' | 'empleados' | 'prestamos' | 'tss'

interface SidebarItem {
  id: ReportId
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'gerencial',  label: 'Resumen Gerencial',      icon: BarChart3,     desc: 'KPIs y tendencias de nómina' },
  { id: 'nomina',     label: 'Nómina por Período',     icon: FileText,      desc: 'Detalle de nómina por período' },
  { id: 'empleados',  label: 'Listado de Empleados',   icon: Users,         desc: 'Plantilla y datos laborales' },
  { id: 'prestamos',  label: 'Reporte de Préstamos',   icon: CreditCard,    desc: 'Cartera de préstamos y saldos' },
  { id: 'tss',        label: 'TSS / IR-2',             icon: Shield,        desc: 'Aportes TSS y retención ISR' },
]

// ─── PDF Helper ───────────────────────────────────────────────────────────────
function pdfHeader(
  doc: jsPDF,
  empresa: Empresa,
  title: string,
  subtitle: string,
  landscape = true,
) {
  const pageW = landscape ? 297 : 210
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.nombre || 'Empresa', 14, 10)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`RNC: ${empresa.rnc || '—'}`, 14, 16)

  doc.setTextColor(...NAVY)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 31)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(subtitle, 14, 37)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-DO')}`, pageW - 14, 37, { align: 'right' })
}

function periodoLabel(p: PeriodoNomina): string {
  const mes = MESES[p.mes - 1]
  if (p.tipo === 'quincenal') return `${p.quincena}ª Quincena ${mes} ${p.anio}`
  return `${mes} ${p.anio}`
}

// ─── Reporte Gerencial ────────────────────────────────────────────────────────
function ReporteGerencial({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const activos = empleados.filter(e => e.activo)
  const ultimoPeriodo = [...periodos].sort((a, b) =>
    new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
  )[0]

  const kpis = useMemo(() => {
    if (!ultimoPeriodo) return null
    const t = ultimoPeriodo.totales
    return {
      empleados: activos.length,
      bruto:     t.bruto,
      neto:      t.neto,
      isr:       t.isr,
      aportes:   t.aportes,
      costo:     t.costoTotal,
    }
  }, [ultimoPeriodo, activos.length])

  const ultimos6 = useMemo(() =>
    [...periodos]
      .sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime())
      .slice(0, 6),
    [periodos]
  )

  function exportarPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Resumen Gerencial', 'Indicadores clave de nómina')

    // KPI table
    if (kpis) {
      autoTable(doc, {
        startY: 44,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total Empleados Activos', `${kpis.empleados}`],
          ['Nómina Bruta (último período)', formatRD(kpis.bruto, 0)],
          ['Nómina Neta (último período)', formatRD(kpis.neto, 0)],
          ['ISR Total Retenido', formatRD(kpis.isr, 0)],
          ['Aportes Empleador TSS', formatRD(kpis.aportes, 0)],
          ['Costo Total Empresa', formatRD(kpis.costo, 0)],
        ],
        theme: 'striped',
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
        tableWidth: 130,
      })
    }

    // Last 6 periods
    const after = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 44
    autoTable(doc, {
      startY: after + 12,
      head: [['Período', 'Empleados', 'Bruto', 'Descuentos', 'Neto', 'Costo Total']],
      body: ultimos6.map(p => [
        periodoLabel(p),
        `${p.totalEmpleados}`,
        formatRD(p.totales.bruto, 0),
        formatRD(p.totales.descuentos, 0),
        formatRD(p.totales.neto, 0),
        formatRD(p.totales.costoTotal, 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didDrawPage: (data) => {
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })

    doc.save('resumen-gerencial.pdf')
  }

  function exportarXlsx() {
    exportarExcel({
      nombreArchivo: 'resumen-gerencial',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [
        {
          nombre: 'KPIs',
          titulo: 'Resumen Gerencial — KPIs',
          encabezados: ['Indicador', 'Valor'],
          filas: kpis ? [
            ['Total Empleados Activos', kpis.empleados],
            ['Nómina Bruta (último período)', kpis.bruto],
            ['Nómina Neta (último período)', kpis.neto],
            ['ISR Total Retenido', kpis.isr],
            ['Aportes Empleador TSS', kpis.aportes],
            ['Costo Total Empresa', kpis.costo],
          ] : [],
          anchos: [40, 20],
        },
        {
          nombre: 'Últimos Períodos',
          titulo: 'Últimos 6 Períodos',
          encabezados: ['Período', 'Empleados', 'Bruto', 'Descuentos', 'Neto', 'Costo Total'],
          filas: ultimos6.map(p => [
            periodoLabel(p), p.totalEmpleados,
            p.totales.bruto, p.totales.descuentos, p.totales.neto, p.totales.costoTotal,
          ]),
          anchos: [30, 14, 18, 18, 18, 18],
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Resumen Gerencial"
        desc="Indicadores clave de la última nómina procesada y tendencia de los últimos 6 períodos."
        onPDF={exportarPDF}
        onExcel={exportarXlsx}
      />

      {!kpis ? (
        <EmptyState message="No hay períodos de nómina registrados aún." />
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <StatCard label="Empleados Activos"   value={`${kpis.empleados}`}       icon={Users}       iconColor="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" />
            <StatCard label="Nómina Bruta"        value={formatRD(kpis.bruto, 0)}   icon={Wallet}      iconColor="bg-zinc-100 text-zinc-700 dark:bg-[#1a1d2e] dark:text-zinc-300" />
            <StatCard label="Nómina Neta"         value={formatRD(kpis.neto, 0)}    icon={TrendingUp}  iconColor="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
            <StatCard label="ISR Retenido"        value={formatRD(kpis.isr, 0)}     icon={Receipt}     iconColor="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" />
            <StatCard label="Aportes Empleador"   value={formatRD(kpis.aportes, 0)} icon={Building2}   iconColor="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
            <StatCard label="Costo Total Empresa" value={formatRD(kpis.costo, 0)}   icon={Briefcase}   iconColor="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" />
          </div>

          {/* Historical table */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Histórico — Últimos 6 Períodos</p>
            </div>
            {ultimos6.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin períodos registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] text-left">
                      {['Período','Empleados','Bruto','Descuentos','Neto','Costo Total'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 last:text-right first:text-left text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {ultimos6.map((p, i) => (
                      <tr key={p.id} className={`hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors ${i === 0 ? 'font-medium' : ''}`}>
                        <td className="px-5 py-3">
                          <span className="text-zinc-900 dark:text-zinc-100">{periodoLabel(p)}</span>
                          {i === 0 && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50">Último</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{p.totalEmpleados}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(p.totales.bruto, 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatRD(p.totales.descuentos, 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatRD(p.totales.neto, 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400">{formatRD(p.totales.costoTotal, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Nómina por Período ───────────────────────────────────────────────
function ReporteNomina({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const sorted = useMemo(() =>
    [...periodos].sort((a, b) =>
      new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
    ), [periodos])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)

  const periodo = periodos.find(p => p.id === periodoId)

  const filas = useMemo(() => {
    if (!periodo || !generado) return []
    const activos = empleados.filter(e => e.activo)
    return activos.map(emp => {
      const ajustes: AjusteLinea[] = periodo.ajustesPorEmpleado?.[emp.id] ?? []
      const params = ajustesToParams(ajustes)
      const res = calcularNomina(emp, params)
      return { emp, res }
    })
  }, [periodo, generado, empleados])

  const totales = useMemo(() => filas.reduce((acc, { res }) => ({
    bruto:          acc.bruto          + res.totalBruto,
    afpEmp:         acc.afpEmp         + res.afpEmpleado,
    sfsEmp:         acc.sfsEmp         + res.sfsEmpleado,
    isr:            acc.isr            + res.isrMensual,
    descuentos:     acc.descuentos     + res.totalDescuentos,
    neto:           acc.neto           + res.salarioNeto,
    afpEmpl:        acc.afpEmpl        + res.afpEmpleador,
    sfsEmpl:        acc.sfsEmpl        + res.sfsEmpleador,
    srlEmpl:        acc.srlEmpl        + res.srlEmpleador,
    costo:          acc.costo          + res.totalCostoEmpleador,
  }), { bruto: 0, afpEmp: 0, sfsEmp: 0, isr: 0, descuentos: 0, neto: 0, afpEmpl: 0, sfsEmpl: 0, srlEmpl: 0, costo: 0 }), [filas])

  function generar() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setGenerado(true) }, 100)
  }

  function exportarPDF() {
    if (!periodo || filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Reporte de Nómina por Período', periodoLabel(periodo))

    autoTable(doc, {
      startY: 44,
      head: [['Nombre','Cargo','Bruto','AFP Emp.','SFS Emp.','ISR','Tot. Desc.','Neto','AFP Empl.','SFS Empl.','SRL','Costo Total']],
      body: filas.map(({ emp, res }) => [
        fullName(emp), emp.cargo,
        res.totalBruto.toFixed(2),
        res.afpEmpleado.toFixed(2),
        res.sfsEmpleado.toFixed(2),
        res.isrMensual.toFixed(2),
        res.totalDescuentos.toFixed(2),
        res.salarioNeto.toFixed(2),
        res.afpEmpleador.toFixed(2),
        res.sfsEmpleador.toFixed(2),
        res.srlEmpleador.toFixed(2),
        res.totalCostoEmpleador.toFixed(2),
      ]),
      foot: [[
        'TOTALES', '',
        totales.bruto.toFixed(2),
        totales.afpEmp.toFixed(2),
        totales.sfsEmp.toFixed(2),
        totales.isr.toFixed(2),
        totales.descuentos.toFixed(2),
        totales.neto.toFixed(2),
        totales.afpEmpl.toFixed(2),
        totales.sfsEmpl.toFixed(2),
        totales.srlEmpl.toFixed(2),
        totales.costo.toFixed(2),
      ]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 40 },
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
        5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
        11: { halign: 'right' },
      },
      didDrawPage: (data) => {
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })

    doc.save(`nomina-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportarXlsx() {
    if (!periodo || filas.length === 0) return
    exportarExcel({
      nombreArchivo: `nomina-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Nómina',
        titulo: 'Reporte de Nómina por Período',
        subtitulo: periodoLabel(periodo),
        encabezados: ['Nombre','Cargo','Bruto','AFP Emp.','SFS Emp.','ISR','Tot. Desc.','Neto','AFP Empl.','SFS Empl.','SRL','Costo Total'],
        filas: filas.map(({ emp, res }) => [
          fullName(emp), emp.cargo,
          res.totalBruto, res.afpEmpleado, res.sfsEmpleado, res.isrMensual,
          res.totalDescuentos, res.salarioNeto, res.afpEmpleador, res.sfsEmpleador,
          res.srlEmpleador, res.totalCostoEmpleador,
        ]),
        totales: ['TOTALES','', totales.bruto, totales.afpEmp, totales.sfsEmp, totales.isr,
          totales.descuentos, totales.neto, totales.afpEmpl, totales.sfsEmpl, totales.srlEmpl, totales.costo],
        anchos: [32, 22, 16, 14, 14, 14, 14, 16, 14, 14, 12, 16],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Nómina por Período"
        desc="Detalle completo de ingresos, descuentos y aportes por empleado para el período seleccionado."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      {/* Filter bar */}
      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Período:
          <select
            value={periodoId}
            onChange={e => { setPeriodoId(e.target.value); setGenerado(false) }}
            className={selectCls}
          >
            {sorted.length === 0
              ? <option value="">Sin períodos</option>
              : sorted.map(p => <option key={p.id} value={p.id}>{periodoLabel(p)}</option>)
            }
          </select>
        </label>
        <button onClick={generar} disabled={!periodoId || loading} className={primaryBtn}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Selecciona un período y haz clic en Generar para ver el reporte." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay empleados activos para este período." />
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-right">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cargo</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Sal. Bruto</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">AFP Emp.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">SFS Emp.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">ISR</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">Tot. Desc.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Sal. Neto</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">AFP Empl.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">SFS Empl.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">SRL</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 whitespace-nowrap">Costo Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filas.map(({ emp, res }) => (
                  <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors text-right">
                    <td className="px-5 py-3 text-left">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fullName(emp)}</p>
                    </td>
                    <td className="px-4 py-3 text-left text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{emp.cargo}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(res.totalBruto, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatRD(res.afpEmpleado, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatRD(res.sfsEmpleado, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-violet-700 dark:text-violet-400 whitespace-nowrap">{formatRD(res.isrMensual, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-800 dark:text-rose-300 font-medium whitespace-nowrap">{formatRD(res.totalDescuentos, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap">{formatRD(res.salarioNeto, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.afpEmpleador, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.sfsEmpleador, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.srlEmpleador, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-indigo-700 dark:text-indigo-400 font-semibold whitespace-nowrap">{formatRD(res.totalCostoEmpleador, 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 dark:border-[#252840] bg-[#1B2980] text-white font-bold text-right">
                  <td colSpan={2} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filas.length} empleados)</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatRD(totales.bruto, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-300 whitespace-nowrap">{formatRD(totales.afpEmp, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-300 whitespace-nowrap">{formatRD(totales.sfsEmp, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-violet-300 whitespace-nowrap">{formatRD(totales.isr, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-200 whitespace-nowrap">{formatRD(totales.descuentos, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-300 whitespace-nowrap">{formatRD(totales.neto, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.afpEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.sfsEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.srlEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo-200 whitespace-nowrap">{formatRD(totales.costo, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reporte Empleados ────────────────────────────────────────────────────────
function ReporteEmpleados({
  empresa, empleados,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
}) {
  const departamentos = useMemo(() =>
    Array.from(new Set(empleados.map(e => e.departamento))).sort(),
    [empleados]
  )

  const [filtroDepto, setFiltroDepto] = useState('todos')
  const [filtroContrato, setFiltroContrato] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('activo')
  const [generado, setGenerado] = useState(false)

  const filas = useMemo(() => {
    if (!generado) return []
    return empleados.filter(e => {
      if (filtroEstado === 'activo' && !e.activo) return false
      if (filtroEstado === 'inactivo' && e.activo) return false
      if (filtroDepto !== 'todos' && e.departamento !== filtroDepto) return false
      if (filtroContrato !== 'todos' && e.tipoContrato !== filtroContrato) return false
      return true
    })
  }, [generado, empleados, filtroEstado, filtroDepto, filtroContrato])

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Listado de Empleados',
      `Estado: ${filtroEstado} | Depto: ${filtroDepto} | Contrato: ${filtroContrato}`)

    autoTable(doc, {
      startY: 44,
      head: [['Nombre','Cédula/Doc','Cargo','Departamento','Contrato','Ingreso','Antigüedad','Salario Base','Banco']],
      body: filas.map(e => [
        fullName(e), e.cedula, e.cargo, e.departamento,
        contratoLabel(e.tipoContrato), formatDate(e.fechaIngreso),
        formatAnosServicio((Date.now() - new Date(e.fechaIngreso).getTime()) / (365.25*24*3600*1000)),
        e.salarioBase.toFixed(2), e.banco ?? '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 7: { halign: 'right' } },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save('listado-empleados.pdf')
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: 'listado-empleados',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Empleados',
        titulo: 'Listado de Empleados',
        subtitulo: `Estado: ${filtroEstado} | Depto: ${filtroDepto} | Contrato: ${filtroContrato}`,
        encabezados: ['Nombre','Cédula/Doc','Cargo','Departamento','Contrato','Ingreso','Antigüedad','Salario Base','Banco'],
        filas: filas.map(e => [
          fullName(e), e.cedula, e.cargo, e.departamento,
          contratoLabel(e.tipoContrato), formatDate(e.fechaIngreso),
          formatAnosServicio((Date.now() - new Date(e.fechaIngreso).getTime()) / (365.25*24*3600*1000)),
          e.salarioBase, e.banco ?? '—',
        ]),
        anchos: [30, 18, 24, 22, 18, 14, 18, 16, 16],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Listado de Empleados"
        desc="Plantilla completa con datos laborales, antigüedad y salarios."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Estado:
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value as typeof filtroEstado); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Departamento:
          <select value={filtroDepto} onChange={e => { setFiltroDepto(e.target.value); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Contrato:
          <select value={filtroContrato} onChange={e => { setFiltroContrato(e.target.value); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            <option value="indefinido">Indefinido</option>
            <option value="tiempo_determinado">T. Determinado</option>
            <option value="obra_servicio">Obra/Servicio</option>
          </select>
        </label>
        <button onClick={() => setGenerado(true)} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Aplica los filtros y haz clic en Generar para ver el listado." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay empleados que coincidan con los filtros seleccionados." />
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{filas.length} empleado{filas.length !== 1 ? 's' : ''} encontrado{filas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] text-left">
                  {['Nombre','Cédula/Doc','Cargo','Departamento','Contrato','Ingreso','Antigüedad','Salario Base','Banco'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filas.map(e => {
                  const anos = (Date.now() - new Date(e.fechaIngreso).getTime()) / (365.25*24*3600*1000)
                  return (
                    <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fullName(e)}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{e.activo ? 'Activo' : 'Inactivo'}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatCedula(e.cedula)}</td>
                      <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{e.cargo}</td>
                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{e.departamento}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                          e.tipoContrato === 'indefinido'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/50'
                            : e.tipoContrato === 'tiempo_determinado'
                            ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/50'
                            : 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:ring-violet-800/50'
                        }`}>{contratoLabel(e.tipoContrato)}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(e.fechaIngreso)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatAnosServicio(anos)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{formatRD(e.salarioBase, 0)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">{e.banco ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reporte Préstamos ────────────────────────────────────────────────────────
function ReportePrestamos({
  empresa, empleados, prestamos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  prestamos: ReturnType<typeof usePrestamos>['prestamos']
}) {
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'pagado' | 'cancelado'>('todos')
  const [generado, setGenerado] = useState(false)

  const empMap = useMemo(() =>
    Object.fromEntries(empleados.map(e => [e.id, e])),
    [empleados]
  )

  const filas = useMemo(() => {
    if (!generado) return []
    return prestamos.filter(p =>
      filtroEstado === 'todos' || p.estado === filtroEstado
    )
  }, [generado, prestamos, filtroEstado])

  const summary = useMemo(() => filas.reduce((acc, p) => ({
    totalMonto:  acc.totalMonto  + p.monto,
    totalSaldo:  acc.totalSaldo  + p.saldoPendiente,
    totalCuotas: acc.totalCuotas + (p.estado === 'activo' ? p.cuotaBase : 0),
  }), { totalMonto: 0, totalSaldo: 0, totalCuotas: 0 }), [filas])

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Reporte de Préstamos', `Estado: ${filtroEstado}`)

    autoTable(doc, {
      startY: 44,
      head: [['Empleado','Monto Orig.','Saldo Pend.','% Pagado','Cuota','Frecuencia','Otorgamiento','Estado']],
      body: filas.map(p => {
        const emp = empMap[p.empleadoId]
        const pct = ((p.monto - p.saldoPendiente) / p.monto * 100).toFixed(1)
        return [
          emp ? fullName(emp) : p.empleadoId,
          p.monto.toFixed(2),
          p.saldoPendiente.toFixed(2),
          `${pct}%`,
          p.cuotaBase.toFixed(2),
          p.frecuencia === 'mensual' ? 'Mensual' : 'Quincenal',
          formatDate(p.fechaOtorgamiento),
          p.estado.charAt(0).toUpperCase() + p.estado.slice(1),
        ]
      }),
      foot: [['TOTALES', summary.totalMonto.toFixed(2), summary.totalSaldo.toFixed(2),
        '', summary.totalCuotas.toFixed(2), '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' }, 2: { halign: 'right' },
        3: { halign: 'center' }, 4: { halign: 'right' },
        5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' },
      },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save('reporte-prestamos.pdf')
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: 'reporte-prestamos',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Préstamos',
        titulo: 'Reporte de Préstamos',
        subtitulo: `Estado: ${filtroEstado}`,
        encabezados: ['Empleado','Monto Orig.','Saldo Pend.','% Pagado','Cuota','Frecuencia','Otorgamiento','Estado'],
        filas: filas.map(p => {
          const emp = empMap[p.empleadoId]
          const pct = +((p.monto - p.saldoPendiente) / p.monto * 100).toFixed(1)
          return [
            emp ? fullName(emp) : p.empleadoId,
            p.monto, p.saldoPendiente, pct, p.cuotaBase,
            p.frecuencia === 'mensual' ? 'Mensual' : 'Quincenal',
            formatDate(p.fechaOtorgamiento),
            p.estado.charAt(0).toUpperCase() + p.estado.slice(1),
          ]
        }),
        totales: ['TOTALES', summary.totalMonto, summary.totalSaldo, '', summary.totalCuotas, '', '', ''],
        anchos: [30, 16, 16, 12, 14, 14, 16, 14],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Reporte de Préstamos"
        desc="Cartera de préstamos empleados: saldos, cuotas y estado de pago."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Estado:
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value as typeof filtroEstado); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <button onClick={() => setGenerado(true)} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Selecciona un estado y haz clic en Generar para ver el reporte." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay préstamos que coincidan con el filtro seleccionado." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Montos Otorgados</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(summary.totalMonto, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Saldo Pendiente</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{formatRD(summary.totalSaldo, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Cuotas Mensuales Activas</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(summary.totalCuotas, 0)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Monto Orig.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Saldo Pend.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">% Pagado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cuota</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Frecuencia</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Otorgamiento</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filas.map(p => {
                    const emp = empMap[p.empleadoId]
                    const pct = (p.monto - p.saldoPendiente) / p.monto * 100
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {emp ? fullName(emp) : 'Empleado eliminado'}
                          </p>
                          {emp && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{emp.cargo}</p>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(p.monto, 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-700 dark:text-rose-400 font-medium whitespace-nowrap">{formatRD(p.saldoPendiente, 0)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden min-w-[60px]">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(p.cuotaBase, 0)}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 capitalize">{p.frecuencia}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(p.fechaOtorgamiento)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                            p.estado === 'activo'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/50'
                              : p.estado === 'pagado'
                              ? 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:ring-indigo-800/50'
                              : 'bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-[#1a1d2e] dark:text-zinc-400 dark:ring-[#252840]'
                          }`}>
                            {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte TSS ──────────────────────────────────────────────────────────────
function ReporteTSS({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const sorted = useMemo(() =>
    [...periodos].sort((a, b) =>
      new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
    ), [periodos])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)

  const periodo = periodos.find(p => p.id === periodoId)

  const filas = useMemo(() => {
    if (!periodo || !generado) return []
    return empleados.filter(e => e.activo).map(emp => {
      const ajustes: AjusteLinea[] = periodo.ajustesPorEmpleado?.[emp.id] ?? []
      const params = ajustesToParams(ajustes)
      const res = calcularNomina(emp, params)
      const totalTSS = res.afpEmpleado + res.sfsEmpleado + res.afpEmpleador + res.sfsEmpleador + res.srlEmpleador
      return { emp, res, totalTSS }
    })
  }, [periodo, generado, empleados])

  const totales = useMemo(() => filas.reduce((acc, { res, totalTSS }) => ({
    cotizable:   acc.cotizable   + res.salarioCotizable,
    afpEmp:      acc.afpEmp      + res.afpEmpleado,
    sfsEmp:      acc.sfsEmp      + res.sfsEmpleado,
    afpEmpl:     acc.afpEmpl     + res.afpEmpleador,
    sfsEmpl:     acc.sfsEmpl     + res.sfsEmpleador,
    srl:         acc.srl         + res.srlEmpleador,
    totalTSS:    acc.totalTSS    + totalTSS,
    isr:         acc.isr         + res.isrMensual,
  }), { cotizable: 0, afpEmp: 0, sfsEmp: 0, afpEmpl: 0, sfsEmpl: 0, srl: 0, totalTSS: 0, isr: 0 }), [filas])

  function generar() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setGenerado(true) }, 100)
  }

  function exportarPDF() {
    if (!periodo || filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Reporte TSS / IR-2', periodoLabel(periodo))

    autoTable(doc, {
      startY: 44,
      head: [['Nombre','Cédula','S. Cotizable','AFP Emp.','SFS Emp.','AFP Empl.','SFS Empl.','SRL Empl.','Total TSS','ISR Retenido']],
      body: filas.map(({ emp, res, totalTSS }) => [
        fullName(emp), formatCedula(emp.cedula),
        res.salarioCotizable.toFixed(2),
        res.afpEmpleado.toFixed(2), res.sfsEmpleado.toFixed(2),
        res.afpEmpleador.toFixed(2), res.sfsEmpleador.toFixed(2), res.srlEmpleador.toFixed(2),
        totalTSS.toFixed(2), res.isrMensual.toFixed(2),
      ]),
      foot: [['TOTALES','',
        totales.cotizable.toFixed(2),
        totales.afpEmp.toFixed(2), totales.sfsEmp.toFixed(2),
        totales.afpEmpl.toFixed(2), totales.sfsEmpl.toFixed(2), totales.srl.toFixed(2),
        totales.totalTSS.toFixed(2), totales.isr.toFixed(2),
      ]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
        5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right' }, 9: { halign: 'right' },
      },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save(`tss-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportarXlsx() {
    if (!periodo || filas.length === 0) return
    exportarExcel({
      nombreArchivo: `tss-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'TSS',
        titulo: 'Reporte TSS / IR-2',
        subtitulo: periodoLabel(periodo),
        encabezados: ['Nombre','Cédula','S. Cotizable','AFP Emp.','SFS Emp.','AFP Empl.','SFS Empl.','SRL Empl.','Total TSS','ISR Retenido'],
        filas: filas.map(({ emp, res, totalTSS }) => [
          fullName(emp), formatCedula(emp.cedula),
          res.salarioCotizable, res.afpEmpleado, res.sfsEmpleado,
          res.afpEmpleador, res.sfsEmpleador, res.srlEmpleador,
          totalTSS, res.isrMensual,
        ]),
        totales: ['TOTALES','', totales.cotizable, totales.afpEmp, totales.sfsEmp,
          totales.afpEmpl, totales.sfsEmpl, totales.srl, totales.totalTSS, totales.isr],
        anchos: [30, 18, 16, 14, 14, 14, 14, 12, 16, 14],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="TSS / IR-2"
        desc="Aportes a la Tesorería de la Seguridad Social (CNSS) y retención de ISR para la DGII."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Período:
          <select
            value={periodoId}
            onChange={e => { setPeriodoId(e.target.value); setGenerado(false) }}
            className={selectCls}
          >
            {sorted.length === 0
              ? <option value="">Sin períodos</option>
              : sorted.map(p => <option key={p.id} value={p.id}>{periodoLabel(p)}</option>)
            }
          </select>
        </label>
        <button onClick={generar} disabled={!periodoId || loading} className={primaryBtn}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Selecciona un período y haz clic en Generar para ver el reporte." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay empleados activos para este período." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total TSS</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(totales.totalTSS, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Empleado + Empleador</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">TSS Empleado</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{formatRD(totales.afpEmp + totales.sfsEmp, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">AFP + SFS descontado</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">TSS Empleador</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(totales.afpEmpl + totales.sfsEmpl + totales.srl, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">AFP + SFS + SRL empresa</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ISR Retenido</p>
              <p className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">{formatRD(totales.isr, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Para remitir DGII día 10</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-right">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cédula</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">S. Cotizable</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">AFP Emp.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">SFS Emp.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">AFP Empl.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">SFS Empl.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">SRL Empl.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Total TSS</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400 whitespace-nowrap">ISR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filas.map(({ emp, res, totalTSS }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors text-right">
                      <td className="px-5 py-3 text-left">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fullName(emp)}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                      </td>
                      <td className="px-4 py-3 text-left font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatCedula(emp.cedula)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(res.salarioCotizable, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatRD(res.afpEmpleado, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatRD(res.sfsEmpleado, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.afpEmpleador, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.sfsEmpleador, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.srlEmpleador, 0)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{formatRD(totalTSS, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-violet-700 dark:text-violet-400 whitespace-nowrap">{formatRD(res.isrMensual, 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-300 dark:border-[#252840] bg-[#1B2980] text-white font-bold text-right">
                    <td colSpan={2} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filas.length} empleados)</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatRD(totales.cotizable, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-300 whitespace-nowrap">{formatRD(totales.afpEmp, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-300 whitespace-nowrap">{formatRD(totales.sfsEmp, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.afpEmpl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.sfsEmpl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-300 whitespace-nowrap">{formatRD(totales.srl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatRD(totales.totalTSS, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-violet-300 whitespace-nowrap">{formatRD(totales.isr, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Legal note */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-4 flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Reporte generado conforme a la <strong className="text-zinc-800 dark:text-zinc-200">Ley 87-01</strong> (TSS/CNSS)
              y <strong className="text-zinc-800 dark:text-zinc-200">Ley 11-92 Art. 309</strong> (ISR asalariados).
              Vencimiento de pago: día 10 del mes siguiente. Verificar tasas actualizadas en{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">tss.gov.do</strong> y{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">dgii.gov.do</strong>.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Shared UI components ─────────────────────────────────────────────────────
const selectCls = 'rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'
const primaryBtn = 'flex items-center gap-1.5 rounded-lg bg-[#1B2980] hover:bg-[#1a2a8a] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors'

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-5 py-3 shadow-sm dark:shadow-none">
      {children}
    </div>
  )
}

function ReportHeader({
  title, desc, onPDF, onExcel,
}: {
  title: string
  desc: string
  onPDF?: () => void
  onExcel?: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      {(onPDF || onExcel) && (
        <div className="flex items-center gap-2 shrink-0">
          {onExcel && (
            <button
              onClick={onExcel}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          )}
          {onPDF && (
            <button
              onClick={onPDF}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 gap-3">
      <AlertCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-xs">{message}</p>
    </div>
  )
}

// ─── Helper: convert AjusteLinea[] to ParametrosNomina ────────────────────────
function ajustesToParams(ajustes: AjusteLinea[]) {
  let horasExtras35 = 0
  let horasExtras100 = 0
  let bonificaciones = 0
  let comisiones = 0
  let otrosDescuentos = 0

  for (const a of ajustes) {
    if (a.concepto === 'horas_extras_35')  horasExtras35  += a.valor
    if (a.concepto === 'horas_extras_100') horasExtras100 += a.valor
    if (a.concepto === 'bono')             bonificaciones += a.valor
    if (a.concepto === 'comision')         comisiones     += a.valor
    if (a.tipo === 'deduccion')            otrosDescuentos += a.valor
  }

  return { horasExtras35, horasExtras100, bonificaciones, comisiones, otrosDescuentos }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('gerencial')
  const [toast, setToast] = useState<string | null>(null)

  const { empleados } = useEmpleados()
  const { periodos }  = usePeriodos()
  const { prestamos } = usePrestamos()
  const { empresa }   = useEmpresa()

  const renderReport = useCallback(() => {
    const props = { empresa, empleados, periodos, prestamos }
    switch (activeReport) {
      case 'gerencial':  return <ReporteGerencial  {...props} />
      case 'nomina':     return <ReporteNomina      {...props} />
      case 'empleados':  return <ReporteEmpleados   {...props} />
      case 'prestamos':  return <ReportePrestamos   {...props} />
      case 'tss':        return <ReporteTSS         {...props} />
    }
  }, [activeReport, empresa, empleados, periodos, prestamos])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Reportes"
        subtitle="Exportación profesional de reportes laborales y fiscales"
        actions={
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-y-auto">
          <div className="p-3">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Tipos de Reporte</p>
            <nav className="space-y-0.5">
              {SIDEBAR_ITEMS.map(item => {
                const Icon = item.icon
                const active = activeReport === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveReport(item.id)}
                    className={`w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'bg-[#1B2980] text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-indigo-200' : ''}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${active ? 'text-white' : ''}`}>{item.label}</p>
                      <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-indigo-200' : 'text-zinc-400 dark:text-zinc-500'}`}>{item.desc}</p>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-[#0d0f1a]">
          {renderReport()}
        </main>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
