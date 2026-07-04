'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { useEmpleados } from '@/lib/empleados-context'
import { UploadCloud, ListChecks, FileSpreadsheet, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AsistenteGuiado } from '@/components/carga-inicial/AsistenteGuiado'
import { ImportadorExcel } from '@/components/carga-inicial/ImportadorExcel'

type Modo = 'menu' | 'guiado' | 'excel'

export default function CargaInicialPage() {
  const { empleadosActivos } = useEmpleados()
  const [modo, setModo] = useState<Modo>('menu')

  const revisados  = empleadosActivos.filter(e => e.saldosInicialesRevisado).length
  const pendientes = empleadosActivos.length - revisados

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Carga Inicial"
        subtitle="Saldos iniciales para empleados con historial previo a Cielo Cloud"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        {modo !== 'menu' && (
          <button
            onClick={() => setModo('menu')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a opciones
          </button>
        )}

        {modo === 'menu' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Empleados Activos"
                value={String(empleadosActivos.length)}
                sub="Total en el sistema"
                icon={ListChecks}
                iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
              />
              <StatCard
                label="Con Saldos Revisados"
                value={String(revisados)}
                sub="Ya confirmados o marcados 'no aplica'"
                icon={CheckCircle2}
                iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
              <StatCard
                label="Pendientes por Revisar"
                value={String(pendientes)}
                sub="Aún sin confirmar saldos iniciales"
                icon={UploadCloud}
                iconColor={pendientes > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}
              />
            </div>

            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 text-xs text-[#151f66] dark:text-indigo-200">
              Si tu empresa ya operaba antes de usar Cielo Cloud, tus empleados probablemente tienen
              vacaciones acumuladas, regalía parcial pagada, o un salario histórico relevante para
              cesantía/preaviso. Usa cualquiera de las dos opciones para capturarlo — no afecta a
              empleados de contratación reciente.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                onClick={() => setModo('guiado')}
                className="group flex flex-col items-start gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-left shadow-sm hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cargar uno por uno</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Un asistente guiado recorre tus empleados activos y te pregunta sus saldos —
                    ideal si tienes pocos empleados o prefieres ir con calma.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setModo('excel')}
                className="group flex flex-col items-start gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-left shadow-sm hover:border-[#1B2980] dark:hover:border-indigo-500 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Subir archivo Excel</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Descarga nuestra plantilla, llénala con los datos de tu sistema anterior, y súbela
                    de vuelta — ideal para migrar decenas de empleados de una vez.
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {modo === 'guiado' && <AsistenteGuiado onFinish={() => setModo('menu')} />}
        {modo === 'excel'  && <ImportadorExcel onFinish={() => setModo('menu')} />}

      </div>
    </div>
  )
}
