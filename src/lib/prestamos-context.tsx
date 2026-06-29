'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Prestamo, CuotaPago } from '@/types'

const KEY = 'cielo-prestamos'

export function calcularCuotaBase(monto: number, tasaInteres: number, cuotas: number): number {
  if (cuotas <= 0) return 0
  if (tasaInteres === 0) return monto / cuotas
  const r = tasaInteres / 100
  return (monto * r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1)
}

interface PrestamosCtx {
  prestamos: Prestamo[]
  otorgar: (data: Omit<Prestamo, 'id' | 'saldoPendiente' | 'pagos' | 'estado'>) => Prestamo
  registrarPago: (prestamoId: string, pago: Omit<CuotaPago, 'id'>) => void
  cancelar: (prestamoId: string) => void
  getPrestamosActivos: (empleadoId: string) => Prestamo[]
}

const Ctx = createContext<PrestamosCtx>({
  prestamos: [],
  otorgar: () => { throw new Error('PrestamosProvider not mounted') },
  registrarPago: () => {},
  cancelar: () => {},
  getPrestamosActivos: () => [],
})

export function PrestamosProvider({ children }: { children: ReactNode }) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setPrestamos(JSON.parse(raw) as Prestamo[])
    } catch { /* ignore */ }
  }, [])

  function persist(next: Prestamo[]) {
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function otorgar(data: Omit<Prestamo, 'id' | 'saldoPendiente' | 'pagos' | 'estado'>): Prestamo {
    const nuevo: Prestamo = {
      ...data,
      id: `prestamo-${Date.now().toString(36)}`,
      saldoPendiente: data.monto,
      pagos: [],
      estado: 'activo',
    }
    setPrestamos(prev => {
      const next = [nuevo, ...prev]
      persist(next)
      return next
    })
    return nuevo
  }

  function registrarPago(prestamoId: string, pago: Omit<CuotaPago, 'id'>) {
    const cuota: CuotaPago = { ...pago, id: `pago-${Date.now().toString(36)}` }
    setPrestamos(prev => {
      const next = prev.map(p => {
        if (p.id !== prestamoId) return p
        const nuevoSaldo = Math.max(0, p.saldoPendiente - cuota.montoPagado)
        return {
          ...p,
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo <= 0 ? 'pagado' as const : p.estado,
          pagos: [...p.pagos, cuota],
        }
      })
      persist(next)
      return next
    })
  }

  function cancelar(prestamoId: string) {
    setPrestamos(prev => {
      const next = prev.map(p => p.id === prestamoId ? { ...p, estado: 'cancelado' as const } : p)
      persist(next)
      return next
    })
  }

  function getPrestamosActivos(empleadoId: string): Prestamo[] {
    return prestamos.filter(p => p.empleadoId === empleadoId && p.estado === 'activo')
  }

  return (
    <Ctx.Provider value={{ prestamos, otorgar, registrarPago, cancelar, getPrestamosActivos }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePrestamos = () => useContext(Ctx)
