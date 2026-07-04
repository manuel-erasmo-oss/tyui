'use client'

import { useState } from 'react'
import { History, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { ConfiguracionInicialFlow } from '@/components/carga-inicial/ConfiguracionInicialFlow'

type Vista = 'pregunta' | 'flujo'

function OpcionRespuesta({
  icon: Icon, title, desc, onClick,
}: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1B2980]/30 dark:hover:border-indigo-500/40 hover:shadow-[0_20px_40px_-16px_rgba(27,41,128,0.25)] dark:hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#1B2980]/10 to-transparent blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-indigo-500/10" />
      <div className="relative">
        <div className="relative mb-4 inline-flex">
          <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-lg dark:bg-indigo-500/25" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
    </button>
  )
}

export function PromptConfiguracionInicial() {
  const { empresa, guardar } = useEmpresa()
  const [vista, setVista] = useState<Vista>('pregunta')

  function resolver() {
    guardar({ ...empresa, configuracionInicialOfrecida: true })
  }

  if (vista === 'flujo') {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a]">
        <div className="mx-auto w-full max-w-4xl flex-1 p-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Configuración Inicial</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Captura los saldos de tus empleados con historial previo — puedes hacerlo ahora o más
              tarde desde Configuración.
            </p>
          </div>
          <ConfiguracionInicialFlow />
        </div>
        <div className="sticky bottom-0 border-t border-zinc-200 dark:border-[#252840] bg-white/90 dark:bg-[#141722]/90 backdrop-blur px-6 py-4">
          <div className="mx-auto flex max-w-4xl justify-end">
            <button
              onClick={resolver}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] hover:from-[#151f66] hover:to-[#1B2980] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1B2980]/25 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Continuar al Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a] p-6">
      <div className="w-full max-w-xl">
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/25 blur-xl dark:bg-indigo-500/25" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B2980] to-[#2f3fa8] text-white shadow-lg shadow-[#1B2980]/30">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </div>
        <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">Una cosa más</h1>
        <p className="mt-1.5 text-center text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Necesitamos un dato adicional para que Cielo Cloud calcule tus prestaciones con exactitud
          desde el primer día. ¿Tu empresa ya operaba antes de usar Cielo Cloud?
        </p>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OpcionRespuesta
            icon={History}
            title="Sí, tengo empleados con historial"
            desc="Vacaciones acumuladas, regalía parcial pagada o salario histórico que debemos capturar."
            onClick={() => setVista('flujo')}
          />
          <OpcionRespuesta
            icon={Sparkles}
            title="No, estamos empezando desde cero"
            desc="Todos mis empleados son de contratación reciente, sin historial previo que migrar."
            onClick={resolver}
          />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={resolver}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Decidir más tarde <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
