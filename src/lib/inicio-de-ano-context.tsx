'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { ChecklistAnualEstado, FeriadoNacional, PagoPlanificado } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-checklist-anual'

// Decisión de persistencia: en vez de agregar campos nuevos a `Empresa` (que ya
// tiene bastantes campos "de una sola vez" como logo/RNC), el checklist anual
// vive en su propio contexto ligero, indexado por año calendario
// (`Record<number, ChecklistAnualEstado>`), siguiendo el mismo patrón exacto
// de `usePrestamos`/`useLicencias` (useUserScopedKey + localStorage). Esto
// resuelve el requisito de "resetear cada año nuevo" de forma automática: un
// año sin registro previo simplemente no tiene entrada en el mapa, así que se
// muestra vacío/pendiente sin necesidad de ningún cron ni lógica de reset.
type EstadosPorAnio = Record<number, ChecklistAnualEstado>

function estadoVacio(anio: number): ChecklistAnualEstado {
  return { anio, itemsCompletados: [], feriados: [], calendarioPago: [] }
}

interface ChecklistAnualCtx {
  getEstado: (anio: number) => ChecklistAnualEstado
  toggleItem: (anio: number, itemId: string) => void
  agregarFeriado: (anio: number, fecha: string, nombre: string) => void
  eliminarFeriado: (anio: number, feriadoId: string) => void
  actualizarPago: (anio: number, mes: number, quincena: 1 | 2 | undefined, fechaPago: string) => void
}

const Ctx = createContext<ChecklistAnualCtx>({
  getEstado: estadoVacio,
  toggleItem: () => {},
  agregarFeriado: () => {},
  eliminarFeriado: () => {},
  actualizarPago: () => {},
})

export function ChecklistAnualProvider({ children }: { children: ReactNode }) {
  const [estados, setEstados] = useState<EstadosPorAnio>({})
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setEstados(raw ? JSON.parse(raw) as EstadosPorAnio : {})
    } catch {
      setEstados({})
    }
  }, [key, ready])

  function persist(next: EstadosPorAnio) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function getEstado(anio: number): ChecklistAnualEstado {
    return estados[anio] ?? estadoVacio(anio)
  }

  function update(anio: number, fn: (actual: ChecklistAnualEstado) => ChecklistAnualEstado) {
    setEstados(prev => {
      const actual = prev[anio] ?? estadoVacio(anio)
      const next = { ...prev, [anio]: fn(actual) }
      persist(next)
      return next
    })
  }

  function toggleItem(anio: number, itemId: string) {
    update(anio, actual => {
      const completado = actual.itemsCompletados.includes(itemId)
      return {
        ...actual,
        itemsCompletados: completado
          ? actual.itemsCompletados.filter(id => id !== itemId)
          : [...actual.itemsCompletados, itemId],
      }
    })
  }

  function agregarFeriado(anio: number, fecha: string, nombre: string) {
    const nuevo: FeriadoNacional = { id: `feriado-${Date.now().toString(36)}`, fecha, nombre }
    update(anio, actual => ({
      ...actual,
      feriados: [...actual.feriados, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }))
  }

  function eliminarFeriado(anio: number, feriadoId: string) {
    update(anio, actual => ({
      ...actual,
      feriados: actual.feriados.filter(f => f.id !== feriadoId),
    }))
  }

  // Upsert: reemplaza la fecha de pago del mes (+quincena si aplica) o crea la entrada si no existe.
  function actualizarPago(anio: number, mes: number, quincena: 1 | 2 | undefined, fechaPago: string) {
    update(anio, actual => {
      const idx = actual.calendarioPago.findIndex(p => p.mes === mes && p.quincena === quincena)
      const entrada: PagoPlanificado = { mes, quincena, fechaPago }
      const calendarioPago = idx >= 0
        ? actual.calendarioPago.map((p, i) => i === idx ? entrada : p)
        : [...actual.calendarioPago, entrada]
      return { ...actual, calendarioPago }
    })
  }

  return (
    <Ctx.Provider value={{ getEstado, toggleItem, agregarFeriado, eliminarFeriado, actualizarPago }}>
      {children}
    </Ctx.Provider>
  )
}

export const useChecklistAnual = () => useContext(Ctx)
