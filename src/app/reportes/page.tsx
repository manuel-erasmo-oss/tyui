'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  BarChart3, Users, FileText, CreditCard, Shield,
  Download, FileSpreadsheet, ChevronRight, Loader2,
  TrendingUp, Wallet, Building2, Receipt, AlertCircle,
  Calendar, Briefcase, Info, Search, Landmark, Clock, Target, Timer,
  CheckCircle2, XCircle, ShieldAlert, History, UserX, FileClock,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import { usePeriodos } from '@/lib/periodos-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useEmpresa } from '@/lib/empresa-context'
import { useLiquidaciones } from '@/lib/liquidaciones-context'
import { useLicencias, labelLicencia, esLicenciaConSubsidio } from '@/lib/licencias-context'
import { calcularNomina, calcularNominaQuincenal, ajustesToParams, calcularConPeriodo, getDiasPreavisoRequeridos, getAnosServicio, TASAS_TSS } from '@/lib/dominican-labor'
import {
  formatRD, formatDate, formatCedula, fullName,
  formatAnosServicio, contratoLabel, contratoBadgeClass,
} from '@/lib/utils'
import { exportarExcel } from '@/lib/excel-export'
import type { AjusteLinea, PeriodoNomina, Empresa, RegistroLiquidacion, CategoriaRiesgoSRL, Licencia, TipoLicencia, Empleado, ResultadoNomina } from '@/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [27, 41, 128]
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportId = 'gerencial' | 'nomina' | 'empleados' | 'prestamos' | 'tss' | 'departamento' | 'bancaria' | 'horas_extras' | 'proyeccion' | 'preaviso' | 'antiguedad' | 'sin_ingresos' | 'licencias'

interface SidebarItem {
  id: ReportId
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'gerencial',    label: 'Resumen Gerencial',       icon: BarChart3,  desc: 'KPIs y tendencias de nómina' },
  { id: 'nomina',       label: 'Nómina por Período',      icon: FileText,   desc: 'Detalle de nómina por período' },
  { id: 'empleados',    label: 'Listado de Empleados',    icon: Users,      desc: 'Plantilla y datos laborales' },
  { id: 'prestamos',    label: 'Reporte de Préstamos',    icon: CreditCard, desc: 'Cartera de préstamos y saldos' },
  { id: 'tss',          label: 'Cumplimiento Fiscal',     icon: Shield,     desc: 'Conciliación TSS/DGII — factura CNSS e ISR retenido' },
  { id: 'departamento', label: 'Costo por Departamento',  icon: Building2,  desc: 'Masa salarial y headcount por área' },
  { id: 'bancaria',     label: 'Planilla Bancaria / ACH', icon: Landmark,   desc: 'Transferencias agrupadas por banco' },
  { id: 'horas_extras', label: 'Horas Extras',            icon: Clock,      desc: 'HE 35 % / 100 % y topes Art. 155' },
  { id: 'proyeccion',   label: 'Proyección Anual',        icon: Target,     desc: 'Costo proyectado vs ejecutado YTD' },
  { id: 'preaviso',     label: 'Cumplimiento de Preaviso', icon: Timer,     desc: 'Renuncias — anticipación vs. Art. 76' },
  { id: 'antiguedad',   label: 'Antigüedad de Plantilla', icon: History,   desc: 'Distribución por rango de años y por posición' },
  { id: 'sin_ingresos', label: 'Empleados Sin Ingresos',  icon: UserX,      desc: 'Integridad pre-cierre — activos sin nómina registrada' },
  { id: 'licencias',    label: 'Salario vs. Licencias',   icon: FileClock, desc: 'Impacto salarial de licencias registradas, por tipo y mes' },
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

  let textX = 14
  if (empresa.logo) {
    try {
      const fmt = empresa.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(empresa.logo, fmt, 14, 3, 16, 16)
      textX = 34
    } catch { /* ignore malformed logo */ }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.nombre || 'Empresa', textX, 10)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`RNC: ${empresa.rnc || '—'}`, textX, 16)

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

