'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Licencia, TipoLicencia } from '@/types'

const KEY = 'cielo-licencias'

// Días calendario pagados al 100% según tipo de licencia (práctica estándar TSS)
export const DIAS_LICENCIA: Record<TipoLicencia, number> = {
  matrimonial:   5,  // Licencia matrimonial
  fallecimiento: 3,  // Fallecimiento de familiar (abuelos, padres, hijos, cónyuge)
  alumbramiento: 2,  // Alumbramiento de esposa/compañera registrada
}

export function labelLicencia(tipo: TipoLicencia): string {
  switch (tipo) {
    case 'matrimonial':   return 'Matrimonial'
    case 'fallecimiento': return 'Fallecimiento de Familiar'
    case 'alumbramiento': return 'Alumbramiento'
  }
}

interface LicenciasCtx {
  licencias: Licencia[]
  registrar: (empleadoId: string, tipo: TipoLicencia, fechaInicio: string, salarioBase: number, notas?: string) => Licencia
  eliminar: (licenciaId: string) => void
}

const Ctx = createContext<LicenciasCtx>({
  licencias: [],
  registrar: () => { throw new Error('LicenciasProvider not mounted') },
  eliminar: () => {},
})

export function LicenciasProvider({ children }: { children: ReactNode }) {
  const [licencias, setLicencias] = useState<Licencia[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setLicencias(JSON.parse(raw) as Licencia[])
    } catch { /* ignore */ }
  }, [])

  function persist(next: Licencia[]) {
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function registrar(
    empleadoId: string,
    tipo: TipoLicencia,
    fechaInicio: string,
    salarioBase: number,
    notas?: string,
  ): Licencia {
    const dias = DIAS_LICENCIA[tipo]
    const inicio = new Date(fechaInicio)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + (dias - 1))

    const salarioDiario = salarioBase / 23.83
    const montoPagado = Math.round(salarioDiario * dias * 100) / 100

    const nueva: Licencia = {
      id: `licencia-${Date.now().toString(36)}`,
      empleadoId,
      tipo,
      fechaInicio,
      fechaFin: fin.toISOString().split('T')[0],
      dias,
      montoPagado,
      notas,
    }
    setLicencias(prev => {
      const next = [nueva, ...prev]
      persist(next)
      return next
    })
    return nueva
  }

  function eliminar(licenciaId: string) {
    setLicencias(prev => {
      const next = prev.filter(l => l.id !== licenciaId)
      persist(next)
      return next
    })
  }

  return (
    <Ctx.Provider value={{ licencias, registrar, eliminar }}>
      {children}
    </Ctx.Provider>
  )
}

export const useLicencias = () => useContext(Ctx)
