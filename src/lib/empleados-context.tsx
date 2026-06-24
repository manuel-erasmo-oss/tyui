'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { EMPLEADOS as MOCK } from './mock-data'
import type { Empleado } from '@/types'

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
  empleados: MOCK,
  empleadosActivos: MOCK.filter(e => e.activo),
  add: () => {},
  update: () => {},
  remove: () => {},
})

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>(MOCK)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setEmpleados(JSON.parse(raw) as Empleado[])
    } catch { /* ignore */ }
  }, [])

  function persist(next: Empleado[]) {
    setEmpleados(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function add(data: Omit<Empleado, 'id'>) {
    setEmpleados(prev => {
      const next = [...prev, { ...data, id: genId() }]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function update(id: string, changes: Partial<Empleado>) {
    setEmpleados(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...changes } : e)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function remove(id: string) {
    setEmpleados(prev => {
      const next = prev.filter(e => e.id !== id)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
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
