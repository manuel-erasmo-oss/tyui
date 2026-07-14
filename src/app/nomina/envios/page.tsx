'use client'

import { useState } from 'react'
import { Search, Wallet, Mail, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { usePeriodos } from '@/lib/periodos-context'
import { EnvioComprobantesModal } from '@/components/nomina/EnvioComprobantesModal'
import { labelPeriodo } from '@/lib/nomina-shared'
import { formatRD, formatDate, cn, BTN_PRIMARY } from '@/lib/utils'
import type { PeriodoNomina } from '@/types'

// Gestión de Envíos — separado de Cálculo de Nómina: aquí se marca como
// pagado un período ya CERRADO (transferencia ACH confirmada) y se envían
// los comprobantes de pago por correo a cada empleado. Un período que
// todavía está en_proceso/procesada no tiene nada que hacer en esta
// pantalla — primero hay que cerrarlo desde Cálculo de Nómina.
export default function GestionEnviosPage() {
  const { periodos, marcarPagada } = usePeriodos()
  const [busqueda, setBusqueda] = useState('')
  const [filtroAnio, setFiltroAnio] = useState<'todos' | number>('todos')
  const [envioPeriodoId, setEnvioPeriodoId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const cerrados = periodos.filter(p => p.estado === 'cerrada')
  const anios = Array.from(new Set(cerrados.map(p => p.anio))).sort((a, b) => b - a)

  const filas = cerrados
    .filter(p => filtroAnio === 'todos' || p.anio === filtroAnio)
    .filter(p => !busqueda.trim() || labelPeriodo(p).toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime())

  const pendientesPago = cerrados.filter(p => !p.pagada).length
  const hayFiltros = busqueda.trim() !== '' || filtroAnio !== 'todos'

  function handleMarcarPagada(p: PeriodoNomina) {
    const hoy = new Date().toISOString().slice(0, 10)
    if (!confirm(`¿Confirmar que "${labelPeriodo(p)}" ya fue pagado (transferencia ACH enviada) el ${formatDate(hoy)}?`)) return
    marcarPagada(p.id, hoy)
    setEnvioPeriodoId(p.id)
  }

  const periodoEnvio = envioPeriodoId ? periodos.find(p => p.id === envioPeriodoId) ?? null : null

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Gestión de Envíos"
        subtitle="Marca el pago y envía los comprobantes de nómina a cada empleado"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {pendientesPago > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-5 py-3.5 text-sm text-amber-800 dark:text-amber-300">
            <Wallet className="h-4 w-4 shrink-0" />
            {pendientesPago} período{pendientesPago !== 1 ? 's' : ''} cerrado{pendientesPago !== 1 ? 's' : ''} pendiente{pendientesPago !== 1 ? 's' : ''} de confirmar pago.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] px-5 py-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar período…"
                className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
              />
            </div>
            <select
              value={filtroAnio}
              onChange={e => setFiltroAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] dark:text-zinc-200 px-2.5 py-1.5 text-xs focus:border-[#1B2980] focus:outline-none"
            >
              <option value="todos">Todos los años</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {hayFiltros && (
              <button
                onClick={() => { setBusqueda(''); setFiltroAnio('todos') }}
                className="text-xs font-medium text-[#1B2980] dark:text-indigo-400 hover:underline"
              >
                Ver todos
              </button>
            )}
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
              {filas.length} de {cerrados.length} período(s)
            </span>
          </div>

          {cerrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                <Wallet className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" />
              </div>
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin períodos cerrados todavía</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                Cierra un período en Cálculo de Nómina para poder marcarlo como pagado y enviar los comprobantes.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleados</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Neto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado de Pago</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        Ningún período coincide con el filtro.
                      </td>
                    </tr>
                  )}
                  {filas.map(p => (
                    <tr key={p.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{labelPeriodo(p)}</td>
                      <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-400">{p.totalEmpleados}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#151f66] dark:text-indigo-300">{formatRD(p.totales.neto)}</td>
                      <td className="px-4 py-3.5">
                        {p.pagada ? (
                          <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Pagada el {formatDate(p.fechaPago!)}</Badge>
                        ) : (
                          <Badge variant="warning">Pendiente de pago</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {p.pagada ? (
                          <button
                            onClick={() => setEnvioPeriodoId(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#252840] px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" /> Comprobantes
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarcarPagada(p)}
                            className={cn(BTN_PRIMARY, 'px-2.5 py-1.5 text-xs')}
                          >
                            <Wallet className="h-3.5 w-3.5" /> Marcar como Pagada
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {periodoEnvio && (
        <EnvioComprobantesModal
          periodo={periodoEnvio}
          onClose={() => setEnvioPeriodoId(null)}
          onToast={setToast}
        />
      )}
    </div>
  )
}
