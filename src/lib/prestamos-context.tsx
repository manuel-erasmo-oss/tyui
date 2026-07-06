'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Prestamo, CuotaPago } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-prestamos'

export function calcularCuotaBase(monto: number, tasaInteres: number, cuotas: number): number {
  if (cuotas <= 0) return 0
  if (tasaInteres === 0) return monto / cuotas
  const r = tasaInteres / 100
  return (monto * r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1)
}

// ─── Interés simple: cuota fija ────────────────────────────────────────────
// A diferencia de la amortización francesa (interés sobre saldo decreciente),
// el interés simple se calcula UNA sola vez sobre el capital original y se
// reparte fijo en cada cuota junto con el capital (también fijo, dividido en
// partes iguales). La cuota resultante es constante, pero por una razón
// distinta a la de la cuota francesa.
export function calcularCuotaSimple(monto: number, tasaInteres: number, cuotas: number): number {
  if (cuotas <= 0) return 0
  return (monto / cuotas) + (monto * (tasaInteres / 100))
}

export interface FilaAmortizacion {
  num: number
  cuota: number
  capital: number
  interes: number
  saldo: number
}

// ─── Amortización francesa (cuota fija, interés sobre saldo decreciente) ───
export function calcularAmortizacionFrancesa(monto: number, tasaInteres: number, cuotas: number): FilaAmortizacion[] {
  if (cuotas <= 0) return []
  const cuotaBase   = calcularCuotaBase(monto, tasaInteres, cuotas)
  const tasaMensual = tasaInteres / 100
  const rows: FilaAmortizacion[] = []
  let saldo = monto

  for (let i = 1; i <= cuotas; i++) {
    let interes: number
    let capital: number

    if (tasaInteres === 0) {
      interes = 0
      capital = cuotaBase
    } else {
      interes = saldo * tasaMensual
      capital = cuotaBase - interes
    }

    const saldoRestante = Math.max(0, saldo - capital)
    rows.push({ num: i, cuota: cuotaBase, capital, interes, saldo: saldoRestante })
    saldo = saldoRestante
  }

  return rows
}

// ─── Amortización con interés simple (capital e interés fijos por cuota) ───
export function calcularAmortizacionSimple(monto: number, tasaInteres: number, cuotas: number): FilaAmortizacion[] {
  if (cuotas <= 0) return []
  const capitalPorCuota = monto / cuotas
  const interesPorCuota = monto * (tasaInteres / 100)
  const cuotaTotal      = capitalPorCuota + interesPorCuota
  const rows: FilaAmortizacion[] = []
  let saldo = monto

  for (let i = 1; i <= cuotas; i++) {
    const saldoRestante = Math.max(0, saldo - capitalPorCuota)
    rows.push({ num: i, cuota: cuotaTotal, capital: capitalPorCuota, interes: interesPorCuota, saldo: saldoRestante })
    saldo = saldoRestante
  }

  return rows
}

// Dispatcher — usa el modo indicado en el préstamo ('francés' es el default
// retrocompatible para registros previos a la existencia de este campo).
export function calcularAmortizacion(
  monto: number,
  tasaInteres: number,
  cuotas: number,
  modo: 'francés' | 'simple' = 'francés'
): FilaAmortizacion[] {
  return modo === 'simple'
    ? calcularAmortizacionSimple(monto, tasaInteres, cuotas)
    : calcularAmortizacionFrancesa(monto, tasaInteres, cuotas)
}

interface PrestamosCtx {
  prestamos: Prestamo[]
  otorgar: (data: Omit<Prestamo, 'id' | 'saldoPendiente' | 'pagos' | 'estado'>) => Prestamo
  registrarPago: (prestamoId: string, pago: Omit<CuotaPago, 'id'>) => void
  cancelar: (prestamoId: string) => void
  getPrestamosActivos: (empleadoId: string) => Prestamo[]
  registrarOmisionCuota: (prestamoId: string) => void
}

const Ctx = createContext<PrestamosCtx>({
  prestamos: [],
  otorgar: () => { throw new Error('PrestamosProvider not mounted') },
  registrarPago: () => {},
  cancelar: () => {},
  getPrestamosActivos: () => [],
  registrarOmisionCuota: () => {},
})

export function PrestamosProvider({ children }: { children: ReactNode }) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setPrestamos(raw ? JSON.parse(raw) as Prestamo[] : [])
    } catch {
      setPrestamos([])
    }
  }, [key, ready])

  function persist(next: Prestamo[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
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
          // Volvió a cobrarse con normalidad — se resetea la racha de omisiones.
          cuotasOmitidasConsecutivas: 0,
          requiereGestionCobro: false,
        }
      })
      persist(next)
      return next
    })
  }

  // Se llama cuando el neto de un empleado no alcanzó para cubrir la cuota de
  // este período y esa cuota se omitió (ver manejarInsuficienciaFondos en
  // nomina/page.tsx) — no descuenta nada del saldo, solo lleva la cuenta de
  // omisiones consecutivas para señalar cuándo requiere seguimiento manual.
  function registrarOmisionCuota(prestamoId: string) {
    setPrestamos(prev => {
      const next = prev.map(p => {
        if (p.id !== prestamoId) return p
        const omisiones = (p.cuotasOmitidasConsecutivas ?? 0) + 1
        return { ...p, cuotasOmitidasConsecutivas: omisiones, requiereGestionCobro: omisiones >= 3 }
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
    <Ctx.Provider value={{ prestamos, otorgar, registrarPago, cancelar, getPrestamosActivos, registrarOmisionCuota }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePrestamos = () => useContext(Ctx)
