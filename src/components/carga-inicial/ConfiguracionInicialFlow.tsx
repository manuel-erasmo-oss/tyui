'use client'

import { useState } from 'react'
import { ListChecks, FileSpreadsheet, ArrowLeft, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { AsistenteGuiado } from './AsistenteGuiado'
import { ImportadorExcel } from './ImportadorExcel'

type Modo = 'menu' | 'guiado' | 'excel'

function OpcionCarga({
  icon: Icon, title, desc, onClick,
}: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-7 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1B2980]/30 dark:hover:border-indigo-500/40 hover:shadow-[0_20px_40px_-16px_rgba(27,41,128,0.25)] dark:hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-[#1B2980]/10 to-transparent blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-indigo-500/10" />
      <div className="relative">
        <div className="relative mb-5 inline-flex">
          <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-lg dark:bg-indigo-500/25" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
        <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#1B2980] dark:text-indigo-400">
          Comenzar
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  )
}

export function ConfiguracionInicialFlow() {
  const { empleadosActivos } = useEmpleados()
  const [modo, setModo] = useState<Modo>('menu')

  const revisados  = empleadosActivos.filter(e => e.saldosInicialesRevisado).length
  const pendientes = empleadosActivos.length - revisados

  return (
    <div className="space-y-5">
      {modo !== 'menu' && (
        <button
          onClick={() => setModo('menu')}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a opciones
        </button>
      )}

      {modo === 'menu' && (
        <>
          <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-[#1d2035] rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-zinc-50/60 dark:bg-[#1a1d2e]/40 overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Empleados Activos</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{empleadosActivos.length}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Saldos Revisados</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{revisados}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pendientes</p>
              <p className={`mt-1.5 text-2xl font-bold tabular-nums ${pendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {pendientes}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Si tu empresa ya operaba antes de usar Cielo Cloud, tus empleados probablemente tienen
            vacaciones acumuladas, regalía parcial pagada, o un salario histórico relevante para
            cesantía/preaviso. Usa cualquiera de las dos opciones para capturarlo — no afecta a
            empleados de contratación reciente.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpcionCarga
              icon={ListChecks}
              title="Cargar uno por uno"
              desc="Un asistente guiado recorre tus empleados activos y te pregunta sus saldos — ideal si tienes pocos empleados o prefieres ir con calma."
              onClick={() => setModo('guiado')}
            />
            <OpcionCarga
              icon={FileSpreadsheet}
              title="Subir archivo Excel"
              desc="Descarga nuestra plantilla, llénala con los datos de tu sistema anterior, y súbela de vuelta — ideal para migrar decenas de empleados de una vez."
              onClick={() => setModo('excel')}
            />
          </div>
        </>
      )}

      {modo === 'guiado' && <AsistenteGuiado onFinish={() => setModo('menu')} />}
      {modo === 'excel'  && <ImportadorExcel onFinish={() => setModo('menu')} />}
    </div>
  )
}
