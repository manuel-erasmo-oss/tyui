'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { RegistroAumento, EstadoAumento } from '@/types'
import { useUserScopedKey } from './user-scoped-key'
import { useEmpleados } from './empleados-context'

const KEY = 'cielo-aumentos'

// Lo que el llamador provee al solicitar un aumento — el resto (id, fechas,
// estado) lo completa el context.
export type SolicitudAumentoInput = Omit<
  RegistroAumento,
  'id' | 'fechaSolicitud' | 'estado' | 'fechaAprobacion' | 'aprobadoPor' | 'motivoRechazo' | 'fechaAplicacion'
>

interface AumentosCtx {
  aumentos: RegistroAumento[]
  // Crea la solicitud en estado 'pendiente_aprobacion' — nunca toca Empleado.salarioBase.
  solicitar: (data: SolicitudAumentoInput) => RegistroAumento
  // Pasa una solicitud pendiente a 'aprobado'. `aprobadoPor` es el nombre que el
  // usuario escribió a mano en el campo de confirmación explícita (ver nota en types/index.ts).
  aprobar: (id: string, aprobadoPor: string) => void
  rechazar: (id: string, motivo?: string) => void
  // Único punto que sobreescribe Empleado.salarioBase — exige que el registro
  // ya esté 'aprobado'. Devuelve false si la precondición no se cumple.
  aplicar: (id: string) => boolean
  getPendientes: () => RegistroAumento[]
  getHistorial: (empleadoId?: string) => RegistroAumento[]
}

const Ctx = createContext<AumentosCtx>({
  aumentos: [],
  solicitar: () => { throw new Error('AumentosProvider not mounted') },
  aprobar: () => {},
  rechazar: () => {},
  aplicar: () => false,
  getPendientes: () => [],
  getHistorial: () => [],
})

export function AumentosProvider({ children }: { children: ReactNode }) {
  const [aumentos, setAumentos] = useState<RegistroAumento[]>([])
  const { key, ready } = useUserScopedKey(KEY)
  const { update } = useEmpleados()

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setAumentos(raw ? JSON.parse(raw) as RegistroAumento[] : [])
    } catch {
      setAumentos([])
    }
  }, [key, ready])

  function persist(next: RegistroAumento[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function solicitar(data: SolicitudAumentoInput): RegistroAumento {
    const nuevo: RegistroAumento = {
      ...data,
      id: `aumento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      fechaSolicitud: new Date().toISOString(),
      estado: 'pendiente_aprobacion',
    }
    setAumentos(prev => {
      const next = [nuevo, ...prev]
      persist(next)
      return next
    })
    return nuevo
  }

  function aprobar(id: string, aprobadoPor: string) {
    setAumentos(prev => {
      const next = prev.map(a => {
        if (a.id !== id || a.estado !== 'pendiente_aprobacion') return a
        return {
          ...a,
          estado: 'aprobado' as EstadoAumento,
          aprobadoPor,
          fechaAprobacion: new Date().toISOString(),
        }
      })
      persist(next)
      return next
    })
  }

  function rechazar(id: string, motivo?: string) {
    setAumentos(prev => {
      const next = prev.map(a => {
        if (a.id !== id || a.estado !== 'pendiente_aprobacion') return a
        return {
          ...a,
          estado: 'rechazado' as EstadoAumento,
          motivoRechazo: motivo,
          fechaAprobacion: new Date().toISOString(), // fecha de resolución (aprobado o rechazado)
        }
      })
      persist(next)
      return next
    })
  }

  function aplicar(id: string): boolean {
    const registro = aumentos.find(a => a.id === id)
    if (!registro || registro.estado !== 'aprobado') return false
    // Único lugar del sistema donde este flujo escribe Empleado.salarioBase.
    update(registro.empleadoId, { salarioBase: registro.salarioNuevo })
    setAumentos(prev => {
      const next = prev.map(a => a.id === id
        ? { ...a, estado: 'aplicado' as EstadoAumento, fechaAplicacion: new Date().toISOString() }
        : a)
      persist(next)
      return next
    })
    return true
  }

  // Orden FIFO (más antigua primero) — es una cola de trabajo, no un historial.
  function getPendientes(): RegistroAumento[] {
    return aumentos
      .filter(a => a.estado === 'pendiente_aprobacion')
      .sort((a, b) => new Date(a.fechaSolicitud).getTime() - new Date(b.fechaSolicitud).getTime())
  }

  function getHistorial(empleadoId?: string): RegistroAumento[] {
    return aumentos
      .filter(a => !empleadoId || a.empleadoId === empleadoId)
      .sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime())
  }

  return (
    <Ctx.Provider value={{ aumentos, solicitar, aprobar, rechazar, aplicar, getPendientes, getHistorial }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAumentos = () => useContext(Ctx)
