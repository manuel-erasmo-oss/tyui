'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { RetribucionComplementaria } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-retribuciones-complementarias'

interface RetribucionesCtx {
  retribuciones: RetribucionComplementaria[]
  agregar: (
    mes: number, anio: number, concepto: string, valorMensual: number,
    empleadoId?: string, notas?: string,
  ) => RetribucionComplementaria
  eliminar: (id: string) => void
  marcarDeclarado: (mes: number, anio: number, fecha: string) => void
  desmarcarDeclarado: (mes: number, anio: number) => void
}

const Ctx = createContext<RetribucionesCtx>({
  retribuciones: [],
  agregar: () => { throw new Error('RetribucionesProvider not mounted') },
  eliminar: () => {},
  marcarDeclarado: () => {},
  desmarcarDeclarado: () => {},
})

export function RetribucionesProvider({ children }: { children: ReactNode }) {
  const [retribuciones, setRetribuciones] = useState<RetribucionComplementaria[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setRetribuciones(raw ? JSON.parse(raw) as RetribucionComplementaria[] : [])
    } catch {
      setRetribuciones([])
    }
  }, [key, ready])

  function persist(next: RetribucionComplementaria[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function agregar(
    mes: number, anio: number, concepto: string, valorMensual: number,
    empleadoId?: string, notas?: string,
  ): RetribucionComplementaria {
    const nueva: RetribucionComplementaria = {
      id: `retribucion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      mes, anio, concepto, valorMensual, empleadoId, notas,
      declarada: false,
    }
    setRetribuciones(prev => {
      const next = [nueva, ...prev]
      persist(next)
      return next
    })
    return nueva
  }

  function eliminar(id: string) {
    setRetribuciones(prev => {
      const next = prev.filter(r => r.id !== id)
      persist(next)
      return next
    })
  }

  // Una sola declaración IR-17 cubre todos los conceptos de un mismo mes —
  // marcar/desmarcar aplica a TODAS las líneas de ese mes/año a la vez.
  function marcarDeclarado(mes: number, anio: number, fecha: string) {
    setRetribuciones(prev => {
      const next = prev.map(r => (r.mes === mes && r.anio === anio) ? { ...r, declarada: true, fechaDeclaracion: fecha } : r)
      persist(next)
      return next
    })
  }

  function desmarcarDeclarado(mes: number, anio: number) {
    setRetribuciones(prev => {
      const next = prev.map(r => (r.mes === mes && r.anio === anio) ? { ...r, declarada: false, fechaDeclaracion: undefined } : r)
      persist(next)
      return next
    })
  }

  return (
    <Ctx.Provider value={{ retribuciones, agregar, eliminar, marcarDeclarado, desmarcarDeclarado }}>
      {children}
    </Ctx.Provider>
  )
}

export const useRetribuciones = () => useContext(Ctx)
