'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Licencia, TipoLicencia, Empleado } from '@/types'
import { useUserScopedKey } from './user-scoped-key'
import { getDivisorSalarioDiario } from './dominican-labor'

const KEY = 'cielo-licencias'

// Días calendario pagados al 100% según tipo de licencia (práctica estándar TSS)
export const DIAS_LICENCIA: Record<'matrimonial' | 'fallecimiento' | 'alumbramiento', number> = {
  matrimonial:   5,  // Licencia matrimonial
  fallecimiento: 3,  // Fallecimiento de familiar (abuelos, padres, hijos, cónyuge)
  alumbramiento: 2,  // Alumbramiento de esposa/compañera registrada
}

// Días sugeridos para licencias con subsidio — variables según certificado
// médico/legal, el usuario puede ajustarlos. Maternidad: 12 semanas (Art. 236
// Código de Trabajo — 6 semanas antes y 6 después del parto).
export const DIAS_SUGERIDOS_SUBSIDIO: Record<'enfermedad_comun' | 'accidente_laboral' | 'maternidad', number> = {
  enfermedad_comun:  3,
  accidente_laboral: 3,
  maternidad:        84,
}

export const TIPOS_CON_SUBSIDIO: TipoLicencia[] = ['enfermedad_comun', 'accidente_laboral', 'maternidad']

export function esLicenciaConSubsidio(tipo: TipoLicencia): boolean {
  return TIPOS_CON_SUBSIDIO.includes(tipo)
}

export function labelLicencia(tipo: TipoLicencia): string {
  switch (tipo) {
    case 'matrimonial':       return 'Matrimonial'
    case 'fallecimiento':     return 'Fallecimiento de Familiar'
    case 'alumbramiento':     return 'Alumbramiento'
    case 'enfermedad_comun':  return 'Enfermedad Común'
    case 'accidente_laboral': return 'Accidente Laboral / Enf. Profesional'
    case 'maternidad':        return 'Maternidad'
  }
}

// % de subsidio que paga o reembolsa SISALRIL/ARL — no lo desembolsa Cielo
// Cloud, es solo informativo para que la empresa sepa cuánto reclamar/esperar.
function porcentajeSubsidio(tipo: TipoLicencia, modalidadEnfermedad?: 'ambulatoria' | 'hospitalaria'): number {
  switch (tipo) {
    case 'enfermedad_comun':  return modalidadEnfermedad === 'hospitalaria' ? 0.40 : 0.60
    case 'accidente_laboral': return 0.75
    case 'maternidad':        return 1.00 // empleador paga 100% y luego SISALRIL reembolsa
    default:                  return 0
  }
}

interface RegistrarOpciones {
  dias?: number                                          // requerido para tipos con subsidio
  modalidadEnfermedad?: 'ambulatoria' | 'hospitalaria'    // solo enfermedad_comun
  disfruteSueldo?: boolean                                // solo enfermedad_comun / accidente_laboral
  notas?: string
}

interface LicenciasCtx {
  licencias: Licencia[]
  registrar: (
    empleadoId: string,
    tipo: TipoLicencia,
    fechaInicio: string,
    empleado: Pick<Empleado, 'salarioBase' | 'regimenIntermitente'>,
    opciones?: RegistrarOpciones,
  ) => Licencia
  eliminar: (licenciaId: string) => void
}

const Ctx = createContext<LicenciasCtx>({
  licencias: [],
  registrar: () => { throw new Error('LicenciasProvider not mounted') },
  eliminar: () => {},
})

export function LicenciasProvider({ children }: { children: ReactNode }) {
  const [licencias, setLicencias] = useState<Licencia[]>([])
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setLicencias(raw ? JSON.parse(raw) as Licencia[] : [])
    } catch {
      setLicencias([])
    }
  }, [key, ready])

  function persist(next: Licencia[]) {
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function registrar(
    empleadoId: string,
    tipo: TipoLicencia,
    fechaInicio: string,
    empleado: Pick<Empleado, 'salarioBase' | 'regimenIntermitente'>,
    opciones: RegistrarOpciones = {},
  ): Licencia {
    const conSubsidio = esLicenciaConSubsidio(tipo)
    const dias = conSubsidio
      ? Math.max(1, opciones.dias ?? DIAS_SUGERIDOS_SUBSIDIO[tipo as 'enfermedad_comun' | 'accidente_laboral' | 'maternidad'])
      : DIAS_LICENCIA[tipo as 'matrimonial' | 'fallecimiento' | 'alumbramiento']

    const inicio = new Date(fechaInicio)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + (dias - 1))

    const salarioDiario = empleado.salarioBase / getDivisorSalarioDiario(empleado)
    const montoCompleto = Math.round(salarioDiario * dias * 100) / 100

    let montoPagado: number
    let montoSubsidioEstimado: number | undefined

    if (tipo === 'maternidad') {
      // El empleador paga el 100% y luego solicita reembolso a SISALRIL.
      montoPagado = montoCompleto
      montoSubsidioEstimado = montoCompleto
    } else if (conSubsidio) {
      // enfermedad_comun / accidente_laboral: SISALRIL/ARL paga el subsidio
      // directo al empleado — Cielo Cloud solo lo registra. El "disfrute de
      // sueldo" es un beneficio adicional que la empresa paga vía nómina.
      montoSubsidioEstimado = Math.round(montoCompleto * porcentajeSubsidio(tipo, opciones.modalidadEnfermedad) * 100) / 100
      montoPagado = opciones.disfruteSueldo ? montoCompleto : 0
    } else {
      montoPagado = montoCompleto
    }

    const nueva: Licencia = {
      id: `licencia-${Date.now().toString(36)}`,
      empleadoId,
      tipo,
      fechaInicio,
      fechaFin: fin.toISOString().split('T')[0],
      dias,
      montoPagado,
      notas: opciones.notas,
      modalidadEnfermedad: tipo === 'enfermedad_comun' ? opciones.modalidadEnfermedad : undefined,
      disfruteSueldo: conSubsidio && tipo !== 'maternidad' ? (opciones.disfruteSueldo ?? false) : undefined,
      montoSubsidioEstimado,
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
