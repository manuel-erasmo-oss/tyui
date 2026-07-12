'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empleado, MotivoLiquidacion } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

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
  // Marca a un empleado para salida (dar de baja) sin desvincularlo todavía
  // — activo se mantiene true hasta que Liquidación finalice su cálculo.
  // Ver el bloque "Salida pendiente de liquidar" en el tipo Empleado.
  marcarSalidaPendiente: (
    id: string, fecha: string, motivo: MotivoLiquidacion, pagoDias: 'nomina' | 'liquidacion'
  ) => void
  // Deshace una salida pendiente marcada por error, antes de liquidar.
  cancelarSalidaPendiente: (id: string) => void
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
  marcarSalidaPendiente: () => {},
  cancelarSalidaPendiente: () => {},
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

  function suspender(id: string, fecha: string, motivo: string) {
    update(id, { suspendido: true, fechaSuspension: fecha, motivoSuspension: motivo })
  }

  function reactivar(id: string) {
    update(id, { suspendido: false, fechaSuspension: undefined, motivoSuspension: undefined })
  }

  function marcarSalidaPendiente(
    id: string, fecha: string, motivo: MotivoLiquidacion, pagoDias: 'nomina' | 'liquidacion'
  ) {
    update(id, {
      salidaPendiente: true,
      fechaSalidaPendiente: fecha,
      motivoSalidaPendiente: motivo,
      pagoDiasTrabajadosPendiente: pagoDias,
    })
  }

  function cancelarSalidaPendiente(id: string) {
    update(id, {
      salidaPendiente: false,
      fechaSalidaPendiente: undefined,
      motivoSalidaPendiente: undefined,
      pagoDiasTrabajadosPendiente: undefined,
    })
  }

  const empleadosActivos = empleados.filter(e => e.activo)

  return (
    <Ctx.Provider value={{
      empleados,
      empleadosActivos,
      empleadosEnNomina: empleadosActivos.filter(e => !e.suspendido && !e.salidaPendiente),
      add,
      update,
      remove,
      suspender,
      reactivar,
      marcarSalidaPendiente,
      cancelarSalidaPendiente,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useEmpleados = () => useContext(Ctx)
