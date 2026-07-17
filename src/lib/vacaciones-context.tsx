'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { DisfruteVacaciones } from '@/types'
import { useUserScopedKey } from './user-scoped-key'
import { contarDiasLaborables } from './dominican-labor'

const KEY = 'cielo-disfrutes-vacaciones'

interface VacacionesCtx {
  disfrutes: DisfruteVacaciones[]
  registrarDisfrute: (empleadoId: string, fechaInicio: string, fechaFin: string, notas?: string) => DisfruteVacaciones
  eliminarDisfrute: (id: string) => void
  // Suma de días laborables ya tomados (todos los tramos registrados) — lo
  // que se resta del acumulado para saber cuánto le queda disponible.
  diasTomados: (empleadoId: string) => number
  // true si `fecha` (hoy por defecto) cae dentro de algún tramo registrado.
  estaDeVacaciones: (empleadoId: string, fecha?: Date) => boolean
  disfruteActivo: (empleadoId: string, fecha?: Date) => DisfruteVacaciones | null
}

const Ctx = createContext<VacacionesCtx>({
  disfrutes: [],
  registrarDisfrute: () => { throw new Error('VacacionesProvider not mounted') },
  eliminarDisfrute: () => {},
  diasTomados: () => 0,
  estaDeVacaciones: () => false,
  disfruteActivo: () => null,
})

export function VacacionesProvider({ children }: { children: ReactNode }) {
  const [disfrutes, setDisfrutes] = useState<DisfruteVacaciones[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setDisfrutes(raw ? JSON.parse(raw) as DisfruteVacaciones[] : [])
    } catch {
      setDisfrutes([])
    }
  }, [key, ready])

  function persist(next: DisfruteVacaciones[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function registrarDisfrute(empleadoId: string, fechaInicio: string, fechaFin: string, notas?: string): DisfruteVacaciones {
    const diasLaborables = contarDiasLaborables(new Date(fechaInicio), new Date(fechaFin))
    const nuevo: DisfruteVacaciones = {
      id: `disfrute-${Date.now().toString(36)}`,
      empleadoId,
      fechaInicio,
      fechaFin,
      diasLaborables,
      fechaRegistro: new Date().toISOString(),
      notas,
    }
    setDisfrutes(prev => {
      const next = [nuevo, ...prev]
      persist(next)
      return next
    })
    return nuevo
  }

  function eliminarDisfrute(id: string) {
    setDisfrutes(prev => {
      const next = prev.filter(d => d.id !== id)
      persist(next)
      return next
    })
  }

  function diasTomados(empleadoId: string): number {
    return disfrutes
      .filter(d => d.empleadoId === empleadoId)
      .reduce((s, d) => s + d.diasLaborables, 0)
  }

  function disfruteActivo(empleadoId: string, fecha: Date = new Date()): DisfruteVacaciones | null {
    const f = fecha.getTime()
    return disfrutes.find(d =>
      d.empleadoId === empleadoId &&
      new Date(d.fechaInicio).getTime() <= f &&
      new Date(d.fechaFin).getTime() >= f
    ) ?? null
  }

  function estaDeVacaciones(empleadoId: string, fecha?: Date): boolean {
    return disfruteActivo(empleadoId, fecha) !== null
  }

  return (
    <Ctx.Provider value={{ disfrutes, registrarDisfrute, eliminarDisfrute, diasTomados, estaDeVacaciones, disfruteActivo }}>
      {children}
    </Ctx.Provider>
  )
}

export const useVacaciones = () => useContext(Ctx)
