'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empleado } from '@/types'
import { useEmpresaScopedKey } from './empresa-scoped-key'

const KEY = 'cielo-empleados'

function genId(): string {
  return `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

interface EmpleadosCtx {
  empleados: Empleado[]
  empleadosActivos: Empleado[]
  // Subconjunto de empleadosActivos que además NO está suspendido — úsalo en
  // vez de empleadosActivos para todo lo que implique cobrar o acumular
  // beneficios este ciclo (generar/procesar nómina, acumulación de vacaciones
  // y regalía). Para el roster general, liquidación o saldos iniciales sigue
  // usándose empleadosActivos, porque un suspendido conserva su vínculo.
  empleadosEnNomina: Empleado[]
  add: (data: Omit<Empleado, 'id'>) => void
  update: (id: string, changes: Partial<Empleado>) => void
  remove: (id: string) => void
  suspender: (id: string, fecha: string, motivo: string) => void
  reactivar: (id: string) => void
}

const Ctx = createContext<EmpleadosCtx>({
  empleados: [],
  empleadosActivos: [],
  empleadosEnNomina: [],
  add: () => {},
  update: () => {},
  remove: () => {},
  suspender: () => {},
  reactivar: () => {},
})

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const { key, ready } = useEmpresaScopedKey(KEY)

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

  function suspender(id: string, fecha: string, motivo: string) {
    update(id, { suspendido: true, fechaSuspension: fecha, motivoSuspension: motivo })
  }

  function reactivar(id: string) {
    update(id, { suspendido: false, fechaSuspension: undefined, motivoSuspension: undefined })
  }

  const empleadosActivos = empleados.filter(e => e.activo)

  return (
    <Ctx.Provider value={{
      empleados,
      empleadosActivos,
      empleadosEnNomina: empleadosActivos.filter(e => !e.suspendido),
      add,
      update,
      remove,
      suspender,
      reactivar,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useEmpleados = () => useContext(Ctx)
