'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { ConceptoPersonalizado } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-conceptos-personalizados'

interface ConceptosPersonalizadosCtx {
  conceptos: ConceptoPersonalizado[]
  conceptosActivos: ConceptoPersonalizado[]
  crear: (data: Omit<ConceptoPersonalizado, 'id' | 'creadoEn' | 'activo'>) => void
  actualizar: (id: string, changes: Partial<Omit<ConceptoPersonalizado, 'id' | 'creadoEn'>>) => void
  eliminar: (id: string) => void
  getConcepto: (id: string) => ConceptoPersonalizado | undefined
}

const Ctx = createContext<ConceptosPersonalizadosCtx>({
  conceptos: [],
  conceptosActivos: [],
  crear: () => {},
  actualizar: () => {},
  eliminar: () => {},
  getConcepto: () => undefined,
})

export function ConceptosPersonalizadosProvider({ children }: { children: ReactNode }) {
  const [conceptos, setConceptos] = useState<ConceptoPersonalizado[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setConceptos(raw ? JSON.parse(raw) as ConceptoPersonalizado[] : [])
    } catch {
      setConceptos([])
    }
  }, [key, ready])

  function persist(next: ConceptoPersonalizado[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function crear(data: Omit<ConceptoPersonalizado, 'id' | 'creadoEn' | 'activo'>) {
    // Las deducciones personalizadas nunca afectan ISR ni TSS — se fuerza
    // aquí, en la fuente de verdad, para que no dependa de que la UI lo
    // respete correctamente en cada punto de entrada.
    const nuevo: ConceptoPersonalizado = {
      ...data,
      afectaISR: data.tipo === 'ingreso' ? data.afectaISR : false,
      afectaTSS: data.tipo === 'ingreso' ? data.afectaTSS : false,
      id: `concepto-${Date.now().toString(36)}`,
      creadoEn: new Date().toISOString(),
      activo: true,
    }
    setConceptos(prev => {
      const next = [nuevo, ...prev]
      persist(next)
      return next
    })
  }

  function actualizar(id: string, changes: Partial<Omit<ConceptoPersonalizado, 'id' | 'creadoEn'>>) {
    setConceptos(prev => {
      const next = prev.map(c => {
        if (c.id !== id) return c
        const actualizado = { ...c, ...changes }
        if (actualizado.tipo === 'deduccion') { actualizado.afectaISR = false; actualizado.afectaTSS = false }
        return actualizado
      })
      persist(next)
      return next
    })
  }

  // Desactivar en vez de borrar — un ajuste ya registrado en un período
  // pasado guarda su propio snapshot (nombre/flags), así que desactivar el
  // concepto del catálogo nunca altera esos ajustes; solo lo saca de la
  // lista de opciones al agregar un ajuste nuevo.
  function eliminar(id: string) {
    actualizar(id, { activo: false })
  }

  function getConcepto(id: string): ConceptoPersonalizado | undefined {
    return conceptos.find(c => c.id === id)
  }

  const conceptosActivos = conceptos.filter(c => c.activo)

  return (
    <Ctx.Provider value={{ conceptos, conceptosActivos, crear, actualizar, eliminar, getConcepto }}>
      {children}
    </Ctx.Provider>
  )
}

export const useConceptosPersonalizados = () => useContext(Ctx)
