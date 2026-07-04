'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { PeriodoNomina, AjusteLinea } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-periodos'

interface PeriodosCtx {
  periodos: PeriodoNomina[]
  generar: (data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>) => PeriodoNomina
  cerrar: (id: string) => void
  eliminar: (id: string) => void
  actualizarAjustes: (periodoId: string, empleadoId: string, ajustes: AjusteLinea[]) => void
  marcarProcesados: (periodoId: string, empleadoIds: string[]) => void
}

const Ctx = createContext<PeriodosCtx>({
  periodos: [],
  generar: () => { throw new Error('PeriodosProvider not mounted') },
  cerrar: () => {},
  eliminar: () => {},
  actualizarAjustes: () => {},
  marcarProcesados: () => {},
})

export function PeriodosProvider({ children }: { children: ReactNode }) {
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setPeriodos(raw ? JSON.parse(raw) as PeriodoNomina[] : [])
    } catch {
      setPeriodos([])
    }
  }, [key, ready])

  function generar(data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>): PeriodoNomina {
    const nuevo: PeriodoNomina = {
      ...data,
      id: `periodo-${Date.now().toString(36)}`,
      fechaGeneracion: new Date().toISOString(),
      ajustesPorEmpleado: data.ajustesPorEmpleado ?? {},
    }
    setPeriodos(prev => {
      const next = [nuevo, ...prev]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    return nuevo
  }

  function cerrar(id: string) {
    setPeriodos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, estado: 'cerrada' as const } : p)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function eliminar(id: string) {
    setPeriodos(prev => {
      const next = prev.filter(p => p.id !== id)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
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
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function marcarProcesados(periodoId: string, empleadoIds: string[]) {
    setPeriodos(prev => {
      const next = prev.map(p => {
        if (p.id !== periodoId) return p
        const ya = new Set(p.empleadosProcesados ?? [])
        empleadoIds.forEach(id => ya.add(id))
        const procesados = [...ya]
        const todosProcesados = procesados.length >= p.totalEmpleados
        return {
          ...p,
          empleadosProcesados: procesados,
          estado: todosProcesados ? 'procesada' as const : p.estado,
        }
      })
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <Ctx.Provider value={{ periodos, generar, cerrar, eliminar, actualizarAjustes, marcarProcesados }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePeriodos = () => useContext(Ctx)
