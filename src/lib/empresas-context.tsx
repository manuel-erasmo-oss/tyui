'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { EmpresaResumen } from '@/types'
import { useAuth } from './auth-context'
import { FIREBASE_ENABLED } from './firebase'
import { useUserScopedKey } from './user-scoped-key'
import { EMPRESA_SCOPED_BASES, buildEmpresaScopedKey } from './empresa-scoped-bases'

// Lista de empresas de la cuenta + cuál está activa — scopeado solo por
// cuenta (uid), NO por empresa, porque esto ES la lista de empresas. El
// perfil completo de cada empresa vive por separado en empresa-context.tsx,
// scopeado por (cuenta + empresa activa) vía useEmpresaScopedKey.
const KEY = 'cielo-empresas'

function genEmpresaId(): string {
  return `empresa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function nuevaResumenVacia(): EmpresaResumen {
  return { id: genEmpresaId(), nombre: '', creadaEn: new Date().toISOString() }
}

interface EstadoEmpresas {
  empresas: EmpresaResumen[]
  empresaActivaId: string | null
}

const ESTADO_VACIO: EstadoEmpresas = { empresas: [], empresaActivaId: null }

interface EmpresasCtx {
  empresas: EmpresaResumen[]
  empresaActivaId: string | null
  cargado: boolean
  crearEmpresa: (nombre?: string) => string
  cambiarEmpresa: (id: string) => void
  eliminarEmpresa: (id: string) => void
  actualizarResumen: (id: string, datos: Partial<Pick<EmpresaResumen, 'nombre' | 'logo'>>) => void
}

const Ctx = createContext<EmpresasCtx>({
  empresas: [],
  empresaActivaId: null,
  cargado: false,
  crearEmpresa: () => '',
  cambiarEmpresa: () => {},
  eliminarEmpresa: () => {},
  actualizarResumen: () => {},
})

export function EmpresasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [estado, setEstado]   = useState<EstadoEmpresas>(ESTADO_VACIO)
  const [cargado, setCargado] = useState(false)

  const { key, ready } = useUserScopedKey(KEY)
  const uid = FIREBASE_ENABLED ? user?.uid : undefined

  function persist(data: EstadoEmpresas) {
    try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!ready) { setCargado(false); return }
    let siguiente: EstadoEmpresas
    try {
      const raw = localStorage.getItem(key)
      siguiente = raw ? (JSON.parse(raw) as EstadoEmpresas) : ESTADO_VACIO
    } catch {
      siguiente = ESTADO_VACIO
    }
    // Toda cuenta necesita al menos una empresa activa para que el resto del
    // sistema (todos los contextos scopeados por empresa) tenga dónde leer y
    // escribir — se crea en silencio la primera vez, sin pantalla dedicada:
    // el Asistente de Onboarding ya cumple el rol de "configura tu primera empresa".
    if (siguiente.empresas.length === 0) {
      const primera = nuevaResumenVacia()
      siguiente = { empresas: [primera], empresaActivaId: primera.id }
      try { localStorage.setItem(key, JSON.stringify(siguiente)) } catch { /* ignore */ }
    } else if (!siguiente.empresaActivaId || !siguiente.empresas.some(e => e.id === siguiente.empresaActivaId)) {
      siguiente = { ...siguiente, empresaActivaId: siguiente.empresas[0].id }
      try { localStorage.setItem(key, JSON.stringify(siguiente)) } catch { /* ignore */ }
    }
    setEstado(siguiente)
    setCargado(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  function crearEmpresa(nombre = ''): string {
    const nueva: EmpresaResumen = { id: genEmpresaId(), nombre, creadaEn: new Date().toISOString() }
    setEstado(prev => {
      const next = { empresas: [...prev.empresas, nueva], empresaActivaId: nueva.id }
      persist(next)
      return next
    })
    return nueva.id
  }

  function cambiarEmpresa(id: string) {
    setEstado(prev => {
      if (!prev.empresas.some(e => e.id === id) || prev.empresaActivaId === id) return prev
      const next = { ...prev, empresaActivaId: id }
      persist(next)
      return next
    })
  }

  function eliminarEmpresa(id: string) {
    setEstado(prev => {
      const restantes = prev.empresas.filter(e => e.id !== id)
      // Nunca se queda la cuenta sin ninguna empresa — si se elimina la
      // última, se crea una nueva vacía en su lugar (mismo comportamiento
      // que el primer login).
      const conAlMenosUna = restantes.length > 0 ? restantes : [nuevaResumenVacia()]
      const activaSigueExistiendo = conAlMenosUna.some(e => e.id === prev.empresaActivaId)
      const next: EstadoEmpresas = {
        empresas: conAlMenosUna,
        empresaActivaId: activaSigueExistiendo ? prev.empresaActivaId : conAlMenosUna[0].id,
      }
      persist(next)
      // Limpia todo el localStorage scopeado a la empresa eliminada — evita
      // dejar datos huérfanos (empleados, nómina, préstamos, etc.) que nunca
      // más se vuelven a leer pero siguen ocupando espacio.
      try {
        for (const base of EMPRESA_SCOPED_BASES) {
          localStorage.removeItem(buildEmpresaScopedKey(base, uid, id))
        }
      } catch { /* ignore */ }
      return next
    })
  }

  function actualizarResumen(id: string, datos: Partial<Pick<EmpresaResumen, 'nombre' | 'logo'>>) {
    setEstado(prev => {
      const next = { ...prev, empresas: prev.empresas.map(e => e.id === id ? { ...e, ...datos } : e) }
      persist(next)
      return next
    })
  }

  return (
    <Ctx.Provider value={{ empresas: estado.empresas, empresaActivaId: estado.empresaActivaId, cargado, crearEmpresa, cambiarEmpresa, eliminarEmpresa, actualizarResumen }}>
      {children}
    </Ctx.Provider>
  )
}

export const useEmpresas = () => useContext(Ctx)
