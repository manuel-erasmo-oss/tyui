'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { RegistroLiquidacion } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-liquidaciones'

interface LiquidacionesCtx {
  liquidaciones: RegistroLiquidacion[]
  registrar: (data: Omit<RegistroLiquidacion, 'id' | 'fechaRegistro'>) => RegistroLiquidacion
  getLiquidacionDe: (empleadoId: string) => RegistroLiquidacion | undefined
}

const Ctx = createContext<LiquidacionesCtx>({
  liquidaciones: [],
  registrar: () => { throw new Error('LiquidacionesProvider not mounted') },
  getLiquidacionDe: () => undefined,
})

export function LiquidacionesProvider({ children }: { children: ReactNode }) {
  const [liquidaciones, setLiquidaciones] = useState<RegistroLiquidacion[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setLiquidaciones(raw ? JSON.parse(raw) as RegistroLiquidacion[] : [])
    } catch {
      setLiquidaciones([])
    }
  }, [key, ready])

  function persist(next: RegistroLiquidacion[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function registrar(data: Omit<RegistroLiquidacion, 'id' | 'fechaRegistro'>): RegistroLiquidacion {
    const nueva: RegistroLiquidacion = {
      ...data,
      id: `liquidacion-${Date.now().toString(36)}`,
      fechaRegistro: new Date().toISOString(),
    }
    setLiquidaciones(prev => {
      const next = [nueva, ...prev]
      persist(next)
      return next
    })
    return nueva
  }

  function getLiquidacionDe(empleadoId: string): RegistroLiquidacion | undefined {
    return liquidaciones.find(l => l.empleadoId === empleadoId)
  }

  return (
    <Ctx.Provider value={{ liquidaciones, registrar, getLiquidacionDe }}>
      {children}
    </Ctx.Provider>
  )
}

export const useLiquidaciones = () => useContext(Ctx)
