'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Toast } from '@/components/ui/Toast'
import { useChecklistAnual } from '@/lib/inicio-de-ano-context'
import { useEmpresa } from '@/lib/empresa-context'
import { cn, formatRD, formatDate } from '@/lib/utils'
import {
  TRAMOS_ISR,
  SALARIO_MINIMO,
  SALARIO_MINIMO_COTIZABLE_TSS,
  TOPE_COTIZABLE_AFP,
  TOPE_COTIZABLE_SFS,
  TOPE_COTIZABLE_SRL,
  getSalarioMinimoAplicable,
} from '@/lib/dominican-labor'
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Info,
  Percent,
  Banknote,
  PartyPopper,
  CalendarRange,
  Landmark,
} from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface FilaParam {
  label: string
  value: string
  sub?: string
}

function MiniTable({ rows }: { rows: FilaParam[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-zinc-100 dark:divide-[#1d2035] bg-white dark:bg-[#141722]">
          {rows.map(row => (
            <tr key={row.label}>
              <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                {row.label}
                {row.sub && <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">{row.sub}</span>}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-[#151f66] dark:text-indigo-300">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ChecklistCardProps {
  icon: React.ElementType
  titulo: string
  descripcion: string
  completado: boolean
  onToggle: () => void
  children?: React.ReactNode
}

function ChecklistCard({ icon: Icon, titulo, descripcion, completado, onToggle, children }: ChecklistCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
      <div className="flex items-start gap-3.5">
        <button
          onClick={onToggle}
          title={completado ? 'Marcar como pendiente' : 'Marcar como completado'}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110"
        >
          {completado
            ? <CheckCircle2 className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
            : <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#eef0fb] dark:bg-indigo-950/40">
              <Icon className="h-3.5 w-3.5 text-[#1B2980] dark:text-indigo-400" />
            </div>
            <p className={cn(
              'text-sm font-semibold',
              completado ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-900 dark:text-zinc-100',
            )}>
              {titulo}
            </p>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{descripcion}</p>
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  )
}

export default function InicioDeAnoPage() {
  const anioActual = useMemo(() => new Date().getFullYear(), [])
  const { getEstado, toggleItem, agregarFeriado, eliminarFeriado, actualizarPago } = useChecklistAnual()
  const { empresa } = useEmpresa()
  const estado = getEstado(anioActual)

  const [showToast, setShowToast] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')

  const ITEMS_IDS = ['tramos-isr', 'salario-minimo', 'feriados', 'calendario-pago', 'ir13'] as const
  const total = ITEMS_IDS.length
  const completados = ITEMS_IDS.filter(id => estado.itemsCompletados.includes(id)).length
  const pct = Math.round((completados / total) * 100)

  function handleToggle(itemId: string) {
    toggleItem(anioActual, itemId)
  }

  function handleAgregarFeriado(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaFecha || !nuevoNombre.trim()) return
    agregarFeriado(anioActual, nuevaFecha, nuevoNombre.trim())
    setNuevaFecha('')
    setNuevoNombre('')
    setShowToast(true)
  }

  const modalidad = empresa.modalidadNomina ?? 'mensual'
  const filasPago = useMemo(() => {
    const rows: { mes: number; quincena?: 1 | 2 }[] = []
    for (let m = 1; m <= 12; m++) {
      if (modalidad === 'quincenal') {
        rows.push({ mes: m, quincena: 1 })
        rows.push({ mes: m, quincena: 2 })
      } else {
        rows.push({ mes: m })
      }
    }
    return rows
  }, [modalidad])

  function fechaPagoDe(mes: number, quincena?: 1 | 2): string {
    return estado.calendarioPago.find(p => p.mes === mes && p.quincena === quincena)?.fechaPago ?? ''
  }

  const salarioMinimoAplicable = getSalarioMinimoAplicable(empresa)

  const filasISR: FilaParam[] = [
    { label: 'Tramo I', value: 'Exento', sub: `hasta ${formatRD(TRAMOS_ISR[0].hasta, 0)}` },
    { label: 'Tramo II', value: `${(TRAMOS_ISR[1].tasa * 100).toFixed(0)}%`, sub: `hasta ${formatRD(TRAMOS_ISR[1].hasta, 0)}` },
    { label: 'Tramo III', value: `${(TRAMOS_ISR[2].tasa * 100).toFixed(0)}%`, sub: `hasta ${formatRD(TRAMOS_ISR[2].hasta, 0)} (fijo ${formatRD(TRAMOS_ISR[2].fijo, 0)})` },
    { label: 'Tramo IV', value: `${(TRAMOS_ISR[3].tasa * 100).toFixed(0)}%`, sub: `sobre exceso (fijo ${formatRD(TRAMOS_ISR[3].fijo, 0)})` },
  ]

  const filasSalario: FilaParam[] = [
    { label: 'Grandes Empresas', value: formatRD(SALARIO_MINIMO.grandesEmpresas, 0) },
    { label: 'Mediana Empresa', value: formatRD(SALARIO_MINIMO.medianaEmpresa, 0) },
    { label: 'Pequeñas Empresas', value: formatRD(SALARIO_MINIMO.pequeñasEmpresas, 0) },
    { label: 'Microempresas', value: formatRD(SALARIO_MINIMO.microempresas, 0) },
    { label: 'Zona Franca', value: formatRD(SALARIO_MINIMO.zonaFranca, 0) },
    { label: 'Salario Mínimo Cotizable TSS', value: formatRD(SALARIO_MINIMO_COTIZABLE_TSS, 0) },
    { label: 'Tope Cotizable AFP', value: formatRD(TOPE_COTIZABLE_AFP, 0) },
    { label: 'Tope Cotizable SFS', value: formatRD(TOPE_COTIZABLE_SFS, 0) },
    { label: 'Tope Cotizable SRL', value: formatRD(TOPE_COTIZABLE_SRL, 0) },
  ]

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Inicio de Año" subtitle={`Checklist de preparación para el año fiscal ${anioActual}`} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Resumen */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Progreso del checklist"
            value={`${pct}%`}
            sub={`${completados} de ${total} tareas completadas`}
            icon={CalendarCheck}
          />
          <StatCard
            label="Feriados registrados"
            value={String(estado.feriados.length)}
            sub={`Calendario ${anioActual}`}
            icon={PartyPopper}
          />
          <StatCard
            label="Fechas de pago planificadas"
            value={String(estado.calendarioPago.filter(p => p.fechaPago).length)}
            sub={`de ${filasPago.length} períodos (${modalidad})`}
            icon={CalendarRange}
          />
        </div>

        {/* Progress bar */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-[#1a1d2e]">
            <div
              className="h-full rounded-full bg-[#1B2980] dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            El checklist se reinicia automáticamente cada año — este progreso corresponde solo a {anioActual}.
          </p>
        </div>

        {/* 1. Tramos ISR */}
        <ChecklistCard
          icon={Percent}
          titulo="Verificar tabla de tramos ISR vigente"
          descripcion="Confirma que los tramos de retención ISR de la DGII no hayan cambiado. Estos valores están fijos en el motor de cálculo (src/lib/dominican-labor.ts) y solo se muestran aquí como referencia — el ISR se actualiza raramente y modificarlo requiere un cambio de código."
          completado={estado.itemsCompletados.includes('tramos-isr')}
          onToggle={() => handleToggle('tramos-isr')}
        >
          <MiniTable rows={filasISR} />
        </ChecklistCard>

        {/* 2. Salario mínimo / topes TSS */}
        <ChecklistCard
          icon={Banknote}
          titulo="Actualizar salario mínimo TSS / SRL / DGII si aplica"
          descripcion="Revisa si el Comité Nacional de Salarios o la CNSS emitieron una nueva resolución. Estos valores también viven en dominican-labor.ts (SALARIO_MINIMO, SALARIO_MINIMO_COTIZABLE_TSS y los topes cotizables derivados)."
          completado={estado.itemsCompletados.includes('salario-minimo')}
          onToggle={() => handleToggle('salario-minimo')}
        >
          <MiniTable rows={filasSalario} />
          {salarioMinimoAplicable != null && (
            <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              Según la categoría configurada de tu empresa, el salario mínimo legal aplicable es{' '}
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">{formatRD(salarioMinimoAplicable, 0)}</span>.
              Ajústalo en Configuración si tu empresa cambió de categoría.
            </p>
          )}
        </ChecklistCard>

        {/* 3. Calendario de feriados */}
        <ChecklistCard
          icon={PartyPopper}
          titulo="Confirmar calendario de feriados del año"
          descripcion="Registra las fechas de los feriados nacionales confirmados para este año. Se usan como referencia manual (ej. para calcular horas extra al 100% en días feriados); no se recalculan automáticamente en nómina todavía."
          completado={estado.itemsCompletados.includes('feriados')}
          onToggle={() => handleToggle('feriados')}
        >
          <form onSubmit={handleAgregarFeriado} className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Fecha</label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10"
              />
            </div>
            <div className="flex-[2]">
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Nombre del feriado</label>
              <input
                type="text"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Ej. Día de la Independencia"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10"
              />
            </div>
            <button
              type="submit"
              disabled={!nuevaFecha || !nuevoNombre.trim()}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1B2980] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </button>
          </form>

          {estado.feriados.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 dark:border-[#252840] px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Aún no has confirmado ningún feriado para {anioActual}.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-[#1d2035] overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
              {estado.feriados.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-3 bg-white dark:bg-[#141722] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{f.nombre}</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(f.fecha)}</p>
                  </div>
                  <button
                    onClick={() => eliminarFeriado(anioActual, f.id)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-300 dark:text-zinc-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChecklistCard>

        {/* 4. Calendario de pago anual */}
        <ChecklistCard
          icon={CalendarRange}
          titulo="Planificar calendario de pago anual"
          descripcion={`Define la fecha estimada de pago de cada ${modalidad === 'quincenal' ? 'quincena' : 'mes'} del año, según la modalidad de nómina configurada en Configuración (${modalidad}). Es solo un plan de referencia — no crea los períodos de nómina automáticamente.`}
          completado={estado.itemsCompletados.includes('calendario-pago')}
          onToggle={() => handleToggle('calendario-pago')}
        >
          <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-zinc-200 dark:border-[#252840]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-[#1a1d2e]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fecha de pago estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#1d2035] bg-white dark:bg-[#141722]">
                {filasPago.map(row => (
                  <tr key={`${row.mes}-${row.quincena ?? 'm'}`}>
                    <td className="px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {MESES[row.mes - 1]} {anioActual}
                      {row.quincena && (
                        <span className="ml-1.5 rounded-full bg-[#eef0fb] dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#1B2980] dark:text-indigo-300">
                          {row.quincena === 1 ? '1ª quincena' : '2ª quincena'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={fechaPagoDe(row.mes, row.quincena)}
                        onChange={e => actualizarPago(anioActual, row.mes, row.quincena, e.target.value)}
                        className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChecklistCard>

        {/* 5. IR-13 */}
        <ChecklistCard
          icon={Landmark}
          titulo="Recordatorio IR-13 — Declaración Jurada Anual de Retenciones"
          descripcion="El IR-13 es la declaración jurada anual de retenciones y retribuciones complementarias pagadas a trabajadores, que se presenta ante la DGII. Este checklist es solo un recordatorio informativo — Cielo Cloud no calcula ni genera el formulario IR-13."
          completado={estado.itemsCompletados.includes('ir13')}
          onToggle={() => handleToggle('ir13')}
        >
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              La DGII suele fijar el vencimiento del IR-13 en los primeros meses del año fiscal siguiente
              (generalmente dentro de los primeros 60 días). La fecha exacta puede variar de un año a otro —
              confirma el plazo vigente directamente en el calendario fiscal publicado por la DGII (dgii.gov.do)
              antes de darlo por presentado.
            </p>
          </div>
        </ChecklistCard>

      </div>

      {showToast && (
        <Toast message="Feriado agregado" type="success" onClose={() => setShowToast(false)} />
      )}
    </div>
  )
}
