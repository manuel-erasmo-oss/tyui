'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { SaldoISRFavor, AplicacionSaldoISR, TipoCreditoISR } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-saldo-isr'

interface SaldoISRCtx {
  saldos: SaldoISRFavor[]
  registrar: (data: { empleadoId: string; monto: number; motivo: string; tipo?: TipoCreditoISR; anio: number; fechaRegistro: string }) => SaldoISRFavor
  aplicar: (saldoId: string, periodoId: string, periodoLabel: string, monto: number) => void
  liquidar: (saldoId: string) => void
  getSaldosActivos: (empleadoId: string) => SaldoISRFavor[]
  getMontoAplicadoEnPeriodo: (empleadoId: string, periodoId: string) => number
}

const Ctx = createContext<SaldoISRCtx>({
  saldos: [],
  registrar: () => { throw new Error('SaldoISRProvider not mounted') },
  aplicar: () => {},
  liquidar: () => {},
  getSaldosActivos: () => [],
  getMontoAplicadoEnPeriodo: () => 0,
})

export function SaldoISRProvider({ children }: { children: ReactNode }) {
  const [saldos, setSaldos] = useState<SaldoISRFavor[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setSaldos(raw ? JSON.parse(raw) as SaldoISRFavor[] : [])
    } catch {
      setSaldos([])
    }
  }, [key, ready])

  function persist(next: SaldoISRFavor[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function registrar(data: { empleadoId: string; monto: number; motivo: string; tipo?: TipoCreditoISR; anio: number; fechaRegistro: string }): SaldoISRFavor {
    const nuevo: SaldoISRFavor = {
      ...data,
      id: `saldo-isr-${Date.now().toString(36)}`,
      saldoPendiente: data.monto,
      estado: 'activo',
      aplicaciones: [],
    }
    setSaldos(prev => {
      const next = [nuevo, ...prev]
      persist(next)
      return next
    })
    return nuevo
  }

  function aplicar(saldoId: string, periodoId: string, periodoLabel: string, monto: number) {
    if (monto <= 0) return
    const aplicacion: AplicacionSaldoISR = {
      id: `aplic-isr-${Date.now().toString(36)}`,
      periodoId,
      periodoLabel,
      monto,
      fecha: new Date().toISOString(),
    }
    setSaldos(prev => {
      const next = prev.map(s => {
        if (s.id !== saldoId) return s
        const nuevoSaldo = Math.max(0, s.saldoPendiente - monto)
        return {
          ...s,
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo <= 0 ? 'agotado' as const : s.estado,
          aplicaciones: [...s.aplicaciones, aplicacion],
        }
      })
      persist(next)
      return next
    })
  }

  function liquidar(saldoId: string) {
    setSaldos(prev => {
      const next = prev.map(s => s.id === saldoId ? { ...s, saldoPendiente: 0, estado: 'liquidado' as const } : s)
      persist(next)
      return next
    })
  }

  // Ordenado del más antiguo al más reciente — el crédito más viejo se consume primero (FIFO)
  function getSaldosActivos(empleadoId: string): SaldoISRFavor[] {
    return saldos
      .filter(s => s.empleadoId === empleadoId && s.estado === 'activo')
      .sort((a, b) => new Date(a.fechaRegistro).getTime() - new Date(b.fechaRegistro).getTime())
  }

  // Reconstrucción histórica: cuánto se aplicó realmente en un período ya procesado,
  // independiente del saldoPendiente actual (que puede haber cambiado desde entonces)
  function getMontoAplicadoEnPeriodo(empleadoId: string, periodoId: string): number {
    return saldos
      .filter(s => s.empleadoId === empleadoId)
      .flatMap(s => s.aplicaciones)
      .filter(a => a.periodoId === periodoId)
      .reduce((sum, a) => sum + a.monto, 0)
  }

  return (
    <Ctx.Provider value={{ saldos, registrar, aplicar, liquidar, getSaldosActivos, getMontoAplicadoEnPeriodo }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSaldoISR = () => useContext(Ctx)
