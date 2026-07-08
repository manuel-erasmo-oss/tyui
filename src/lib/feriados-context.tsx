'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { FeriadosAnio, FeriadoNacional } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-feriados'

// Guardado por AÑO CALENDARIO — un año sin registro previo simplemente no
// tiene entrada en el mapa, así que el calendario aparece vacío para un año
// nuevo sin necesidad de ningún cron ni lógica de reseteo explícita.
type FeriadosPorAnio = Record<number, FeriadosAnio>

function estadoVacio(anio: number): FeriadosAnio {
  return { anio, feriados: [] }
}

interface FeriadosCtx {
  getFeriados: (anio: number) => FeriadoNacional[]
  agregarFeriado: (anio: number, fecha: string, nombre: string) => void
  eliminarFeriado: (anio: number, feriadoId: string) => void
}

const Ctx = createContext<FeriadosCtx>({
  getFeriados: () => [],
  agregarFeriado: () => {},
  eliminarFeriado: () => {},
})

export function FeriadosProvider({ children }: { children: ReactNode }) {
  const [estados, setEstados] = useState<FeriadosPorAnio>({})
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setEstados(raw ? JSON.parse(raw) as FeriadosPorAnio : {})
    } catch {
      setEstados({})
    }
  }, [key, ready])

  function persist(next: FeriadosPorAnio) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function getFeriados(anio: number): FeriadoNacional[] {
    return estados[anio]?.feriados ?? []
  }

  function agregarFeriado(anio: number, fecha: string, nombre: string) {
    const nuevo: FeriadoNacional = { id: `feriado-${Date.now().toString(36)}`, fecha, nombre }
    setEstados(prev => {
      const actual = prev[anio] ?? estadoVacio(anio)
      const next = {
        ...prev,
        [anio]: { ...actual, feriados: [...actual.feriados, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)) },
      }
      persist(next)
      return next
    })
  }

  function eliminarFeriado(anio: number, feriadoId: string) {
    setEstados(prev => {
      const actual = prev[anio] ?? estadoVacio(anio)
      const next = { ...prev, [anio]: { ...actual, feriados: actual.feriados.filter(f => f.id !== feriadoId) } }
      persist(next)
      return next
    })
  }

  return (
    <Ctx.Provider value={{ getFeriados, agregarFeriado, eliminarFeriado }}>
      {children}
    </Ctx.Provider>
  )
}

export const useFeriados = () => useContext(Ctx)
