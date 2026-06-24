'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { PeriodoNomina } from '@/types'

const KEY = 'cielo-periodos'

interface PeriodosCtx {
  periodos: PeriodoNomina[]
  generar: (data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>) => void
  cerrar: (id: string) => void
  eliminar: (id: string) => void
}

const Ctx = createContext<PeriodosCtx>({
  periodos: [],
  generar: () => {},
  cerrar: () => {},
  eliminar: () => {},
})

export function PeriodosProvider({ children }: { children: ReactNode }) {
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setPeriodos(JSON.parse(raw) as PeriodoNomina[])
    } catch { /* ignore */ }
  }, [])

  function generar(data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>) {
    const nuevo: PeriodoNomina = {
      ...data,
      id: `periodo-${Date.now().toString(36)}`,
      fechaGeneracion: new Date().toISOString(),
    }
    setPeriodos(prev => {
      const next = [nuevo, ...prev]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function cerrar(id: string) {
    setPeriodos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, estado: 'cerrada' as const } : p)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function eliminar(id: string) {
    setPeriodos(prev => {
      const next = prev.filter(p => p.id !== id)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <Ctx.Provider value={{ periodos, generar, cerrar, eliminar }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePeriodos = () => useContext(Ctx)