// Preferir el snapshot histórico congelado al momento de procesar (fuente
// fidedigna de lo que realmente se pagó) sobre recalcular con el Empleado en
// vivo — que usaría un salarioBase u otros datos que pudieron cambiar
// después (aumento salarial, etc.), inflando o distorsionando retroactivamente
// un período ya cerrado y pagado. Solo recalcula en vivo para períodos
// anteriores a este campo (sin ningún snapshot todavía).
function resultadoHistorico(emp: Empleado, periodo: PeriodoNomina): ResultadoNomina {
  const snapshot = periodo.resultadosPorEmpleado?.[emp.id]
  if (snapshot) return snapshot
  const ajustes = periodo.ajustesPorEmpleado?.[emp.id] ?? []
  return calcularConPeriodo(emp, ajustes, periodo)
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
  const currentYear = new Date().getFullYear()

  const sortedPeriodos = useMemo(() =>
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()),
    [periodos]
  )
  const ultimoPeriodo = sortedPeriodos[0]

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

  const ultimos6 = useMemo(() => sortedPeriodos.slice(0, 6), [sortedPeriodos])

  // YTD: acumulado del año en curso
  const ytd = useMemo(() => {
    const yearPeriods = periodos.filter(p => p.anio === currentYear && p.estado !== 'en_proceso')
    return yearPeriods.reduce(
      (acc, p) => ({
        bruto:    acc.bruto    + p.totales.bruto,
        neto:     acc.neto     + p.totales.neto,
        isr:      acc.isr      + p.totales.isr,
        aportes:  acc.aportes  + p.totales.aportes,
        costo:    acc.costo    + p.totales.costoTotal,
        periodos: acc.periodos + 1,
      }),
      { bruto: 0, neto: 0, isr: 0, aportes: 0, costo: 0, periodos: 0 },
    )
  }, [periodos, currentYear])

  // Desglose por departamento del último período — usa los empleados
  // REALMENTE incluidos en ese período (vía el snapshot resultadosPorEmpleado),
  // no `activos` (empleados activos AHORA). Si alguien fue procesado en ese
  // período pero luego se desvinculó/desactivó, `activos` lo excluiría por
  // completo, dejando el desglose por debajo del "Costo Total Empresa" del
  // KPI de arriba (que sí lee ultimoPeriodo.totales, con todos incluidos) —
  // dos números que deberían coincidir en la misma pantalla. Solo cae de
  // vuelta a `activos` para períodos anteriores al snapshot (sin registro
  // de quién participó).
  const desglose = useMemo(() => {
    if (!ultimoPeriodo) return []
    const idsDelPeriodo = ultimoPeriodo.resultadosPorEmpleado
      ? Object.keys(ultimoPeriodo.resultadosPorEmpleado)
      : null
    const empleadosDelPeriodo = idsDelPeriodo && idsDelPeriodo.length > 0
      ? idsDelPeriodo.map(id => empleados.find(e => e.id === id)).filter((e): e is Empleado => !!e)
      : activos
    const groups: Record<string, { bruto: number; neto: number; costo: number; headcount: number }> = {}
    for (const emp of empleadosDelPeriodo) {
      const res = resultadoHistorico(emp, ultimoPeriodo)
      const d = emp.departamento || 'Sin Departamento'
      if (!groups[d]) groups[d] = { bruto: 0, neto: 0, costo: 0, headcount: 0 }
      groups[d].bruto    += res.totalBruto
      groups[d].neto     += res.salarioNeto
      groups[d].costo    += res.totalCostoEmpleador
      groups[d].headcount++
    }
    const grandTotal = Object.values(groups).reduce((s, g) => s + g.costo, 0)
    return Object.entries(groups)
      .map(([depto, g]) => ({ depto, ...g, pct: grandTotal > 0 ? g.costo / grandTotal * 100 : 0 }))
      .sort((a, b) => b.costo - a.costo)
  }, [ultimoPeriodo, activos, empleados])

  function exportarPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Resumen Gerencial', 'Indicadores clave de nómina')
    const type = doc as jsPDF & { lastAutoTable: { finalY: number } }

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

    const after1 = type.lastAutoTable?.finalY ?? 44
    autoTable(doc, {
      startY: after1 + 10,
      head: [['Período', 'Empleados', 'Bruto', 'Descuentos', 'Neto', 'Δ Neto', 'Costo Total']],
      body: ultimos6.map((p, i) => {
        const delta = i < ultimos6.length - 1
          ? ((p.totales.neto - ultimos6[i + 1].totales.neto) / ultimos6[i + 1].totales.neto * 100)
          : null
        return [
          periodoLabel(p), `${p.totalEmpleados}`,
          formatRD(p.totales.bruto, 0), formatRD(p.totales.descuentos, 0),
          formatRD(p.totales.neto, 0),
          delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
          formatRD(p.totales.costoTotal, 0),
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })

    if (desglose.length > 0) {
      const after2 = type.lastAutoTable?.finalY ?? 44
      autoTable(doc, {
        startY: after2 + 10,
        head: [['Departamento', 'Empleados', 'Sal. Bruto', 'Sal. Neto', 'Costo Total', '% del Total']],
        body: desglose.map(d => [d.depto, `${d.headcount}`, formatRD(d.bruto, 0), formatRD(d.neto, 0), formatRD(d.costo, 0), `${d.pct.toFixed(1)}%`]),
        theme: 'striped',
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
        didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
      })
    }

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
          nombre: 'Acumulado YTD',
          titulo: `Acumulado Año en Curso ${currentYear}`,
          subtitulo: `${ytd.periodos} período(s) procesados`,
          encabezados: ['Indicador', 'Valor YTD'],
          filas: [
            ['Nómina Bruta YTD', ytd.bruto],
            ['Nómina Neta YTD', ytd.neto],
            ['ISR Retenido YTD', ytd.isr],
            ['TSS Empleador YTD', ytd.aportes],
            ['Costo Total YTD', ytd.costo],
          ],
          anchos: [36, 22],
        },
        {
          nombre: 'Histórico',
          titulo: 'Últimos 6 Períodos',
          encabezados: ['Período', 'Empleados', 'Bruto', 'Descuentos', 'Neto', 'Δ Neto', 'Costo Total'],
          filas: ultimos6.map((p, i) => {
            const delta = i < ultimos6.length - 1
              ? ((p.totales.neto - ultimos6[i + 1].totales.neto) / ultimos6[i + 1].totales.neto * 100)
              : null
            return [periodoLabel(p), p.totalEmpleados, p.totales.bruto, p.totales.descuentos, p.totales.neto, delta !== null ? `${delta.toFixed(1)}%` : '—', p.totales.costoTotal]
          }),
          anchos: [30, 14, 18, 18, 18, 12, 18],
        },
        ...(desglose.length > 0 ? [{
          nombre: 'Por Departamento',
          titulo: `Desglose por Departamento — ${ultimoPeriodo ? periodoLabel(ultimoPeriodo) : ''}`,
          encabezados: ['Departamento', 'Empleados', 'Sal. Bruto', 'Sal. Neto', 'Costo Total', '% del Total'],
          filas: desglose.map(d => [d.depto, d.headcount, d.bruto, d.neto, d.costo, `${d.pct.toFixed(1)}%`]),
          anchos: [28, 14, 18, 18, 18, 14],
        }] : []),
      ],
    })
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Resumen Gerencial"
        desc="Acumulado YTD, indicadores del último período y desglose por departamento."
        onPDF={exportarPDF}
        onExcel={exportarXlsx}
      />

      {!kpis ? (
        <EmptyState message="No hay períodos de nómina registrados aún." />
      ) : (
        <>
          {/* KPI Grid — último período */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
              Indicadores — {periodoLabel(ultimoPeriodo!)}
            </p>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              <StatCard label="Empleados Activos"   value={`${kpis.empleados}`}       icon={Users}       iconColor="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" />
              <StatCard label="Nómina Bruta"        value={formatRD(kpis.bruto, 0)}   icon={Wallet}      iconColor="bg-zinc-100 text-zinc-700 dark:bg-[#1a1d2e] dark:text-zinc-300" />
              <StatCard label="Nómina Neta"         value={formatRD(kpis.neto, 0)}    icon={TrendingUp}  iconColor="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
              <StatCard label="ISR Retenido"        value={formatRD(kpis.isr, 0)}     icon={Receipt}     iconColor="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" />
              <StatCard label="Aportes Empleador"   value={formatRD(kpis.aportes, 0)} icon={Building2}   iconColor="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
              <StatCard label="Costo Total Empresa" value={formatRD(kpis.costo, 0)}   icon={Briefcase}   iconColor="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" />
            </div>
          </div>

          {/* YTD — Acumulado año en curso */}
          {ytd.periodos > 0 && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb]/40 dark:bg-indigo-950/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">
                    Acumulado YTD — {currentYear}
                  </p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-500 mt-0.5">{ytd.periodos} período{ytd.periodos !== 1 ? 's' : ''} procesados</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {([
                  { label: 'Bruto YTD',       value: ytd.bruto,   cls: 'text-zinc-800 dark:text-zinc-100' },
                  { label: 'Neto YTD',         value: ytd.neto,    cls: 'text-emerald-700 dark:text-emerald-400' },
                  { label: 'ISR YTD',          value: ytd.isr,     cls: 'text-violet-700 dark:text-violet-400' },
                  { label: 'TSS Empl. YTD',    value: ytd.aportes, cls: 'text-amber-700 dark:text-amber-400' },
                  { label: 'Costo Total YTD',  value: ytd.costo,   cls: 'text-indigo-700 dark:text-indigo-400 font-bold' },
                ] as const).map(({ label, value, cls }) => (
                  <div key={label} className="rounded-lg bg-white dark:bg-[#141722] border border-indigo-100 dark:border-indigo-900/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
                    <p className={`text-sm font-bold tabular-nums mt-1 ${cls}`}>{formatRD(value, 0)}</p>
                  </div>
                ))}
              </div>
              {ytd.bruto > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    <span>Eficiencia salarial (Neto / Bruto)</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{(ytd.neto / ytd.bruto * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, ytd.neto / ytd.bruto * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Histórico con Δ% */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-4">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Histórico</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5">Últimos 6 Períodos</p>
            </div>
            {ultimos6.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin períodos registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      {['Período','Empleados','Bruto','Descuentos','Neto','Δ Neto','Costo Total'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 last:text-right first:text-left text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {ultimos6.map((p, i) => {
                      const delta = i < ultimos6.length - 1
                        ? ((p.totales.neto - ultimos6[i + 1].totales.neto) / ultimos6[i + 1].totales.neto * 100)
                        : null
                      return (
                        <tr key={p.id} className={`hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors ${i === 0 ? 'font-medium' : ''}`}>
                          <td className="px-5 py-3">
                            <span className="text-zinc-900 dark:text-zinc-100">{periodoLabel(p)}</span>
                            {i === 0 && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50">Último</span>}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{p.totalEmpleados}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(p.totales.bruto, 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatRD(p.totales.descuentos, 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatRD(p.totales.neto, 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-xs">
                            {delta === null ? (
                              <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            ) : (
                              <span className={delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400">{formatRD(p.totales.costoTotal, 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Desglose por departamento — último período */}
          {desglose.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
              <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Costo por Departamento</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5">{periodoLabel(ultimoPeriodo!)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      {['Departamento','Empleados','Sal. Bruto','Sal. Neto','Costo Total','% del Total'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 last:text-right first:text-left text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {desglose.map(d => (
                      <tr key={d.depto} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{d.depto}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.headcount}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(d.bruto, 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatRD(d.neto, 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 font-medium">{formatRD(d.costo, 0)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${d.pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0 w-10 text-right">{d.pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) =>
      new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
    ), [periodos])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const periodo = sorted.find(p => p.id === periodoId)

  const filas = useMemo(() => {
    if (!periodo || !generado) return []
    // Preferir el snapshot histórico congelado al momento de procesar cada
    // empleado (fuente fidedigna de lo que realmente se pagó) — recalcular
    // con el Empleado en vivo mostraría un salario que pudo cambiar después
    // (aumento, etc.) para un período ya cerrado y pagado. Solo se recalcula
    // en vivo para períodos anteriores a este campo (sin ningún snapshot).
    const tieneSnapshots = periodo.resultadosPorEmpleado && Object.keys(periodo.resultadosPorEmpleado).length > 0
    if (tieneSnapshots) {
      return Object.entries(periodo.resultadosPorEmpleado!)
        .map(([empId, res]) => {
          const emp = empleados.find(e => e.id === empId)
          return emp ? { emp, res } : null
        })
        .filter((x): x is { emp: Empleado; res: ResultadoNomina } => x !== null)
    }
    const activos = empleados.filter(e => e.activo)
    return activos.map(emp => {
      const ajustes: AjusteLinea[] = periodo.ajustesPorEmpleado?.[emp.id] ?? []
      const res = calcularConPeriodo(emp, ajustes, periodo)
      return { emp, res }
    })
  }, [periodo, generado, empleados])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) =>
      fullName(emp).toLowerCase().includes(q) ||
      emp.cargo.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

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
    infotepEmpl:    acc.infotepEmpl    + res.infotepEmpleador,
    costo:          acc.costo          + res.totalCostoEmpleador,
  }), { bruto: 0, afpEmp: 0, sfsEmp: 0, isr: 0, descuentos: 0, neto: 0, afpEmpl: 0, sfsEmpl: 0, srlEmpl: 0, infotepEmpl: 0, costo: 0 }), [filas])

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
      head: [['Nombre','Cargo','Bruto','AFP Emp.','SFS Emp.','ISR','Tot. Desc.','Neto','AFP Empl.','SFS Empl.','SRL','Infotep','Costo Total']],
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
        res.infotepEmpleador.toFixed(2),
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
        totales.infotepEmpl.toFixed(2),
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
        11: { halign: 'right' }, 12: { halign: 'right' },
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
        encabezados: ['Nombre','Cargo','Bruto','AFP Emp.','SFS Emp.','ISR','Tot. Desc.','Neto','AFP Empl.','SFS Empl.','SRL','Infotep','Costo Total'],
        filas: filas.map(({ emp, res }) => [
          fullName(emp), emp.cargo,
          res.totalBruto, res.afpEmpleado, res.sfsEmpleado, res.isrMensual,
          res.totalDescuentos, res.salarioNeto, res.afpEmpleador, res.sfsEmpleador,
          res.srlEmpleador, res.infotepEmpleador, res.totalCostoEmpleador,
        ]),
        totales: ['TOTALES','', totales.bruto, totales.afpEmp, totales.sfsEmp, totales.isr,
          totales.descuentos, totales.neto, totales.afpEmpl, totales.sfsEmpl, totales.srlEmpl, totales.infotepEmpl, totales.costo],
        anchos: [32, 22, 16, 14, 14, 14, 14, 16, 14, 14, 12, 12, 16],
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
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre, cargo o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
            <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
          </div>
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
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">Infotep</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 whitespace-nowrap">Costo Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filasVisible.map(({ emp, res }) => (
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
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.infotepEmpleador, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-indigo-700 dark:text-indigo-400 font-semibold whitespace-nowrap">{formatRD(res.totalCostoEmpleador, 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold text-right">
                  <td colSpan={2} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filasVisible.length} empleados)</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(totales.bruto, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-300 whitespace-nowrap">{formatRD(totales.afpEmp, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-300 whitespace-nowrap">{formatRD(totales.sfsEmp, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-violet-700 dark:text-violet-300 whitespace-nowrap">{formatRD(totales.isr, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-800 dark:text-rose-200 whitespace-nowrap">{formatRD(totales.descuentos, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{formatRD(totales.neto, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.afpEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.sfsEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.srlEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.infotepEmpl, 0)}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{formatRD(totales.costo, 0)}</td>
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
  const [searchQ, setSearchQ] = useState('')

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

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(e =>
      fullName(e).toLowerCase().includes(q) ||
      e.cedula.includes(q) ||
      e.cargo.toLowerCase().includes(q) ||
      e.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

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
            <option value="fijo">Fijo</option>
            <option value="temporal">Temporal</option>
            <option value="estacional">Estacional</option>
            <option value="ocasional">Móvil / Ocasional</option>
            <option value="pasante">Pasante</option>
            <option value="aprendiz">Aprendiz</option>
            <option value="eventual">Eventual</option>
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Aplica los filtros y haz clic en Generar para ver el listado." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay empleados que coincidan con los filtros seleccionados." />
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre, cédula, cargo o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
            <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  {['Nombre','Cédula/Doc','Cargo','Departamento','Contrato','Ingreso','Antigüedad','Salario Base','Banco'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filasVisible.map(e => {
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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${contratoBadgeClass(e.tipoContrato)}`}>{contratoLabel(e.tipoContrato)}</span>
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
  const [searchQ, setSearchQ] = useState('')

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

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(p => {
      const emp = empMap[p.empleadoId]
      return emp ? fullName(emp).toLowerCase().includes(q) : false
    })
  }, [filas, searchQ, empMap])

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
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
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
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Montos Otorgados</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(summary.totalMonto, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Saldo Pendiente</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{formatRD(summary.totalSaldo, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Cuotas Mensuales Activas</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(summary.totalCuotas, 0)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre de empleado…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
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
                  {filasVisible.map(p => {
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
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) =>
      new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
    ), [periodos])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const periodo = sorted.find(p => p.id === periodoId)

  // Empleados REALMENTE incluidos en el período (snapshot resultadosPorEmpleado
  // si existe, o todos los activos como respaldo solo para períodos sin ese
  // campo) — no `empleados.filter(e => e.activo)` a secas, que excluiría por
  // completo a cualquiera que haya sido procesado en ese período pero ya esté
  // inactivo hoy. Es un reporte de conciliación fiscal (factura CNSS/DGII):
  // subestimar el TSS/ISR de un período ya cerrado es un riesgo de auditoría real.
  const filas = useMemo(() => {
    if (!periodo || !generado) return []
    const idsDelPeriodo = periodo.resultadosPorEmpleado && Object.keys(periodo.resultadosPorEmpleado).length > 0
      ? Object.keys(periodo.resultadosPorEmpleado)
      : empleados.filter(e => e.activo).map(e => e.id)
    return idsDelPeriodo.map(id => empleados.find(e => e.id === id)).filter((e): e is Empleado => !!e).map(emp => {
      const res = resultadoHistorico(emp, periodo)
      const totalTSS = res.afpEmpleado + res.sfsEmpleado + res.afpEmpleador + res.sfsEmpleador + res.srlEmpleador + res.infotepEmpleador
      return { emp, res, totalTSS }
    })
  }, [periodo, generado, empleados])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) =>
      fullName(emp).toLowerCase().includes(q) ||
      emp.cargo.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

  const ISR_BRACKETS = [
    { label: 'Exento',  max: 34685,   color: 'bg-zinc-400' },
    { label: '15%',     max: 52027,   color: 'bg-amber-400' },
    { label: '20%',     max: 72260,   color: 'bg-orange-500' },
    { label: '25%',     max: Infinity, color: 'bg-rose-500' },
  ]

  const isrTramos = useMemo(() => {
    if (filas.length === 0) return []
    return ISR_BRACKETS.map((bracket, i) => {
      const prev = i > 0 ? ISR_BRACKETS[i - 1].max : 0
      const rows = filas.filter(({ res }) => res.salarioCotizable > prev && res.salarioCotizable <= bracket.max)
      const totalISR = rows.reduce((s, { res }) => s + res.isrMensual, 0)
      return {
        label: bracket.label,
        color: bracket.color,
        count: rows.length,
        pct: filas.length > 0 ? rows.length / filas.length * 100 : 0,
        avgISR: rows.length > 0 ? totalISR / rows.length : 0,
        totalISR,
      }
    })
  }, [filas])

  const totales = useMemo(() => filas.reduce((acc, { res, totalTSS }) => ({
    cotizable:   acc.cotizable   + res.salarioCotizable,
    afpEmp:      acc.afpEmp      + res.afpEmpleado,
    sfsEmp:      acc.sfsEmp      + res.sfsEmpleado,
    afpEmpl:     acc.afpEmpl     + res.afpEmpleador,
    sfsEmpl:     acc.sfsEmpl     + res.sfsEmpleador,
    srl:         acc.srl         + res.srlEmpleador,
    infotep:     acc.infotep     + res.infotepEmpleador,
    totalTSS:    acc.totalTSS    + totalTSS,
    isr:         acc.isr         + res.isrMensual,
    sfsDependientes: acc.sfsDependientes + res.sfsDependientes,
  }), { cotizable: 0, afpEmp: 0, sfsEmp: 0, afpEmpl: 0, sfsEmpl: 0, srl: 0, infotep: 0, totalTSS: 0, isr: 0, sfsDependientes: 0 }), [filas])

  // ─── Planilla de Conciliación TSS (formato "factura") ──────────────────────
  // SRL se remite por categoría de riesgo (I-IV), cada una con su propia tasa —
  // se agrupa por categoría real de cada empleado en vez de asumir una sola tasa.
  const TASA_SRL_POR_CATEGORIA: Record<CategoriaRiesgoSRL, number> = {
    I: TASAS_TSS.srlCategoriaI, II: TASAS_TSS.srlCategoriaII,
    III: TASAS_TSS.srlCategoriaIII, IV: TASAS_TSS.srlCategoriaIV,
  }

  const srlPorCategoria = useMemo(() => {
    const grupos = new Map<CategoriaRiesgoSRL, { categoria: CategoriaRiesgoSRL; tasa: number; monto: number; count: number }>()
    for (const { emp, res } of filas) {
      const cat = emp.categoriaRiesgo ?? 'I'
      const g = grupos.get(cat) ?? { categoria: cat, tasa: TASA_SRL_POR_CATEGORIA[cat], monto: 0, count: 0 }
      g.monto += res.srlEmpleador
      g.count += 1
      grupos.set(cat, g)
    }
    return [...grupos.values()].sort((a, b) => a.categoria.localeCompare(b.categoria))
  }, [filas])

  interface FilaConciliacion {
    concepto: string
    tasaEmpleado: string
    tasaEmpleador: string
    montoEmpleado: number
    montoEmpleador: number
    total: number
  }

  const conciliacionFilas = useMemo<FilaConciliacion[]>(() => {
    if (filas.length === 0) return []
    const rows: FilaConciliacion[] = [
      {
        concepto: 'AFP — Pensiones (Ley 87-01)',
        tasaEmpleado: `${(TASAS_TSS.afpEmpleado * 100).toFixed(2)}%`,
        tasaEmpleador: `${(TASAS_TSS.afpEmpleador * 100).toFixed(2)}%`,
        montoEmpleado: totales.afpEmp,
        montoEmpleador: totales.afpEmpl,
        total: totales.afpEmp + totales.afpEmpl,
      },
      {
        concepto: 'SFS — Seguro Familiar de Salud (Ley 87-01)',
        tasaEmpleado: `${(TASAS_TSS.sfsEmpleado * 100).toFixed(2)}%`,
        tasaEmpleador: `${(TASAS_TSS.sfsEmpleador * 100).toFixed(2)}%`,
        montoEmpleado: totales.sfsEmp,
        montoEmpleador: totales.sfsEmpl,
        total: totales.sfsEmp + totales.sfsEmpl,
      },
    ]
    if (totales.sfsDependientes > 0) {
      rows.push({
        concepto: 'SFS — Dependientes Adicionales (Res. 624-02 CNSS)',
        tasaEmpleado: 'Cuota fija',
        tasaEmpleador: '—',
        montoEmpleado: totales.sfsDependientes,
        montoEmpleador: 0,
        total: totales.sfsDependientes,
      })
    }
    for (const g of srlPorCategoria) {
      rows.push({
        concepto: `SRL — Riesgos Laborales, Categoría ${g.categoria} (${g.count} emp.)`,
        tasaEmpleado: '—',
        tasaEmpleador: `${(g.tasa * 100).toFixed(2)}%`,
        montoEmpleado: 0,
        montoEmpleador: g.monto,
        total: g.monto,
      })
    }
    rows.push({
      concepto: 'Infotep — Capacitación Laboral (Ley 116-80)',
      tasaEmpleado: '—',
      tasaEmpleador: `${(TASAS_TSS.infotepEmpleador * 100).toFixed(2)}%`,
      montoEmpleado: 0,
      montoEmpleador: totales.infotep,
      total: totales.infotep,
    })
    return rows
  }, [filas, totales, srlPorCategoria])

  const totalTSSRemitir = useMemo(() => conciliacionFilas.reduce((s, r) => s + r.total, 0), [conciliacionFilas])
  const totalTSSRemitirEmpleado  = useMemo(() => conciliacionFilas.reduce((s, r) => s + r.montoEmpleado, 0), [conciliacionFilas])
  const totalTSSRemitirEmpleador = useMemo(() => conciliacionFilas.reduce((s, r) => s + r.montoEmpleador, 0), [conciliacionFilas])

  function generar() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setGenerado(true) }, 100)
  }

  function exportarPDF() {
    if (!periodo || filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // ─── Página 1: Planilla de Conciliación (formato "factura" TSS) ─────────
    pdfHeader(doc, empresa, 'Planilla de Conciliación TSS / DGII', periodoLabel(periodo))

    autoTable(doc, {
      startY: 44,
      head: [['Concepto','Tasa Empleado','Tasa Empleador','Monto Empleado','Monto Empleador','Total']],
      body: conciliacionFilas.map(f => [
        f.concepto, f.tasaEmpleado, f.tasaEmpleador,
        f.montoEmpleado > 0 ? f.montoEmpleado.toFixed(2) : '—',
        f.montoEmpleador > 0 ? f.montoEmpleador.toFixed(2) : '—',
        f.total.toFixed(2),
      ]),
      foot: [['TOTAL TSS A REMITIR (CNSS)','','',
        totalTSSRemitirEmpleado.toFixed(2), totalTSSRemitirEmpleador.toFixed(2), totalTSSRemitir.toFixed(2),
      ]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' }, 2: { halign: 'right' },
        3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
      },
    })

    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } }
    const afterConciliacion = docTyped.lastAutoTable?.finalY ?? 44
    autoTable(doc, {
      startY: afterConciliacion + 10,
      head: [['Retención ISR (DGII)', '']],
      body: [['Retención mensual acumulada — Ley 11-92 Art. 309', formatRD(totales.isr, 2)]],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: NAVY, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      tableWidth: 140,
    })

    // ─── Página 2: Detalle por Empleado (auditoría/soporte) ─────────────────
    doc.addPage()
    pdfHeader(doc, empresa, 'Reporte TSS / IR-2 — Detalle por Empleado', periodoLabel(periodo))

    autoTable(doc, {
      startY: 44,
      head: [['Nombre','Cédula','S. Cotizable','AFP Emp.','SFS Emp.','AFP Empl.','SFS Empl.','SRL Empl.','Infotep','Total TSS','ISR Retenido']],
      body: filas.map(({ emp, res, totalTSS }) => [
        fullName(emp), formatCedula(emp.cedula),
        res.salarioCotizable.toFixed(2),
        res.afpEmpleado.toFixed(2), res.sfsEmpleado.toFixed(2),
        res.afpEmpleador.toFixed(2), res.sfsEmpleador.toFixed(2), res.srlEmpleador.toFixed(2), res.infotepEmpleador.toFixed(2),
        totalTSS.toFixed(2), res.isrMensual.toFixed(2),
      ]),
      foot: [['TOTALES','',
        totales.cotizable.toFixed(2),
        totales.afpEmp.toFixed(2), totales.sfsEmp.toFixed(2),
        totales.afpEmpl.toFixed(2), totales.sfsEmpl.toFixed(2), totales.srl.toFixed(2), totales.infotep.toFixed(2),
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
        8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
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
      hojas: [
        {
          nombre: 'Conciliación',
          titulo: 'Planilla de Conciliación TSS / DGII',
          subtitulo: periodoLabel(periodo),
          encabezados: ['Concepto','Tasa Empleado','Tasa Empleador','Monto Empleado','Monto Empleador','Total'],
          filas: conciliacionFilas.map(f => [
            f.concepto, f.tasaEmpleado, f.tasaEmpleador, f.montoEmpleado, f.montoEmpleador, f.total,
          ]),
          totales: ['TOTAL TSS A REMITIR (CNSS)','','', totalTSSRemitirEmpleado, totalTSSRemitirEmpleador, totalTSSRemitir],
          anchos: [42, 14, 14, 16, 16, 16],
        },
        {
          nombre: 'TSS',
          titulo: 'Reporte TSS / IR-2 — Detalle por Empleado',
          subtitulo: periodoLabel(periodo),
          encabezados: ['Nombre','Cédula','S. Cotizable','AFP Emp.','SFS Emp.','AFP Empl.','SFS Empl.','SRL Empl.','Infotep','Total TSS','ISR Retenido'],
          filas: filas.map(({ emp, res, totalTSS }) => [
            fullName(emp), formatCedula(emp.cedula),
            res.salarioCotizable, res.afpEmpleado, res.sfsEmpleado,
            res.afpEmpleador, res.sfsEmpleador, res.srlEmpleador, res.infotepEmpleador,
            totalTSS, res.isrMensual,
          ]),
          totales: ['TOTALES','', totales.cotizable, totales.afpEmp, totales.sfsEmp,
            totales.afpEmpl, totales.sfsEmpl, totales.srl, totales.infotep, totales.totalTSS, totales.isr],
          anchos: [30, 18, 16, 14, 14, 14, 14, 12, 12, 16, 14],
        },
      ],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Cumplimiento Fiscal"
        desc="Planilla de conciliación TSS (CNSS) y retención de ISR (DGII) — mismo formato de la factura oficial, para conciliar sin recalcular a mano."
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
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total TSS</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatRD(totales.totalTSS, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Empleado + Empleador</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">TSS Empleado</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{formatRD(totales.afpEmp + totales.sfsEmp, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">AFP + SFS descontado</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">TSS Empleador</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatRD(totales.afpEmpl + totales.sfsEmpl + totales.srl + totales.infotep, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">AFP + SFS + SRL + Infotep empresa</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ISR Retenido</p>
              <p className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">{formatRD(totales.isr, 0)}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Para remitir DGII día 10</p>
            </div>
          </div>

          {/* Planilla de Conciliación TSS — mismo desglose de conceptos/tasas que la factura oficial CNSS */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-3">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Planilla de Conciliación TSS</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Desglose por concepto y tasa, empleado vs. empleador — mismo formato de la factura oficial de la CNSS, para conciliar directo contra lo remitido.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concepto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Tasa Empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Tasa Empleador</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400 whitespace-nowrap">Monto Empleado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">Monto Empleador</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {conciliacionFilas.map(f => (
                    <tr key={f.concepto} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{f.concepto}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{f.tasaEmpleado}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{f.tasaEmpleador}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{f.montoEmpleado > 0 ? formatRD(f.montoEmpleado, 2) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{f.montoEmpleador > 0 ? formatRD(f.montoEmpleador, 2) : '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{formatRD(f.total, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold">
                    <td className="px-5 py-3 text-xs uppercase tracking-wide whitespace-nowrap">Total TSS a Remitir (CNSS)</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatRD(totalTSSRemitirEmpleado, 2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatRD(totalTSSRemitirEmpleador, 2)}</td>
                    <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">{formatRD(totalTSSRemitir, 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="border-t border-zinc-100 dark:border-[#1d2035] bg-[#eef0fb]/40 dark:bg-indigo-950/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#1B2980] dark:text-indigo-400">Retención ISR — DGII</p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">Ley 11-92 Art. 309 — retención mensual acumulada de todos los empleados de este período (equivalente para IR-13/declaración jurada).</p>
              </div>
              <p className="text-xl font-bold text-[#1B2980] dark:text-indigo-400 tabular-nums whitespace-nowrap">{formatRD(totales.isr, 2)}</p>
            </div>
          </div>

          {/* Detalle por empleado — soporte y auditoría de la planilla de conciliación de arriba */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre, cargo o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
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
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 whitespace-nowrap">Infotep</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Total TSS</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400 whitespace-nowrap">ISR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ emp, res, totalTSS }) => (
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
                      <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(res.infotepEmpleador, 0)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{formatRD(totalTSS, 0)}</td>
                      <td className="px-4 py-3 tabular-nums text-violet-700 dark:text-violet-400 whitespace-nowrap">{formatRD(res.isrMensual, 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold text-right">
                    <td colSpan={2} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filasVisible.length} empleados)</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(totales.cotizable, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-300 whitespace-nowrap">{formatRD(totales.afpEmp, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-300 whitespace-nowrap">{formatRD(totales.sfsEmp, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.afpEmpl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.sfsEmpl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.srl, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.infotep, 0)}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatRD(totales.totalTSS, 0)}</td>
                    <td className="px-4 py-3 tabular-nums text-violet-700 dark:text-violet-300 whitespace-nowrap">{formatRD(totales.isr, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ISR bracket distribution */}
          {isrTramos.some(t => t.count > 0) && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/20 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-400 mb-4">Distribución por Tramo ISR — Ley 11-92</p>
              <div className="flex h-3 rounded-full overflow-hidden mb-4">
                {isrTramos.map(t => t.pct > 0 && (
                  <div key={t.label} className={`${t.color} opacity-80`} style={{ width: `${t.pct}%` }} title={`${t.label}: ${t.count} empleado(s)`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {isrTramos.map(t => (
                  <div key={t.label} className="rounded-lg bg-white dark:bg-[#141722] border border-violet-100 dark:border-violet-900/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`h-2 w-2 rounded-full ${t.color}`} />
                      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Tramo {t.label}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.count} emp.</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">ISR prom.: {formatRD(t.avgISR, 0)}</p>
                    <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">Total: {formatRD(t.totalISR, 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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

// ─── Reporte Costo por Departamento ──────────────────────────────────────────
function ReporteCostoPorDepto({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const sorted = useMemo(() =>
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()),
    [periodos]
  )
  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const periodo = sorted.find(p => p.id === periodoId)

  const deptos = useMemo(() => {
    if (!periodo || !generado) return []
    // Empleados REALMENTE incluidos en el período (snapshot si existe, o
    // todos los activos como respaldo solo para períodos sin snapshot) — ver
    // nota equivalente en el Reporte TSS más arriba en este mismo archivo.
    const idsDelPeriodo = periodo.resultadosPorEmpleado && Object.keys(periodo.resultadosPorEmpleado).length > 0
      ? Object.keys(periodo.resultadosPorEmpleado)
      : empleados.filter(e => e.activo).map(e => e.id)
    const empleadosDelPeriodo = idsDelPeriodo.map(id => empleados.find(e => e.id === id)).filter((e): e is Empleado => !!e)
    const groups: Record<string, { headcount: number; bruto: number; neto: number; tss: number; costo: number }> = {}
    for (const emp of empleadosDelPeriodo) {
      const res = resultadoHistorico(emp, periodo)
      const d = emp.departamento || 'Sin Departamento'
      if (!groups[d]) groups[d] = { headcount: 0, bruto: 0, neto: 0, tss: 0, costo: 0 }
      groups[d].headcount++
      groups[d].bruto += res.totalBruto
      groups[d].neto  += res.salarioNeto
      groups[d].tss   += res.totalAportesEmpleador
      groups[d].costo += res.totalCostoEmpleador
    }
    const grandTotal = Object.values(groups).reduce((s, g) => s + g.costo, 0)
    return Object.entries(groups)
      .map(([depto, g]) => ({ depto, ...g, pct: grandTotal > 0 ? g.costo / grandTotal * 100 : 0 }))
      .sort((a, b) => b.costo - a.costo)
  }, [periodo, generado, empleados])

  const deptoVisible = useMemo(() => {
    if (!searchQ.trim()) return deptos
    const q = searchQ.toLowerCase()
    return deptos.filter(d => d.depto.toLowerCase().includes(q))
  }, [deptos, searchQ])

  const totales = useMemo(() => deptos.reduce((acc, d) => ({
    headcount: acc.headcount + d.headcount, bruto: acc.bruto + d.bruto,
    neto: acc.neto + d.neto, tss: acc.tss + d.tss, costo: acc.costo + d.costo,
  }), { headcount: 0, bruto: 0, neto: 0, tss: 0, costo: 0 }), [deptos])

  function exportarPDF() {
    if (!periodo || deptos.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Costo por Departamento', periodoLabel(periodo))
    autoTable(doc, {
      startY: 44,
      head: [['Departamento','Empleados','Sal. Bruto','Sal. Neto','TSS Empleador','Costo Total','% del Total']],
      body: deptos.map(d => [d.depto, `${d.headcount}`, formatRD(d.bruto, 0), formatRD(d.neto, 0), formatRD(d.tss, 0), formatRD(d.costo, 0), `${d.pct.toFixed(1)}%`]),
      foot: [['TOTALES', `${totales.headcount}`, formatRD(totales.bruto, 0), formatRD(totales.neto, 0), formatRD(totales.tss, 0), formatRD(totales.costo, 0), '100%']],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })
    doc.save(`costo-departamento-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportarXlsx() {
    if (!periodo || deptos.length === 0) return
    exportarExcel({
      nombreArchivo: `costo-departamento-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}`,
      empresa: empresa.nombre, rnc: empresa.rnc,
      hojas: [{
        nombre: 'Por Departamento', titulo: 'Costo por Departamento', subtitulo: periodoLabel(periodo),
        encabezados: ['Departamento','Empleados','Sal. Bruto','Sal. Neto','TSS Empleador','Costo Total','% del Total'],
        filas: deptos.map(d => [d.depto, d.headcount, d.bruto, d.neto, d.tss, d.costo, `${d.pct.toFixed(1)}%`]),
        totales: ['TOTALES', totales.headcount, totales.bruto, totales.neto, totales.tss, totales.costo, '100%'],
        anchos: [28, 14, 18, 18, 18, 18, 14],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader title="Costo por Departamento" desc="Masa salarial, headcount y costo total agrupado por área organizacional." onPDF={deptos.length > 0 ? exportarPDF : undefined} onExcel={deptos.length > 0 ? exportarXlsx : undefined} />
      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Período:
          <select value={periodoId} onChange={e => { setPeriodoId(e.target.value); setGenerado(false) }} className={selectCls}>
            {sorted.length === 0 ? <option value="">Sin períodos</option> : sorted.map(p => <option key={p.id} value={p.id}>{periodoLabel(p)}</option>)}
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} disabled={!periodoId} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>
      {!generado ? <EmptyState message="Selecciona un período y haz clic en Generar." /> : deptos.length === 0 ? <EmptyState message="No hay empleados activos en este período." /> : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Departamentos</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">{deptos.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Empleados</p>
              <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{totales.headcount}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Costo Total</p>
              <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{formatRD(totales.costo, 0)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{deptoVisible.length}/{deptos.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Departamento','Empleados','Sal. Bruto','Sal. Neto','TSS Empl.','Costo Total','% del Total'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 last:text-right first:text-left text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {deptoVisible.map(d => (
                    <tr key={d.depto} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{d.depto}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.headcount}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatRD(d.bruto, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatRD(d.neto, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatRD(d.tss, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 font-medium">{formatRD(d.costo, 0)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0 w-10 text-right">{d.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold text-right">
                    <td className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES</td>
                    <td className="px-5 py-3 tabular-nums">{totales.headcount}</td>
                    <td className="px-5 py-3 tabular-nums">{formatRD(totales.bruto, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-emerald-700 dark:text-emerald-300">{formatRD(totales.neto, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-amber-700 dark:text-amber-300">{formatRD(totales.tss, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-indigo-700 dark:text-indigo-300">{formatRD(totales.costo, 0)}</td>
                    <td className="px-5 py-3">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Planilla Bancaria / ACH ─────────────────────────────────────────
function ReportePlanillaACH({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const sorted = useMemo(() =>
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()),
    [periodos]
  )
  const bancos = useMemo(() => Array.from(new Set(empleados.map(e => e.banco).filter(Boolean))).sort() as string[], [empleados])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [filtroBanco, setFiltroBanco] = useState('todos')
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const periodo = sorted.find(p => p.id === periodoId)
  const sinCuenta = empleados.filter(e => e.activo && (!e.numeroCuenta || !e.banco)).length

  const filas = useMemo(() => {
    if (!periodo || !generado) return []
    return empleados
      .filter(e => e.activo && e.numeroCuenta && e.banco)
      .filter(e => filtroBanco === 'todos' || e.banco === filtroBanco)
      .map(emp => {
        const res = resultadoHistorico(emp, periodo)
        return { emp, neto: res.salarioNeto }
      })
      .sort((a, b) => (a.emp.banco ?? '').localeCompare(b.emp.banco ?? '') || fullName(a.emp).localeCompare(fullName(b.emp)))
  }, [periodo, generado, empleados, filtroBanco])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) => fullName(emp).toLowerCase().includes(q) || emp.departamento.toLowerCase().includes(q))
  }, [filas, searchQ])

  const totalNeto = useMemo(() => filas.reduce((s, f) => s + f.neto, 0), [filas])

  // ─── Validación antes de enviar ────────────────────────────────────────────
  // No existen especificaciones públicas oficiales, exactas y unificadas por
  // banco dominicano para un archivo de transferencia (ACH) — cada institución
  // maneja su propio formato interno. Las reglas de abajo son una
  // interpretación GENÉRICA y defendible de Cielo Cloud (no una spec bancaria
  // oficial), pensada para atrapar los errores de captura más comunes antes de
  // cargar la planilla al banco manualmente.
  const validacion = useMemo(() => {
    const issues: { empId: string; nombre: string; banco: string; nivel: 'error' | 'advertencia'; motivo: string }[] = []

    // Regla 1 (bloqueante): cuenta bancaria requerida. Se evalúa sobre TODOS
    // los empleados activos, sin importar el filtro de banco seleccionado —
    // es un requisito de completitud de datos, no de la vista filtrada, y un
    // empleado sin cuenta no puede recibir su pago por ACH en absoluto.
    for (const e of empleados) {
      if (!e.activo) continue
      if (!e.banco && !e.numeroCuenta) {
        issues.push({ empId: e.id, nombre: fullName(e), banco: '—', nivel: 'error', motivo: 'Sin banco ni número de cuenta registrados' })
      } else if (!e.banco) {
        issues.push({ empId: e.id, nombre: fullName(e), banco: '—', nivel: 'error', motivo: 'Falta el banco' })
      } else if (!e.numeroCuenta) {
        issues.push({ empId: e.id, nombre: fullName(e), banco: e.banco, nivel: 'error', motivo: 'Falta el número de cuenta' })
      }
    }

    // Conteo de "banco + # cuenta" (normalizado) dentro de la planilla ya generada, para la Regla 4
    const conteoCuentas = new Map<string, number>()
    for (const { emp } of filas) {
      const norm = (emp.numeroCuenta ?? '').replace(/[-\s]/g, '')
      const clave = `${emp.banco}|${norm}`
      conteoCuentas.set(clave, (conteoCuentas.get(clave) ?? 0) + 1)
    }

    for (const { emp, neto } of filas) {
      const nombre = fullName(emp)
      const banco = emp.banco ?? '—'
      const cuentaRaw = emp.numeroCuenta ?? ''
      const cuentaNorm = cuentaRaw.replace(/[-\s]/g, '')

      // Regla 2 (bloqueante): formato de número de cuenta — solo dígitos (se
      // permiten guiones/espacios como separadores visuales) y una longitud
      // razonable de 8 a 20 caracteres. Umbral genérico: cubre cuentas de
      // ahorro/corriente típicas de la banca dominicana sin atarse a la regla
      // interna exacta de un banco en particular.
      if (!/^\d+$/.test(cuentaNorm) || cuentaNorm.length < 8 || cuentaNorm.length > 20) {
        issues.push({ empId: emp.id, nombre, banco, nivel: 'error', motivo: `Formato de cuenta inválido ("${cuentaRaw}") — se esperan solo dígitos y 8–20 caracteres` })
      }

      // Regla 3 (bloqueante): caracteres que rompen archivos de texto plano /
      // delimitados que suelen usar los bancos para carga masiva (comillas,
      // pipe "|" o tabulador).
      if (/["'|\t]/.test(nombre)) {
        issues.push({ empId: emp.id, nombre, banco, nivel: 'error', motivo: 'El nombre contiene caracteres no permitidos (comillas, "|" o tabulador)' })
      }

      // Regla 4 (advertencia, no bloqueante): cuentas duplicadas — mismo banco
      // y mismo número de cuenta en dos empleados de la misma planilla. Puede
      // ser legítimo en casos raros (p. ej. una cuenta mancomunada), así que
      // se señala pero no bloquea el envío.
      const clave = `${emp.banco}|${cuentaNorm}`
      if ((conteoCuentas.get(clave) ?? 0) > 1) {
        issues.push({ empId: emp.id, nombre, banco, nivel: 'advertencia', motivo: `Cuenta compartida con otro(s) empleado(s) de esta planilla (${conteoCuentas.get(clave)} coinciden)` })
      }

      // Regla 5 (bloqueante): el monto neto a transferir debe ser mayor a cero
      if (neto <= 0) {
        issues.push({ empId: emp.id, nombre, banco, nivel: 'error', motivo: `Monto a transferir inválido (${formatRD(neto, 2)}) — debe ser mayor a cero` })
      }
    }

    // Regla 6: reconciliación de suma — control de integridad simple, debería
    // ser trivialmente cierto, pero se verifica como sanity check.
    const sumaFilas = filas.reduce((s, f) => s + f.neto, 0)
    const reconciliaOk = Math.abs(sumaFilas - totalNeto) < 0.01

    const idsConError = new Set(issues.filter(i => i.nivel === 'error').map(i => i.empId))
    const idsConAdvertencia = new Set(issues.filter(i => i.nivel === 'advertencia' && !idsConError.has(i.empId)).map(i => i.empId))
    // Universo de "candidatos a fila": los que sí están en la planilla filtrada,
    // más los empleados activos excluidos de entrada por falta de cuenta (Regla 1).
    const totalCandidatos = filas.length + empleados.filter(e => e.activo && (!e.banco || !e.numeroCuenta)).length
    const pasaron = Math.max(0, totalCandidatos - idsConError.size - idsConAdvertencia.size)

    return {
      errores: issues.filter(i => i.nivel === 'error'),
      advertencias: issues.filter(i => i.nivel === 'advertencia'),
      reconciliaOk,
      pasaron,
      totalCandidatos,
    }
  }, [empleados, filas, totalNeto])

  function exportarPDF() {
    if (!periodo || filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Planilla Bancaria / ACH', periodoLabel(periodo))
    autoTable(doc, {
      startY: 44,
      head: [['Empleado','Departamento','Banco','# Cuenta','Sal. Neto']],
      body: filas.map(({ emp, neto }) => [fullName(emp), emp.departamento, emp.banco ?? '—', emp.numeroCuenta ?? '—', neto.toFixed(2)]),
      foot: [['TOTALES', '', '', '', totalNeto.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })
    doc.save(`planilla-ach-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportarXlsx() {
    if (!periodo || filas.length === 0) return
    exportarExcel({
      nombreArchivo: `planilla-ach-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}`,
      empresa: empresa.nombre, rnc: empresa.rnc,
      hojas: [{
        nombre: 'ACH', titulo: 'Planilla Bancaria / ACH', subtitulo: periodoLabel(periodo),
        encabezados: ['Nombre','Apellido','Departamento','Banco','# Cuenta','Monto RD$'],
        filas: filas.map(({ emp, neto }) => [emp.nombre, emp.apellido, emp.departamento, emp.banco ?? '', emp.numeroCuenta ?? '', neto]),
        totales: ['TOTALES', '', '', '', '', totalNeto],
        anchos: [22, 22, 22, 18, 22, 16],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Planilla Bancaria / ACH"
        desc="Lista de transferencias por período, agrupadas por banco. Formato optimizado para carga bancaria."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
        disabled={validacion.errores.length > 0}
        disabledReason="Corrige los errores bloqueantes de la validación antes de exportar la planilla."
      />
      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Período:
          <select value={periodoId} onChange={e => { setPeriodoId(e.target.value); setGenerado(false) }} className={selectCls}>
            {sorted.length === 0 ? <option value="">Sin períodos</option> : sorted.map(p => <option key={p.id} value={p.id}>{periodoLabel(p)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Banco:
          <select value={filtroBanco} onChange={e => { setFiltroBanco(e.target.value); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            {bancos.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} disabled={!periodoId} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>
      {!generado ? <EmptyState message="Selecciona un período y haz clic en Generar." /> : filas.length === 0 ? <EmptyState message="No hay empleados con cuenta bancaria registrada para este filtro." /> : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Transferencias</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{filas.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total a Transferir</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatRD(totalNeto, 0)}</p>
            </div>
            {sinCuenta > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-xs text-amber-700 dark:text-amber-400">Sin cuenta bancaria</p>
                <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{sinCuenta} emp.</p>
              </div>
            )}
          </div>

          {/* Validación antes de enviar — reglas genéricas de Cielo Cloud (ver comentario en `validacion` arriba) */}
          <div className={`rounded-xl border p-4 ${
            validacion.errores.length > 0
              ? 'border-rose-200 dark:border-rose-800/40 bg-rose-50/60 dark:bg-rose-950/10'
              : validacion.advertencias.length > 0
              ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/10'
              : 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/10'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {validacion.errores.length > 0
                  ? <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                  : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Validación antes de enviar</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
                    Reglas genéricas de formato bancario — interpretación propia de Cielo Cloud ante la falta de especificaciones públicas exactas por banco.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0 pl-7 sm:pl-0">
                <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{validacion.pasaron} OK</span>
                <span className="tabular-nums font-semibold text-rose-700 dark:text-rose-400">{validacion.errores.length} error{validacion.errores.length === 1 ? '' : 'es'}</span>
                <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400">{validacion.advertencias.length} advertencia{validacion.advertencias.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {(validacion.errores.length > 0 || validacion.advertencias.length > 0) && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-zinc-200/70 dark:border-[#252840]/70 divide-y divide-zinc-200/70 dark:divide-[#252840]/70 bg-white/60 dark:bg-[#0d0f1a]/40">
                {[...validacion.errores, ...validacion.advertencias].map((iss, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    {iss.nivel === 'error'
                      ? <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{iss.nombre}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">{iss.banco}</span>
                    <span className={`text-xs ${iss.nivel === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{iss.motivo}</span>
                  </div>
                ))}
              </div>
            )}

            {!validacion.reconciliaOk && (
              <p className="mt-3 flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                La suma de las filas individuales no coincide con el total mostrado — posible problema de datos, revisa antes de enviar.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Empleado','Departamento','Banco','# Cuenta','Sal. Neto'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ emp, neto }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fullName(emp)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400">{emp.departamento}</td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400">{emp.banco ?? '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{emp.numeroCuenta ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatRD(neto, 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold">
                    <td colSpan={4} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTAL TRANSFERIR ({filasVisible.length} cuentas)</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatRD(totalNeto, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Horas Extras ─────────────────────────────────────────────────────
function ReporteHorasExtras({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const currentYear = new Date().getFullYear()
  const anios = useMemo(() => Array.from(new Set(periodos.map(p => p.anio))).sort((a, b) => b - a), [periodos])
  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  const [anioFiltro, setAnioFiltro] = useState<number>(currentYear)
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const filas = useMemo(() => {
    if (!generado) return []
    const rows: { empId: string; per: string; he35: number; imp35: number; he100: number; imp100: number; nocturnas: number; impNocturno: number; total: number }[] = []
    for (const p of periodos.filter(p => p.anio === anioFiltro && p.estado !== 'en_proceso')) {
      for (const [empId, ajustes] of Object.entries(p.ajustesPorEmpleado ?? {})) {
        const he35      = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a) => s + a.valor, 0)
        const he100     = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
        const nocturnas = ajustes.filter(a => a.concepto === 'recargo_nocturno').reduce((s, a) => s + a.valor, 0)
        if (he35 === 0 && he100 === 0 && nocturnas === 0) continue
        const emp = empMap[empId]
        if (!emp) continue
        const res = resultadoHistorico(emp, p)
        rows.push({
          empId, per: periodoLabel(p), he35, imp35: res.importeHE35, he100, imp100: res.importeHE100,
          nocturnas, impNocturno: res.importeNocturno,
          total: res.totalHorasExtras + res.importeNocturno,
        })
      }
    }
    return rows.sort((a, b) => a.per.localeCompare(b.per) || fullName(empMap[a.empId] ?? { nombre: a.empId, apellido: '' } as never).localeCompare(fullName(empMap[b.empId] ?? { nombre: b.empId, apellido: '' } as never)))
  }, [generado, periodos, anioFiltro, empMap])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(r => {
      const emp = empMap[r.empId]
      return emp ? fullName(emp).toLowerCase().includes(q) : false
    })
  }, [filas, searchQ, empMap])

  const resumen = useMemo(() => filas.reduce((acc, r) => ({
    he35: acc.he35 + r.he35, imp35: acc.imp35 + r.imp35,
    he100: acc.he100 + r.he100, imp100: acc.imp100 + r.imp100,
    nocturnas: acc.nocturnas + r.nocturnas, impNocturno: acc.impNocturno + r.impNocturno,
    total: acc.total + r.total,
  }), { he35: 0, imp35: 0, he100: 0, imp100: 0, nocturnas: 0, impNocturno: 0, total: 0 }), [filas])

  // ─── Topes legales de horas extras (Art. 155, Código de Trabajo) ───────────
  // Decisión de alcance: horas_extras_35 Y horas_extras_100 cuentan para AMBOS
  // topes (trimestral y semanal aprox.). El Art. 155 limita el NÚMERO de horas
  // extraordinarias trabajadas más allá de la jornada ordinaria — no distingue
  // según la tarifa de recargo con que se pagaron (35% ordinario vs 100%
  // feriado). En una alerta de cumplimiento es más prudente sumar todas las
  // horas extraordinarias que fraccionar el criterio y subestimar el riesgo
  // real de exceso frente a la ley.
  //
  // Tope trimestral (80h): cálculo EXACTO — se agrupan los períodos por
  // trimestre calendario y se suman las horas registradas, sin aproximación.
  //
  // Tope "semanal" (24h): el sistema NO registra horas por semana calendario
  // (solo por período mensual/quincenal), así que este valor es una
  // APROXIMACIÓN explícita — horas del período ÷ semanas aproximadas que
  // contiene el período (mensual ≈ 4.33, quincenal ≈ 2.17). Se advierte esto
  // visiblemente en la UI (ver nota debajo del título de la sección).
  const datosTopePeriodo = useMemo(() => {
    if (!generado) return []
    const rows: { empId: string; per: string; trimestre: 1 | 2 | 3 | 4; horas: number; semanas: number; promedioSemanal: number }[] = []
    for (const p of periodos.filter(p => p.anio === anioFiltro && p.estado !== 'en_proceso')) {
      const semanas = p.tipo === 'quincenal' ? 2.17 : 4.33
      const trimestre = Math.ceil(p.mes / 3) as 1 | 2 | 3 | 4
      for (const [empId, ajustes] of Object.entries(p.ajustesPorEmpleado ?? {})) {
        if (!empMap[empId]) continue
        const he35  = ajustes.filter(a => a.concepto === 'horas_extras_35').reduce((s, a) => s + a.valor, 0)
        const he100 = ajustes.filter(a => a.concepto === 'horas_extras_100').reduce((s, a) => s + a.valor, 0)
        const horas = he35 + he100
        if (horas === 0) continue
        rows.push({ empId, per: periodoLabel(p), trimestre, horas, semanas, promedioSemanal: horas / semanas })
      }
    }
    return rows
  }, [generado, periodos, anioFiltro, empMap])

  const TOPE_TRIMESTRAL_HORAS = 80
  const TOPE_SEMANAL_HORAS = 24
  const UMBRAL_ALERTA_PCT = 0.9 // ámbar desde 90% del tope; rojo al superarlo
  const TRIMESTRE_LABEL: Record<number, string> = { 1: 'T1 (Ene–Mar)', 2: 'T2 (Abr–Jun)', 3: 'T3 (Jul–Sep)', 4: 'T4 (Oct–Dic)' }

  const alertasTrimestrales = useMemo(() => {
    const map = new Map<string, { empId: string; trimestre: 1 | 2 | 3 | 4; horas: number }>()
    for (const r of datosTopePeriodo) {
      const key = `${r.empId}-${r.trimestre}`
      const cur = map.get(key) ?? { empId: r.empId, trimestre: r.trimestre, horas: 0 }
      cur.horas += r.horas
      map.set(key, cur)
    }
    return [...map.values()]
      .filter(a => a.horas >= TOPE_TRIMESTRAL_HORAS * UMBRAL_ALERTA_PCT)
      .sort((a, b) => b.horas - a.horas || a.trimestre - b.trimestre)
  }, [datosTopePeriodo])

  const alertasSemanales = useMemo(() =>
    datosTopePeriodo
      .filter(r => r.promedioSemanal >= TOPE_SEMANAL_HORAS * UMBRAL_ALERTA_PCT)
      .sort((a, b) => b.promedioSemanal - a.promedioSemanal),
    [datosTopePeriodo]
  )

  const hayAlertasTopes = alertasTrimestrales.length > 0 || alertasSemanales.length > 0

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Reporte de Horas Extras', `Año ${anioFiltro}`)
    autoTable(doc, {
      startY: 44,
      head: [['Empleado','Período','Hrs 35%','Importe 35%','Hrs 100%','Importe 100%','Hrs Noct.','Importe Noct.','Total HE']],
      body: filas.map(r => {
        const emp = empMap[r.empId]
        return [emp ? fullName(emp) : r.empId, r.per, r.he35.toFixed(1), r.imp35.toFixed(2), r.he100.toFixed(1), r.imp100.toFixed(2), r.nocturnas.toFixed(1), r.impNocturno.toFixed(2), r.total.toFixed(2)]
      }),
      foot: [['TOTALES', '', resumen.he35.toFixed(1), resumen.imp35.toFixed(2), resumen.he100.toFixed(1), resumen.imp100.toFixed(2), resumen.nocturnas.toFixed(1), resumen.impNocturno.toFixed(2), resumen.total.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })
    doc.save(`horas-extras-${anioFiltro}.pdf`)
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: `horas-extras-${anioFiltro}`,
      empresa: empresa.nombre, rnc: empresa.rnc,
      hojas: [{
        nombre: 'Horas Extras', titulo: 'Reporte de Horas Extras', subtitulo: `Año ${anioFiltro}`,
        encabezados: ['Empleado','Período','Horas 35%','Importe 35%','Horas 100%','Importe 100%','Horas Noct.','Importe Noct.','Total HE'],
        filas: filas.map(r => {
          const emp = empMap[r.empId]
          return [emp ? fullName(emp) : r.empId, r.per, r.he35, r.imp35, r.he100, r.imp100, r.nocturnas, r.impNocturno, r.total]
        }),
        totales: ['TOTALES', '', resumen.he35, resumen.imp35, resumen.he100, resumen.imp100, resumen.nocturnas, resumen.impNocturno, resumen.total],
        anchos: [32, 22, 14, 16, 14, 16, 14, 16, 16],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader title="Horas Extras" desc="Detalle de horas extras al 35% y 100% por empleado y período (Ley 16-92 Art. 203)." onPDF={filas.length > 0 ? exportarPDF : undefined} onExcel={filas.length > 0 ? exportarXlsx : undefined} />
      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Año:
          <select value={anioFiltro} onChange={e => { setAnioFiltro(+e.target.value); setGenerado(false) }} className={selectCls}>
            {anios.length === 0 ? <option value={currentYear}>{currentYear}</option> : anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>
      {!generado ? <EmptyState message="Selecciona un año y haz clic en Generar." /> : filas.length === 0 ? <EmptyState message="No se registraron horas extras en este año." /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Horas Extras 35%</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{resumen.he35.toFixed(1)} hrs</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{formatRD(resumen.imp35, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Horas Extras 100%</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{resumen.he100.toFixed(1)} hrs</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{formatRD(resumen.imp100, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Recargo Nocturno (15%)</p>
              <p className="mt-1 text-xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">{resumen.nocturnas.toFixed(1)} hrs</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{formatRD(resumen.impNocturno, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Importe HE</p>
              <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{formatRD(resumen.total, 0)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Empleado','Período','Hrs 35%','Importe 35%','Hrs 100%','Importe 100%','Hrs Noct.','Importe Noct.','Total HE'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map((r, idx) => {
                    const emp = empMap[r.empId]
                    return (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{emp ? fullName(emp) : r.empId}</td>
                        <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{r.per}</td>
                        <td className="px-5 py-3 tabular-nums text-center text-amber-700 dark:text-amber-400">{r.he35.toFixed(1)}</td>
                        <td className="px-5 py-3 tabular-nums text-right text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(r.imp35, 0)}</td>
                        <td className="px-5 py-3 tabular-nums text-center text-rose-700 dark:text-rose-400">{r.he100.toFixed(1)}</td>
                        <td className="px-5 py-3 tabular-nums text-right text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatRD(r.imp100, 0)}</td>
                        <td className="px-5 py-3 tabular-nums text-center text-sky-700 dark:text-sky-400">{r.nocturnas.toFixed(1)}</td>
                        <td className="px-5 py-3 tabular-nums text-right text-sky-700 dark:text-sky-400 whitespace-nowrap">{formatRD(r.impNocturno, 0)}</td>
                        <td className="px-5 py-3 tabular-nums text-right font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{formatRD(r.total, 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold">
                    <td colSpan={2} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filasVisible.length} registros)</td>
                    <td className="px-5 py-3 tabular-nums text-center text-amber-700 dark:text-amber-300">{resumen.he35.toFixed(1)}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(resumen.imp35, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-center text-rose-700 dark:text-rose-300">{resumen.he100.toFixed(1)}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-rose-700 dark:text-rose-300 whitespace-nowrap">{formatRD(resumen.imp100, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-center text-sky-700 dark:text-sky-300">{resumen.nocturnas.toFixed(1)}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-sky-700 dark:text-sky-300 whitespace-nowrap">{formatRD(resumen.impNocturno, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{formatRD(resumen.total, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-3.5 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alertas de Topes Legales (Art. 155, Código de Trabajo)</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Empleados que superan o se acercan (≥90%) al límite de 80 horas extraordinarias acumuladas por trimestre calendario de {anioFiltro}, o a un promedio semanal aproximado de 24 horas. Incluye horas al 35% y al 100%.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-zinc-100 dark:border-[#1d2035] bg-amber-50/60 dark:bg-amber-950/10 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>El tope trimestral (80h) es un cálculo exacto</strong> — suma las horas registradas en los períodos de cada trimestre calendario.
                <strong> El promedio semanal (24h) es una aproximación</strong>: el sistema registra horas extra por período mensual o quincenal, no por
                semana calendario individual — el valor mostrado divide las horas del período entre el número aproximado de semanas que contiene
                (≈4.33 en nómina mensual, ≈2.17 en quincenal). Para un control exacto de este límite se requeriría registrar horas extra por semana calendario.
              </p>
            </div>

            {!hayAlertasTopes ? (
              <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Ningún empleado se acerca a los topes de horas extras en {anioFiltro}.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-[#1d2035]">
                {alertasTrimestrales.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Tope trimestral — 80 horas acumuladas (cálculo exacto)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Empleado</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Trimestre</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Horas Acumuladas</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Progreso</th>
                            <th className="py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                          {alertasTrimestrales.map(a => {
                            const emp = empMap[a.empId]
                            const pct = a.horas / TOPE_TRIMESTRAL_HORAS * 100
                            const excede = a.horas > TOPE_TRIMESTRAL_HORAS
                            return (
                              <tr key={`${a.empId}-${a.trimestre}`}>
                                <td className="pr-4 py-2 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{emp ? fullName(emp) : a.empId}</td>
                                <td className="pr-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{TRIMESTRE_LABEL[a.trimestre]} {anioFiltro}</td>
                                <td className="pr-4 py-2 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{a.horas.toFixed(1)} hrs</td>
                                <td className="pr-4 py-2">
                                  <div className="w-28 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                                    <div className={`h-full rounded-full ${excede ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                </td>
                                <td className="py-2">
                                  <Badge variant={excede ? 'danger' : 'warning'}>
                                    {excede ? `+${(a.horas - TOPE_TRIMESTRAL_HORAS).toFixed(1)}h sobre el tope` : `${pct.toFixed(0)}% del tope`}
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {alertasSemanales.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Tope semanal — 24 horas (promedio aproximado por período, ver nota arriba)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Empleado</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Período</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Horas del Período</th>
                            <th className="pr-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Promedio Semanal Aprox.</th>
                            <th className="py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                          {alertasSemanales.map((r, idx) => {
                            const emp = empMap[r.empId]
                            const excede = r.promedioSemanal > TOPE_SEMANAL_HORAS
                            return (
                              <tr key={`${r.empId}-${idx}`}>
                                <td className="pr-4 py-2 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{emp ? fullName(emp) : r.empId}</td>
                                <td className="pr-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{r.per}</td>
                                <td className="pr-4 py-2 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{r.horas.toFixed(1)} hrs</td>
                                <td className="pr-4 py-2 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">≈ {r.promedioSemanal.toFixed(1)} hrs/sem.</td>
                                <td className="py-2">
                                  <Badge variant={excede ? 'danger' : 'warning'}>{excede ? 'Excede aprox.' : 'Cerca del tope'}</Badge>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Proyección Anual ─────────────────────────────────────────────────
function ReporteProyeccionAnual({
  empresa, empleados, periodos,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
}) {
  const currentYear = new Date().getFullYear()
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  // Recorre los empleados REALMENTE incluidos en cada período (snapshot
  // resultadosPorEmpleado si existe, o todos los activos como respaldo para
  // períodos anteriores a ese campo) — NO las claves de ajustesPorEmpleado,
  // que solo contienen a quien tuvo al menos un ajuste (préstamo, bono, etc.)
  // ese período. Un empleado con nómina plana (sin ningún ajuste, el caso más
  // común) no aparece en ajustesPorEmpleado y quedaba excluido por completo
  // del costo YTD real, subestimando el % Ejecutado de la proyección.
  const ytdCostoPorEmp = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of periodos.filter(p => p.anio === currentYear && p.estado !== 'en_proceso')) {
      const idsDelPeriodo = p.resultadosPorEmpleado && Object.keys(p.resultadosPorEmpleado).length > 0
        ? Object.keys(p.resultadosPorEmpleado)
        : empleados.filter(e => e.activo).map(e => e.id)
      for (const empId of idsDelPeriodo) {
        const emp = empleados.find(e => e.id === empId)
        if (!emp) continue
        const res = resultadoHistorico(emp, p)
        map[empId] = (map[empId] ?? 0) + res.totalCostoEmpleador
      }
    }
    return map
  }, [periodos, empleados, currentYear])

  const filas = useMemo(() => {
    if (!generado) return []
    return empleados.filter(e => e.activo).map(emp => {
      const res = calcularNomina(emp, {})
      const brutoAnual      = res.salarioBruto * 12
      const costoMensual    = res.totalCostoEmpleador
      const regalia         = res.regaliaPascual * 12
      const vacaciones      = res.vacacionesMensualesValor * 12
      const totalProyectado = costoMensual * 12 + regalia + vacaciones
      const ytdReal         = ytdCostoPorEmp[emp.id] ?? 0
      const pctEjecutado    = totalProyectado > 0 ? ytdReal / totalProyectado * 100 : 0
      return { emp, brutoAnual, costoMensual, regalia, vacaciones, totalProyectado, ytdReal, pctEjecutado }
    }).sort((a, b) => b.totalProyectado - a.totalProyectado)
  }, [generado, empleados, ytdCostoPorEmp])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) =>
      fullName(emp).toLowerCase().includes(q) ||
      emp.cargo.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

  const totales = useMemo(() => filas.reduce((acc, r) => ({
    brutoAnual: acc.brutoAnual + r.brutoAnual,
    regalia: acc.regalia + r.regalia,
    vacaciones: acc.vacaciones + r.vacaciones,
    totalProyectado: acc.totalProyectado + r.totalProyectado,
    ytdReal: acc.ytdReal + r.ytdReal,
  }), { brutoAnual: 0, regalia: 0, vacaciones: 0, totalProyectado: 0, ytdReal: 0 }), [filas])

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Proyección Anual de Nómina', `Año ${currentYear}`)
    autoTable(doc, {
      startY: 44,
      head: [['Empleado','Cargo','Sal. Base','Bruto × 12','Regalía','Vacaciones','Costo Total Proy.','YTD Real','% Ejec.']],
      body: filas.map(r => [
        fullName(r.emp), r.emp.cargo, formatRD(r.emp.salarioBase, 0),
        formatRD(r.brutoAnual, 0), formatRD(r.regalia, 0), formatRD(r.vacaciones, 0),
        formatRD(r.totalProyectado, 0), formatRD(r.ytdReal, 0), `${r.pctEjecutado.toFixed(1)}%`,
      ]),
      foot: [['TOTALES', '', '', formatRD(totales.brutoAnual, 0), formatRD(totales.regalia, 0), formatRD(totales.vacaciones, 0), formatRD(totales.totalProyectado, 0), formatRD(totales.ytdReal, 0), '']],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'center' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })
    doc.save(`proyeccion-anual-${currentYear}.pdf`)
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: `proyeccion-anual-${currentYear}`,
      empresa: empresa.nombre, rnc: empresa.rnc,
      hojas: [{
        nombre: 'Proyección', titulo: 'Proyección Anual de Nómina', subtitulo: `Año ${currentYear}`,
        encabezados: ['Empleado','Cargo','Departamento','Sal. Base','Bruto × 12','Regalía Proy.','Vacaciones Proy.','Costo Total Proy.','YTD Real','% Ejecutado'],
        filas: filas.map(r => [fullName(r.emp), r.emp.cargo, r.emp.departamento, r.emp.salarioBase, r.brutoAnual, r.regalia, r.vacaciones, r.totalProyectado, r.ytdReal, `${r.pctEjecutado.toFixed(1)}%`]),
        totales: ['TOTALES','','', '', totales.brutoAnual, totales.regalia, totales.vacaciones, totales.totalProyectado, totales.ytdReal, ''],
        anchos: [28, 22, 20, 16, 18, 16, 16, 18, 16, 14],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader title="Proyección Anual" desc={`Costo laboral proyectado para ${currentYear} (incluyendo regalía y vacaciones) vs. ejecutado YTD.`} onPDF={filas.length > 0 ? exportarPDF : undefined} onExcel={filas.length > 0 ? exportarXlsx : undefined} />
      <FilterBar>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Proyección para el año fiscal <strong className="text-zinc-800 dark:text-zinc-200">{currentYear}</strong></span>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>
      {!generado ? <EmptyState message="Haz clic en Generar para calcular la proyección del año en curso." /> : filas.length === 0 ? <EmptyState message="No hay empleados activos." /> : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Empleados en Proyección</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{filas.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Costo Total Proyectado</p>
              <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{formatRD(totales.totalProyectado, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Ejecutado YTD</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatRD(totales.ytdReal, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">% Ejecutado</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {totales.totalProyectado > 0 ? (totales.ytdReal / totales.totalProyectado * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre, cargo o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Empleado','Cargo','Sal. Base','Bruto × 12','Regalía','Vacaciones','Total Proyectado','YTD Real','% Ejec.'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap last:text-center text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ emp, brutoAnual, regalia, vacaciones, totalProyectado, ytdReal, pctEjecutado }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fullName(emp)}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{emp.departamento}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{emp.cargo}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(emp.salarioBase, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{formatRD(brutoAnual, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(regalia, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatRD(vacaciones, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 font-semibold whitespace-nowrap">{formatRD(totalProyectado, 0)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatRD(ytdReal, 0)}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="w-14 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                            <div className={`h-full rounded-full ${pctEjecutado >= 90 ? 'bg-emerald-500' : pctEjecutado >= 50 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pctEjecutado)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0">{pctEjecutado.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold text-right">
                    <td colSpan={3} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filasVisible.length} empleados)</td>
                    <td className="px-5 py-3 tabular-nums whitespace-nowrap">{formatRD(totales.brutoAnual, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.regalia, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatRD(totales.vacaciones, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{formatRD(totales.totalProyectado, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{formatRD(totales.ytdReal, 0)}</td>
                    <td className="px-5 py-3 text-center text-xs">
                      {totales.totalProyectado > 0 ? `${(totales.ytdReal / totales.totalProyectado * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Cumplimiento de Preaviso (Art. 76) ───────────────────────────────
function ReportePreaviso({
  empresa, empleados, liquidaciones,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  liquidaciones: RegistroLiquidacion[]
}) {
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'cumplio' | 'incumplio'>('todos')
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const empMap = useMemo(() =>
    Object.fromEntries(empleados.map(e => [e.id, e])),
    [empleados]
  )

  // Solo renuncias con fecha de notificación capturada tienen algo que evaluar
  const renuncias = useMemo(() =>
    liquidaciones.filter(l => l.motivo === 'renuncia' && l.fechaNotificacionRenuncia),
    [liquidaciones]
  )

  const filas = useMemo(() => {
    if (!generado) return []
    return renuncias
      .map(l => {
        const diasRequeridos = getDiasPreavisoRequeridos(l.anosServicio)
        const diasReales = Math.round(
          (new Date(l.fechaTerminacion).getTime() - new Date(l.fechaNotificacionRenuncia!).getTime())
          / (24 * 3600 * 1000)
        )
        const diferencia = diasReales - diasRequeridos
        const cumplio = diferencia >= 0
        return { l, emp: empMap[l.empleadoId], diasRequeridos, diasReales, diferencia, cumplio }
      })
      .filter(r => filtroEstado === 'todos' || (filtroEstado === 'cumplio' ? r.cumplio : !r.cumplio))
      .sort((a, b) => b.l.fechaTerminacion.localeCompare(a.l.fechaTerminacion))
  }, [generado, renuncias, empMap, filtroEstado])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) => emp && fullName(emp).toLowerCase().includes(q))
  }, [filas, searchQ])

  const summary = useMemo(() => {
    const total = filas.length
    const cumplieron = filas.filter(r => r.cumplio).length
    const incumplieron = total - cumplieron
    return { total, cumplieron, incumplieron }
  }, [filas])

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Cumplimiento de Preaviso en Renuncias', 'Art. 76 — Código de Trabajo')

    autoTable(doc, {
      startY: 44,
      head: [['Empleado', 'Antigüedad', 'Fecha Notificación', 'Fecha Terminación', 'Días Exigidos', 'Días Reales', 'Diferencia', 'Estado']],
      body: filas.map(({ l, emp, diasRequeridos, diasReales, diferencia, cumplio }) => [
        emp ? fullName(emp) : 'Empleado eliminado',
        formatAnosServicio(l.anosServicio),
        formatDate(l.fechaNotificacionRenuncia!),
        formatDate(l.fechaTerminacion),
        `${diasRequeridos}`,
        `${diasReales}`,
        `${diferencia >= 0 ? '+' : ''}${diferencia}`,
        cumplio ? 'Cumplió' : 'Incumplió',
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save('cumplimiento-preaviso-renuncias.pdf')
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: 'cumplimiento-preaviso-renuncias',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Preaviso',
        titulo: 'Cumplimiento de Preaviso en Renuncias',
        subtitulo: 'Art. 76 — Código de Trabajo',
        encabezados: ['Empleado', 'Antigüedad', 'Fecha Notificación', 'Fecha Terminación', 'Días Exigidos', 'Días Reales', 'Diferencia', 'Estado'],
        filas: filas.map(({ l, emp, diasRequeridos, diasReales, diferencia, cumplio }) => [
          emp ? fullName(emp) : 'Empleado eliminado',
          formatAnosServicio(l.anosServicio),
          formatDate(l.fechaNotificacionRenuncia!),
          formatDate(l.fechaTerminacion),
          diasRequeridos, diasReales, diferencia,
          cumplio ? 'Cumplió' : 'Incumplió',
        ]),
        anchos: [30, 16, 18, 18, 14, 14, 12, 12],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Cumplimiento de Preaviso en Renuncias"
        desc="Art. 76 — compara la anticipación real con la que el empleado debía dar según su antigüedad al renunciar."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Estado:
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value as typeof filtroEstado); setGenerado(false) }} className={selectCls}>
            <option value="todos">Todos</option>
            <option value="cumplio">Cumplió</option>
            <option value="incumplio">Incumplió</option>
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Selecciona un estado y haz clic en Generar para ver el reporte." />
      ) : renuncias.length === 0 ? (
        <EmptyState message="No hay renuncias con fecha de notificación registrada todavía. Captúrala al finalizar una liquidación por renuncia." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay renuncias que coincidan con el filtro seleccionado." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Renuncias Evaluadas</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Cumplieron</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{summary.cumplieron}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Incumplieron</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{summary.incumplieron}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre de empleado…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Antigüedad</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Fecha Notificación</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Fecha Terminación</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Días Exigidos</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Días Reales</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Diferencia</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ l, emp, diasRequeridos, diasReales, diferencia, cumplio }) => (
                    <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400 whitespace-nowrap">
                          {emp ? fullName(emp) : 'Empleado eliminado'}
                        </p>
                        {emp && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{emp.cargo}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatAnosServicio(l.anosServicio)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaNotificacionRenuncia!)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaTerminacion)}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-zinc-700 dark:text-zinc-300">{diasRequeridos}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-zinc-700 dark:text-zinc-300">{diasReales}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium">
                        <span className={diferencia >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                          {diferencia >= 0 ? '+' : ''}{diferencia}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cumplio ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50">
                            <CheckCircle2 className="h-3 w-3" />
                            Cumplió
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/50">
                            <XCircle className="h-3 w-3" />
                            Incumplió
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Antigüedad de Plantilla ──────────────────────────────────────────
// Buckets de rango: alineados con umbrales ya usados en el motor de nómina
// (5 años = corte de Vacaciones 14→18 días, Art. 177) y con bandas de uso
// habitual en RRHH para lectura gerencial rápida (< 1 / 1-3 / 3-5 / 5-10 / 10+).
const RANGOS_ANTIGUEDAD: { id: string; label: string; min: number; max: number }[] = [
  { id: 'menos1', label: '< 1 año',     min: 0,  max: 1 },
  { id: '1a3',    label: '1 – 3 años',  min: 1,  max: 3 },
  { id: '3a5',    label: '3 – 5 años',  min: 3,  max: 5 },
  { id: '5a10',   label: '5 – 10 años', min: 5,  max: 10 },
  { id: '10mas',  label: '10+ años',    min: 10, max: Infinity },
]

function ReporteAntiguedad({
  empresa, empleados,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
}) {
  const [tab, setTab] = useState<'rango' | 'posicion'>('rango')
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const activos = useMemo(() => empleados.filter(e => e.activo), [empleados])

  // Ordenado de mayor a menor antigüedad — lectura natural para un reporte
  // de "plantilla" (quiénes llevan más tiempo primero).
  const filas = useMemo(() => {
    if (!generado) return []
    return activos
      .map(emp => ({ emp, anos: getAnosServicio(emp.fechaIngreso) }))
      .sort((a, b) => b.anos - a.anos)
  }, [generado, activos])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) =>
      fullName(emp).toLowerCase().includes(q) ||
      emp.cedula.includes(q) ||
      emp.cargo.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

  const porRango = useMemo(() => {
    if (filas.length === 0) return []
    return RANGOS_ANTIGUEDAD.map(r => {
      const count = filas.filter(({ anos }) => anos >= r.min && anos < r.max).length
      return { ...r, count, pct: (count / filas.length) * 100 }
    })
  }, [filas])

  const porPosicion = useMemo(() => {
    if (filas.length === 0) return []
    const groups: Record<string, { cargo: string; count: number; sumAnos: number }> = {}
    for (const { emp, anos } of filas) {
      const cargo = emp.cargo || 'Sin Cargo'
      if (!groups[cargo]) groups[cargo] = { cargo, count: 0, sumAnos: 0 }
      groups[cargo].count++
      groups[cargo].sumAnos += anos
    }
    const list = Object.values(groups).map(g => ({ cargo: g.cargo, count: g.count, avgAnos: g.sumAnos / g.count }))
    const maxAvg = Math.max(...list.map(g => g.avgAnos), 0.0001)
    return list
      .map(g => ({ ...g, pct: (g.avgAnos / maxAvg) * 100 }))
      .sort((a, b) => b.avgAnos - a.avgAnos)
  }, [filas])

  // filas ya viene ordenado desc por antigüedad, así que filas[0] es el más antiguo
  const resumen = useMemo(() => {
    if (filas.length === 0) return null
    const promedio = filas.reduce((s, f) => s + f.anos, 0) / filas.length
    const masAntiguo = filas[0]
    const cargos = new Set(filas.map(f => f.emp.cargo)).size
    return { promedio, masAntiguo, cargos }
  }, [filas])

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // ─── Página 1: Resumen — por rango de años y por posición ──────────────
    pdfHeader(doc, empresa, 'Antigüedad de Plantilla', `${filas.length} empleados activos`)

    autoTable(doc, {
      startY: 44,
      head: [['Rango de Antigüedad', 'Empleados', '% del Total']],
      body: porRango.map(r => [r.label, `${r.count}`, `${r.pct.toFixed(1)}%`]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      tableWidth: 120,
    })

    const docTyped = doc as jsPDF & { lastAutoTable: { finalY: number } }
    const afterRango = docTyped.lastAutoTable?.finalY ?? 44

    autoTable(doc, {
      startY: afterRango + 10,
      head: [['Posición / Cargo', 'Empleados', 'Antigüedad Promedio']],
      body: porPosicion.map(p => [p.cargo, `${p.count}`, formatAnosServicio(p.avgAnos)]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      tableWidth: 150,
    })

    // ─── Página 2: Detalle por empleado (respaldo de auditoría) ────────────
    doc.addPage()
    pdfHeader(doc, empresa, 'Antigüedad de Plantilla — Detalle por Empleado', `${filas.length} empleados activos`)

    autoTable(doc, {
      startY: 44,
      head: [['Nombre', 'Cargo', 'Departamento', 'Fecha de Ingreso', 'Antigüedad']],
      body: filas.map(({ emp, anos }) => [
        fullName(emp), emp.cargo, emp.departamento, formatDate(emp.fechaIngreso), formatAnosServicio(anos),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save('antiguedad-plantilla.pdf')
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: 'antiguedad-plantilla',
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [
        {
          nombre: 'Por Rango',
          titulo: 'Antigüedad de Plantilla — Por Rango de Años',
          subtitulo: `${filas.length} empleados activos`,
          encabezados: ['Rango de Antigüedad', 'Empleados', '% del Total'],
          filas: porRango.map(r => [r.label, r.count, `${r.pct.toFixed(1)}%`]),
          anchos: [22, 14, 14],
        },
        {
          nombre: 'Por Posición',
          titulo: 'Antigüedad de Plantilla — Por Posición',
          subtitulo: `${filas.length} empleados activos`,
          encabezados: ['Posición / Cargo', 'Empleados', 'Antigüedad Promedio (años)'],
          filas: porPosicion.map(p => [p.cargo, p.count, Number(p.avgAnos.toFixed(2))]),
          anchos: [26, 14, 22],
        },
        {
          nombre: 'Detalle',
          titulo: 'Antigüedad de Plantilla — Detalle por Empleado',
          subtitulo: `${filas.length} empleados activos`,
          encabezados: ['Nombre', 'Cargo', 'Departamento', 'Fecha de Ingreso', 'Antigüedad'],
          filas: filas.map(({ emp, anos }) => [
            fullName(emp), emp.cargo, emp.departamento, formatDate(emp.fechaIngreso), formatAnosServicio(anos),
          ]),
          anchos: [28, 22, 20, 16, 20],
        },
      ],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Antigüedad de Plantilla"
        desc="Distribución de la antigüedad de los empleados activos por rango de años y por posición."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Calcula la antigüedad de los <strong className="text-zinc-800 dark:text-zinc-200">{activos.length}</strong> empleados activos
        </span>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      {!generado ? (
        <EmptyState message="Haz clic en Generar para calcular la antigüedad de la plantilla activa." />
      ) : filas.length === 0 ? (
        <EmptyState message="No hay empleados activos para calcular antigüedad." />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Empleados Activos</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{filas.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Antigüedad Promedio</p>
              <p className="mt-1 text-xl font-bold text-[#1B2980] dark:text-indigo-400 tabular-nums">
                {resumen ? formatAnosServicio(resumen.promedio) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Empleado Más Antiguo</p>
              <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {resumen ? fullName(resumen.masAntiguo.emp) : '—'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{resumen ? formatAnosServicio(resumen.masAntiguo.anos) : ''}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Posiciones Representadas</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{resumen?.cargos ?? 0}</p>
            </div>
          </div>

          {/* Tabs: Por Rango de Años / Por Posición */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 flex gap-0">
              {([
                { id: 'rango',    label: 'Por Rango de Años' },
                { id: 'posicion', label: 'Por Posición' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-[#1B2980] text-[#1B2980] dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'rango' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rango de Antigüedad</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">% del Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {porRango.map(r => (
                      <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{r.label}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-zinc-600 dark:text-zinc-400">{r.count}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${r.pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0 w-12 text-right">{r.pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Posición / Cargo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                    {porPosicion.map(p => (
                      <tr key={p.cargo} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{p.cargo}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-zinc-600 dark:text-zinc-400">{p.count}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p.pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0 whitespace-nowrap text-right">{formatAnosServicio(p.avgAnos)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detalle por empleado */}
          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Detalle por Empleado</h2>
            </div>
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar por nombre, cédula, cargo o departamento…"
                className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none"
              />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Nombre', 'Cargo', 'Departamento', 'Fecha de Ingreso', 'Antigüedad'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ emp, anos }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400 whitespace-nowrap">{fullName(emp)}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatCedula(emp.cedula)}</p>
                      </td>
                      <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{emp.cargo}</td>
                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{emp.departamento}</td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(emp.fechaIngreso)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatAnosServicio(anos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Empleados Sin Ingresos ──────────────────────────────────────────
// Auditoría de integridad pre-cierre: compara la plantilla que debía estar
// activa durante el mes de un período contra lo que realmente quedó
// registrado en la nómina de ese período (CLAUDE.md, Media Prioridad —
// "prerequisito también de una futura integración TSS").
function finDeMes(mes: number, anio: number): Date {
  return new Date(anio, mes, 0, 23, 59, 59, 999)
}

type MotivoSinIngreso = 'no_procesado' | 'bruto_cero'

function ReporteSinIngresos({
  empresa, empleados, periodos, liquidaciones,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  periodos: PeriodoNomina[]
  liquidaciones: RegistroLiquidacion[]
}) {
  const sorted = useMemo(() =>
    [...periodos].filter(p => p.estado !== 'en_proceso').sort((a, b) =>
      new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
    ), [periodos])

  const [periodoId, setPeriodoId] = useState<string>(sorted[0]?.id ?? '')
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const periodo = sorted.find(p => p.id === periodoId)

  // ─── "Activo durante el mes" ────────────────────────────────────────────
  // Unión de dos casos:
  // 1. Empleados activos HOY con fechaIngreso <= fin de mes (el caso normal).
  // 2. Empleados YA liquidados hoy, pero cuya fechaTerminacion (registrada en
  //    Liquidación) cae DESPUÉS del fin de este mes — el mes completo debía
  //    habérseles pagado por nómina normal, la liquidación llegó después. Sin
  //    este cruce contra useLiquidaciones(), un empleado ya desvinculado hoy
  //    desaparecería del filtro `activo` y ocultaría una brecha real de un
  //    mes en el que sí trabajó el período completo.
  // Se EXCLUYE cualquier empleado con fechaTerminacion DENTRO o ANTES de este
  // mes: su compensación de ese mes salió (parcial o totalmente) del módulo
  // de Liquidación, no de Nómina — que el período normal no lo procese es el
  // comportamiento esperado, no una brecha de integridad.
  // También se excluye — literalmente per spec — cualquier `suspendido`
  // vigente HOY (el modelo de datos no trackea suspensiones históricas por
  // mes, solo el estado vigente con su fecha de inicio; es la única señal
  // disponible y es razonable para el uso principal de este reporte, que es
  // auditar el mes actual o reciente antes de cerrar el período).
  const candidatos = useMemo(() => {
    if (!periodo) return []
    const finMes = finDeMes(periodo.mes, periodo.anio)
    return empleados.filter(e => {
      if (e.suspendido) return false // suspendido legítimamente no cobra (Arts. 51-53 CT)
      const ingreso = new Date(e.fechaIngreso)
      if (ingreso > finMes) return false // aún no había ingresado ese mes
      if (e.activo) return true
      const liq = liquidaciones.find(l => l.empleadoId === e.id)
      if (!liq) return false
      return new Date(liq.fechaTerminacion) > finMes
    })
  }, [periodo, empleados, liquidaciones])

  // ─── "Sin ingresos registrados" ─────────────────────────────────────────
  // Señal principal: el período trackea qué empleados fueron realmente
  // procesados (`empleadosProcesados`) — si esa lista existe y el empleado
  // no aparece en ella, su nómina nunca se calculó/confirmó ese mes (por
  // ejemplo, un ingreso a mitad de mes posterior a la generación del
  // período, que nunca entra al conteo de "todos procesados" que auto-avanza
  // el período a `procesada`). Mismo criterio defensivo que ya usa
  // `calcularSalarioPromedioUltimos12Meses()` en dominican-labor.ts: si el
  // período no trackea `empleadosProcesados` (períodos anteriores a esa
  // función), se asume que incluyó a todos, para no generar falsos positivos
  // masivos sobre datos históricos.
  // Señal secundaria (usa resultadoHistorico, con el snapshot o los ajustes
  // reales del período): aunque conste como procesado, si el bruto terminó en
  // cero o negativo (ej. salario base mal configurado en 0) también se marca
  // — cobertura de borde adicional, poco común en la práctica.
  const filas = useMemo(() => {
    if (!generado || !periodo) return []
    const procesados = periodo.empleadosProcesados
    const rows: { emp: typeof candidatos[number]; motivo: MotivoSinIngreso }[] = []
    for (const emp of candidatos) {
      const noProcesado = procesados !== undefined && !procesados.includes(emp.id)
      const res = resultadoHistorico(emp, periodo)
      const brutoCero = res.totalBruto <= 0
      if (noProcesado || brutoCero) {
        rows.push({ emp, motivo: noProcesado ? 'no_procesado' : 'bruto_cero' })
      }
    }
    return rows.sort((a, b) => fullName(a.emp).localeCompare(fullName(b.emp)))
  }, [generado, periodo, candidatos])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) =>
      fullName(emp).toLowerCase().includes(q) ||
      emp.cargo.toLowerCase().includes(q) ||
      emp.departamento.toLowerCase().includes(q)
    )
  }, [filas, searchQ])

  const summary = useMemo(() => ({
    evaluados: candidatos.length,
    sinIngresos: filas.length,
    conIngresos: candidatos.length - filas.length,
  }), [candidatos, filas])

  function motivoLabel(m: MotivoSinIngreso): string {
    return m === 'no_procesado' ? 'No procesado en el período' : 'Bruto calculado en RD$0'
  }

  function exportarPDF() {
    if (!periodo || filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Empleados Activos Sin Ingresos', periodoLabel(periodo))

    autoTable(doc, {
      startY: 44,
      head: [['Empleado', 'Cédula', 'Departamento', 'Cargo', 'Fecha Ingreso', 'Alerta']],
      body: filas.map(({ emp, motivo }) => [
        fullName(emp), formatCedula(emp.cedula), emp.departamento, emp.cargo,
        formatDate(emp.fechaIngreso), motivoLabel(motivo),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' })
      },
    })
    doc.save(`empleados-sin-ingresos-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportarXlsx() {
    if (!periodo || filas.length === 0) return
    exportarExcel({
      nombreArchivo: `empleados-sin-ingresos-${periodoLabel(periodo).replace(/\s+/g, '-').toLowerCase()}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Sin Ingresos',
        titulo: 'Empleados Activos Sin Ingresos',
        subtitulo: periodoLabel(periodo),
        encabezados: ['Empleado', 'Cédula', 'Departamento', 'Cargo', 'Fecha Ingreso', 'Alerta'],
        filas: filas.map(({ emp, motivo }) => [
          fullName(emp), formatCedula(emp.cedula), emp.departamento, emp.cargo,
          formatDate(emp.fechaIngreso), motivoLabel(motivo),
        ]),
        anchos: [30, 18, 22, 24, 16, 28],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Empleados Sin Ingresos"
        desc="Empleados activos ese mes que no tienen ningún ingreso registrado en la nómina del período — validación de integridad antes de cerrar."
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
        <button onClick={() => { setGenerado(true); setSearchQ('') }} disabled={!periodoId} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/10 px-5 py-3 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
          &quot;Activo durante el mes&quot; considera <strong>fecha de ingreso ≤ fin de mes</strong>, e incluye
          empleados ya desvinculados hoy cuya fecha de terminación (Liquidación) cae <strong>después</strong> del fin
          de este mes (el mes completo debía pagarse por nómina normal). Se excluyen empleados con una liquidación
          efectiva dentro o antes de este mes (su pago de ese mes salió del módulo de Liquidación, no de Nómina) y los
          empleados con <strong>suspensión de contrato vigente hoy</strong> (no cobran mientras dure).
        </p>
      </div>

      {!generado ? (
        <EmptyState message="Selecciona un período y haz clic en Generar para ver el reporte." />
      ) : candidatos.length === 0 ? (
        <EmptyState message="No hay empleados activos para evaluar en este período." />
      ) : filas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 gap-3 shadow-sm dark:shadow-none">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
            Todos los empleados activos tienen ingresos registrados este mes.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Empleados Evaluados</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{summary.evaluados}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Con Ingresos</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{summary.conIngresos}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Sin Ingresos</p>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">{summary.sinIngresos}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre, cargo o departamento…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Departamento</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cargo</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Fecha Ingreso</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ emp, motivo }) => (
                    <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#1B2980] dark:text-indigo-400 whitespace-nowrap">{fullName(emp)}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatCedula(emp.cedula)}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{emp.departamento}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{emp.cargo}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDate(emp.fechaIngreso)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={motivo === 'no_procesado' ? 'danger' : 'warning'}>{motivoLabel(motivo)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reporte Salario vs. Licencias ────────────────────────────────────────────
// ALCANCE REAL (documentado a propósito, ver nota visible en la propia UI):
// el motor de nómina (`calcularNomina`) acepta un parámetro opcional
// `diasTrabajados`, pero ninguna pantalla de captura de nómina (`nomina/page.tsx`)
// lo alimenta con un valor distinto al default (23.83 = mes completo) — hoy el
// sistema NO captura explícitamente "días trabajados" ni "ausencias/permisos
// informales" por período. Por lo tanto este reporte NO puede mostrar
// "días descontados por ausencia" (ese dato no existe en el modelo), y en su
// lugar cruza el único dato real y verificable que sí existe: el módulo de
// **Licencias** (`licencias-context.tsx` / tipo `Licencia`), que sí registra
// días, tipo y el monto que la empresa efectivamente pagó vía nómina
// (`montoPagado`, ya calculado sobre el salario diario del empleado) más el
// subsidio estimado de TSS/ARL cuando aplica (`montoSubsidioEstimado`).
// Cada licencia se atribuye al mes calendario de su `fechaInicio` — si una
// licencia cruza de un mes a otro (ej. maternidad, 84 días) no se prorratea
// entre los dos meses, se cuenta completa en el mes en que inició, misma
// simplificación que ya usa `licencias/page.tsx` para su propio filtro "del mes".
function ReporteLicencias({
  empresa, empleados, licencias,
}: {
  empresa: Empresa
  empleados: ReturnType<typeof useEmpleados>['empleados']
  licencias: Licencia[]
}) {
  const currentYear = new Date().getFullYear()
  const ORDEN_TIPOS: TipoLicencia[] = [
    'matrimonial', 'fallecimiento', 'alumbramiento',
    'enfermedad_comun', 'accidente_laboral', 'maternidad',
  ]

  const anios = useMemo(() => {
    const years = new Set(licencias.map(l => new Date(l.fechaInicio).getFullYear()))
    years.add(currentYear)
    return [...years].sort((a, b) => b - a)
  }, [licencias, currentYear])
  const empMap = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  const [anioFiltro, setAnioFiltro] = useState<number>(currentYear)
  const [generado, setGenerado] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const filas = useMemo(() => {
    if (!generado) return []
    return licencias
      .filter(l => new Date(l.fechaInicio).getFullYear() === anioFiltro)
      .map(l => ({ l, emp: empMap[l.empleadoId], mes: MESES[new Date(l.fechaInicio).getMonth()] }))
      .sort((a, b) => a.l.fechaInicio.localeCompare(b.l.fechaInicio))
  }, [generado, licencias, anioFiltro, empMap])

  const filasVisible = useMemo(() => {
    if (!searchQ.trim()) return filas
    const q = searchQ.toLowerCase()
    return filas.filter(({ emp }) => emp && fullName(emp).toLowerCase().includes(q))
  }, [filas, searchQ])

  const resumen = useMemo(() => filas.reduce((acc, { l }) => ({
    count:       acc.count + 1,
    dias:        acc.dias + l.dias,
    montoPagado: acc.montoPagado + l.montoPagado,
    subsidio:    acc.subsidio + (l.montoSubsidioEstimado ?? 0),
  }), { count: 0, dias: 0, montoPagado: 0, subsidio: 0 }), [filas])

  // Desglose agregado por tipo de licencia (motivo) — complementa la vista
  // por licencia individual con la dimensión "por tipo" pedida para este reporte.
  const porTipo = useMemo(() => {
    const map = new Map<TipoLicencia, { tipo: TipoLicencia; count: number; dias: number; montoPagado: number; subsidio: number }>()
    for (const { l } of filas) {
      const cur = map.get(l.tipo) ?? { tipo: l.tipo, count: 0, dias: 0, montoPagado: 0, subsidio: 0 }
      cur.count++
      cur.dias += l.dias
      cur.montoPagado += l.montoPagado
      cur.subsidio += l.montoSubsidioEstimado ?? 0
      map.set(l.tipo, cur)
    }
    return ORDEN_TIPOS.map(t => map.get(t)).filter((x): x is NonNullable<typeof x> => !!x)
  }, [filas]) // eslint-disable-line react-hooks/exhaustive-deps

  function exportarPDF() {
    if (filas.length === 0) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdfHeader(doc, empresa, 'Salario vs. Licencias', `Año ${anioFiltro}`)
    autoTable(doc, {
      startY: 44,
      head: [['Empleado', 'Mes', 'Tipo de Licencia', 'Fecha Inicio', 'Días', 'Monto Pagado', 'Subsidio Estimado TSS/ARL']],
      body: filas.map(({ l, emp, mes }) => [
        emp ? fullName(emp) : 'Empleado eliminado',
        `${mes} ${anioFiltro}`,
        labelLicencia(l.tipo),
        formatDate(l.fechaInicio),
        `${l.dias}`,
        l.montoPagado.toFixed(2),
        (l.montoSubsidioEstimado ?? 0).toFixed(2),
      ]),
      foot: [['TOTALES', '', '', '', `${resumen.dias}`, resumen.montoPagado.toFixed(2), resumen.subsidio.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didDrawPage: (data) => { doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${data.pageNumber}`, 283, 205, { align: 'right' }) },
    })
    doc.save(`salario-vs-licencias-${anioFiltro}.pdf`)
  }

  function exportarXlsx() {
    if (filas.length === 0) return
    exportarExcel({
      nombreArchivo: `salario-vs-licencias-${anioFiltro}`,
      empresa: empresa.nombre, rnc: empresa.rnc,
      hojas: [{
        nombre: 'Licencias', titulo: 'Salario vs. Licencias', subtitulo: `Año ${anioFiltro}`,
        encabezados: ['Empleado', 'Mes', 'Tipo de Licencia', 'Fecha Inicio', 'Días', 'Monto Pagado', 'Subsidio Estimado TSS/ARL'],
        filas: filas.map(({ l, emp, mes }) => [
          emp ? fullName(emp) : 'Empleado eliminado',
          `${mes} ${anioFiltro}`,
          labelLicencia(l.tipo),
          formatDate(l.fechaInicio),
          l.dias,
          l.montoPagado,
          l.montoSubsidioEstimado ?? 0,
        ]),
        totales: ['TOTALES', '', '', '', resumen.dias, resumen.montoPagado, resumen.subsidio],
        anchos: [32, 16, 24, 16, 10, 16, 20],
      }],
    })
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Salario vs. Licencias"
        desc="Días de licencia remunerada por tipo y mes, y su impacto en RD$ pagado por la empresa vs. subsidio TSS/ARL."
        onPDF={filas.length > 0 ? exportarPDF : undefined}
        onExcel={filas.length > 0 ? exportarXlsx : undefined}
      />

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Año:
          <select value={anioFiltro} onChange={e => { setAnioFiltro(+e.target.value); setGenerado(false) }} className={selectCls}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button onClick={() => { setGenerado(true); setSearchQ('') }} className={primaryBtn}>
          <ChevronRight className="h-4 w-4" /> Generar
        </button>
      </FilterBar>

      <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
          <div className="text-xs text-[#151f66] dark:text-indigo-200 space-y-1.5">
            <p className="font-semibold">Alcance real de este reporte</p>
            <p>
              Cielo Cloud todavía no captura formalmente &ldquo;días trabajados&rdquo; ni ausencias/permisos informales
              por período de nómina — el motor de cálculo acepta un parámetro <code>diasTrabajados</code>, pero ninguna
              pantalla de procesamiento de nómina lo alimenta con un valor distinto al de un mes completo, así que hoy
              una ausencia sin licencia formal no reduce el salario calculado. Este reporte se basa exclusivamente en
              las <strong>Licencias</strong> registradas en ese módulo (matrimonial, fallecimiento, alumbramiento,
              enfermedad común, accidente laboral, maternidad) — no en ausencias/permisos sin licencia. El
              &ldquo;Monto Pagado&rdquo; es lo que la empresa efectivamente desembolsó vía nómina por cada licencia
              (ya calculado sobre el salario diario del empleado); el &ldquo;Subsidio Estimado&rdquo; es solo
              informativo — lo paga o reembolsa SISALRIL/el Seguro de Riesgos Laborales, no Cielo Cloud.
            </p>
          </div>
        </div>
      </div>

      {!generado ? (
        <EmptyState message="Selecciona un año y haz clic en Generar." />
      ) : filas.length === 0 ? (
        <EmptyState message={`No hay licencias registradas en ${anioFiltro}. Regístralas desde el módulo de Licencias.`} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Licencias Registradas</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{resumen.count}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Días Totales</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{resumen.dias}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Pagado por Cielo Cloud</p>
              <p className="mt-1 text-xl font-bold text-[#1B2980] dark:text-indigo-400 tabular-nums">{formatRD(resumen.montoPagado, 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Subsidio Estimado TSS/ARL</p>
              <p className="mt-1 text-xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">{formatRD(resumen.subsidio, 0)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] px-5 py-2.5 flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre…" className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none" />
              <span className="text-xs text-zinc-400 shrink-0">{filasVisible.length}/{filas.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                    {['Empleado', 'Mes', 'Tipo de Licencia', 'Fecha Inicio', 'Días', 'Monto Pagado', 'Subsidio Estimado'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {filasVisible.map(({ l, emp, mes }) => (
                    <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{emp ? fullName(emp) : 'Empleado eliminado'}</p>
                        {emp && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{emp.cargo}</p>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{mes} {anioFiltro}</td>
                      <td className="px-5 py-3">
                        <Badge variant={esLicenciaConSubsidio(l.tipo) ? 'info' : 'neutral'}>{labelLicencia(l.tipo)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{formatDate(l.fechaInicio)}</td>
                      <td className="px-5 py-3 tabular-nums text-center text-zinc-700 dark:text-zinc-300">{l.dias}</td>
                      <td className="px-5 py-3 tabular-nums text-right font-medium text-[#1B2980] dark:text-indigo-300 whitespace-nowrap">{formatRD(l.montoPagado, 2)}</td>
                      <td className="px-5 py-3 tabular-nums text-right text-sky-600 dark:text-sky-400 whitespace-nowrap">{l.montoSubsidioEstimado != null ? formatRD(l.montoSubsidioEstimado, 2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e] text-[#1B2980] dark:text-indigo-300 font-bold">
                    <td colSpan={4} className="px-5 py-3 text-left text-xs uppercase tracking-wide">TOTALES ({filasVisible.length} licencias)</td>
                    <td className="px-5 py-3 tabular-nums text-center">{resumen.dias}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{formatRD(resumen.montoPagado, 0)}</td>
                    <td className="px-5 py-3 tabular-nums text-right text-sky-700 dark:text-sky-300 whitespace-nowrap">{formatRD(resumen.subsidio, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] overflow-hidden shadow-sm dark:shadow-none">
            <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-3.5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Desglose por Tipo de Licencia</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Totales de {anioFiltro} agrupados por motivo.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo de Licencia</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Licencias</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monto Pagado</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Subsidio Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                  {porTipo.map(t => (
                    <tr key={t.tipo}>
                      <td className="px-5 py-2.5">
                        <Badge variant={esLicenciaConSubsidio(t.tipo) ? 'info' : 'neutral'}>{labelLicencia(t.tipo)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-zinc-700 dark:text-zinc-300">{t.count}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-zinc-700 dark:text-zinc-300">{t.dias}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#1B2980] dark:text-indigo-300 whitespace-nowrap">{formatRD(t.montoPagado, 2)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sky-600 dark:text-sky-400 whitespace-nowrap">{formatRD(t.subsidio, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Shared UI components ─────────────────────────────────────────────────────
const selectCls = 'rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none'
const primaryBtn = 'flex items-center gap-1.5 rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors'

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-5 py-3 shadow-sm dark:shadow-none">
      {children}
    </div>
  )
}

function ReportHeader({
  title, desc, onPDF, onExcel, disabled, disabledReason,
}: {
  title: string
  desc: string
  onPDF?: () => void
  onExcel?: () => void
  /** Cuando es true, deshabilita visualmente los botones de exportación (p. ej. hay errores de validación bloqueantes) sin ocultarlos — el usuario ve que existe la acción pero no puede usarla hasta corregir los datos. */
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      {(onPDF || onExcel) && (
        <div className="flex items-center gap-2 shrink-0">
          {onExcel && (
            <button
              onClick={onExcel}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                disabled
                  ? 'border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                  : 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          )}
          {onPDF && (
            <button
              onClick={onPDF}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                disabled
                  ? 'border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                  : 'border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50'
              }`}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('gerencial')
  const [toast, setToast] = useState<string | null>(null)

  const { empleados } = useEmpleados()
  const { periodos }  = usePeriodos()
  const { prestamos } = usePrestamos()
  const { empresa }   = useEmpresa()
  const { liquidaciones } = useLiquidaciones()
  const { licencias } = useLicencias()

  const renderReport = useCallback(() => {
    const props = { empresa, empleados, periodos, prestamos, liquidaciones, licencias }
    switch (activeReport) {
      case 'gerencial':    return <ReporteGerencial      {...props} />
      case 'nomina':       return <ReporteNomina          {...props} />
      case 'empleados':    return <ReporteEmpleados       {...props} />
      case 'prestamos':    return <ReportePrestamos       {...props} />
      case 'tss':          return <ReporteTSS             {...props} />
      case 'departamento': return <ReporteCostoPorDepto   {...props} />
      case 'bancaria':     return <ReportePlanillaACH     {...props} />
      case 'horas_extras': return <ReporteHorasExtras     {...props} />
      case 'proyeccion':   return <ReporteProyeccionAnual {...props} />
      case 'preaviso':     return <ReportePreaviso        {...props} />
      case 'antiguedad':   return <ReporteAntiguedad      {...props} />
      case 'sin_ingresos': return <ReporteSinIngresos     {...props} />
      case 'licencias':    return <ReporteLicencias       {...props} />
    }
  }, [activeReport, empresa, empleados, periodos, prestamos, liquidaciones, licencias])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Reportería"
        subtitle="Análisis, exportación y cumplimiento regulatorio"
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
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Tipos de Reporte</p>
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
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-indigo-200' : 'text-zinc-400 dark:text-zinc-500'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm leading-tight tracking-tight ${active ? 'font-semibold text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>{item.label}</p>
                      <p className={`text-[10px] leading-tight mt-0.5 tracking-wide ${active ? 'text-indigo-200' : 'text-zinc-400 dark:text-zinc-500'}`}>{item.desc}</p>
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
