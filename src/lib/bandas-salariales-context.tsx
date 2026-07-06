'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { BandaSalarial } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-bandas-salariales'

// Normaliza una posición/cargo para comparar de forma case-insensitive y sin
// espacios al inicio/final — usado tanto al guardar como al matchear contra
// `Empleado.cargo`.
export function normalizarPosicion(posicion: string): string {
  return posicion.trim().toLowerCase()
}

interface BandasSalarialesCtx {
  bandas: BandaSalarial[]
  crear: (data: Omit<BandaSalarial, 'id'>) => void
  actualizar: (id: string, changes: Partial<Omit<BandaSalarial, 'id'>>) => void
  eliminar: (id: string) => void
  getBandaPorPosicion: (posicion: string) => BandaSalarial | undefined
}

const Ctx = createContext<BandasSalarialesCtx>({
  bandas: [],
  crear: () => {},
  actualizar: () => {},
  eliminar: () => {},
  getBandaPorPosicion: () => undefined,
})

export function BandasSalarialesProvider({ children }: { children: ReactNode }) {
  const [bandas, setBandas] = useState<BandaSalarial[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setBandas(raw ? JSON.parse(raw) as BandaSalarial[] : [])
    } catch {
      setBandas([])
    }
  }, [key, ready])

  function persist(next: BandaSalarial[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function crear(data: Omit<BandaSalarial, 'id'>) {
    const nueva: BandaSalarial = {
      ...data,
      id: `banda-${Date.now().toString(36)}`,
    }
    setBandas(prev => {
      const next = [nueva, ...prev]
      persist(next)
      return next
    })
  }

  function actualizar(id: string, changes: Partial<Omit<BandaSalarial, 'id'>>) {
    setBandas(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...changes } : b)
      persist(next)
      return next
    })
  }

  function eliminar(id: string) {
    setBandas(prev => {
      const next = prev.filter(b => b.id !== id)
      persist(next)
      return next
    })
  }

  function getBandaPorPosicion(posicion: string): BandaSalarial | undefined {
    const target = normalizarPosicion(posicion)
    return bandas.find(b => normalizarPosicion(b.posicion) === target)
  }

  return (
    <Ctx.Provider value={{ bandas, crear, actualizar, eliminar, getBandaPorPosicion }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBandasSalariales = () => useContext(Ctx)
