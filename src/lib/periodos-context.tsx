'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { PeriodoNomina, AjusteLinea } from '@/types'

const KEY = 'cielo-periodos'

interface PeriodosCtx {
  periodos: PeriodoNomina[]
  generar: (data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>) => PeriodoNomina
  cerrar: (id: string) => void
  eliminar: (id: string) => void
  actualizarAjustes: (periodoId: string, empleadoId: string, ajustes: AjusteLinea[]) => void
}

const Ctx = createContext<PeriodosCtx>({
  periodos: [],
  generar: () => { throw new Error('PeriodosProvider not mounted') },
  cerrar: () => {},
  eliminar: () => {},
  actualizarAjustes: () => {},
})

export function PeriodosProvider({ children }: { children: ReactNode }) {
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setPeriodos(JSON.parse(raw) as PeriodoNomina[])
    } catch { /* ignore */ }
  }, [])

  function generar(data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>): PeriodoNomina {
    const nuevo: PeriodoNomina = {
      ...data,
      id: `periodo-${Date.now().toString(36)}`,
      fechaGeneracion: new Date().toISOString(),
      ajustesPorEmpleado: {},
    }
    setPeriodos(prev => {
      const next = [nuevo, ...prev]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    return nuevo
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

  function actualizarAjustes(periodoId: string, empleadoId: string, ajustes: AjusteLinea[]) {
    setPeriodos(prev => {
      const next = prev.map(p =>
        p.id === periodoId
          ? { ...p, ajustesPorEmpleado: { ...(p.ajustesPorEmpleado ?? {}), [empleadoId]: ajustes } }
          : p
      )
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <Ctx.Provider value={{ periodos, generar, cerrar, eliminar, actualizarAjustes }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePeriodos = () => useContext(Ctx)
