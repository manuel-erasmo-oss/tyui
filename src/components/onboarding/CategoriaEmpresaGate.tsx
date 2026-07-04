'use client'

import { useState } from 'react'
import { Building2, Check } from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { SALARIO_MINIMO } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import type { CategoriaEmpresa } from '@/types'

const OPCIONES: { value: CategoriaEmpresa; label: string; descripcion: string; salario: number }[] = [
  { value: 'micro',   label: 'Microempresa',   descripcion: 'Menos de 10 trabajadores',        salario: SALARIO_MINIMO.microempresas },
  { value: 'pequeña', label: 'Pequeña Empresa', descripcion: '10 a 19 trabajadores',            salario: SALARIO_MINIMO.pequeñasEmpresas },
  { value: 'mediana', label: 'Mediana Empresa', descripcion: '20 a 49 trabajadores',            salario: SALARIO_MINIMO.medianaEmpresa },
  { value: 'grande',  label: 'Gran Empresa',    descripcion: 'Más de 50 trabajadores o capital > RD$2M', salario: SALARIO_MINIMO.grandesEmpresas },
]

interface Props {
  children: React.ReactNode
}

export function CategoriaEmpresaGate({ children }: Props) {
  const { empresa, cargado, guardar } = useEmpresa()
  const [seleccion, setSeleccion] = useState<CategoriaEmpresa | null>(null)

  // Wait until localStorage read resolves to avoid flashing the gate for returning users
  if (!cargado) return null

  if (empresa.categoriaEmpresa) return <>{children}</>

  function confirmar() {
    if (!seleccion) return
    guardar({ ...empresa, categoriaEmpresa: seleccion })
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a] p-6">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/40">
            <Building2 className="h-7 w-7 text-[#1B2980] dark:text-indigo-400" />
          </div>
        </div>
        <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">
          ¿De qué tamaño es tu empresa?
        </h1>
        <p className="mt-1.5 text-center text-sm text-zinc-500 dark:text-zinc-400">
          El salario mínimo legal en República Dominicana varía según la categoría de la empresa
          (Resolución 079-2025). Esto nos permite alertarte si algún empleado gana menos de lo establecido.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OPCIONES.map(op => {
            const active = seleccion === op.value
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => setSeleccion(op.value)}
                className={`relative rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
                    : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] hover:border-zinc-300 dark:hover:border-[#33395a]'
                }`}
              >
                {active && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#1B2980] dark:bg-indigo-500">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{op.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{op.descripcion}</p>
                <p className="mt-2 text-sm font-bold tabular-nums text-[#1B2980] dark:text-indigo-400">
                  {formatRD(op.salario, 0)}
                  <span className="ml-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">salario mín. mensual</span>
                </p>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={confirmar}
          disabled={!seleccion}
          className="mt-6 w-full rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
        >
          Continuar
        </button>

        <p className="mt-4 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
          Podrás cambiar esta categoría más adelante desde Configuración si tu empresa crece.
        </p>
      </div>
    </div>
  )
}
