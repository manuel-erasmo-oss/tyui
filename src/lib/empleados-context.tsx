'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empleado } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-empleados'

function genId(): string {
  return `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

interface EmpleadosCtx {
  empleados: Empleado[]
  empleadosActivos: Empleado[]
  add: (data: Omit<Empleado, 'id'>) => void
  update: (id: string, changes: Partial<Empleado>) => void
  remove: (id: string) => void
}

const Ctx = createContext<EmpleadosCtx>({
  empleados: [],
  empleadosActivos: [],
  add: () => {},
  update: () => {},
  remove: () => {},
})

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setEmpleados(raw ? JSON.parse(raw) as Empleado[] : [])
    } catch {
      setEmpleados([])
    }
  }, [key, ready])

  function add(data: Omit<Empleado, 'id'>) {
    setEmpleados(prev => {
      const next = [...prev, { ...data, id: genId() }]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function update(id: string, changes: Partial<Empleado>) {
    setEmpleados(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...changes } : e)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function remove(id: string) {
    setEmpleados(prev => {
      const next = prev.filter(e => e.id !== id)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <Ctx.Provider value={{
      empleados,
      empleadosActivos: empleados.filter(e => e.activo),
      add,
      update,
      remove,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useEmpleados = () => useContext(Ctx)
