'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empresa } from '@/types'
import { useEmpresaScopedKey } from './empresa-scoped-key'
import { useEmpresas } from './empresas-context'

const KEY = 'cielo-empresa'

function defaultParaEmpresa(id: string): Empresa {
  return {
    id, nombre: '', rnc: '', direccion: '', ciudad: '',
    telefono: '', email: '', representanteLegal: '',
    modalidadNomina: 'mensual' as const,
  }
}

interface EmpresaCtx {
  empresa: Empresa
  cargado: boolean
  guardar: (data: Empresa) => void
}

const Ctx = createContext<EmpresaCtx>({ empresa: defaultParaEmpresa(''), cargado: false, guardar: () => {} })

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresaActivaId, actualizarResumen } = useEmpresas()
  const [empresa, setEmpresa] = useState<Empresa>(defaultParaEmpresa(''))
  const [cargado, setCargado] = useState(false)
  const { key, ready } = useEmpresaScopedKey(KEY)

  useEffect(() => {
    if (!ready || !empresaActivaId) {
      setCargado(false)
      return
    }
    const base = defaultParaEmpresa(empresaActivaId)
    try {
      const raw = localStorage.getItem(key)
      setEmpresa(raw ? { ...base, ...JSON.parse(raw) as Empresa, id: empresaActivaId } : base)
    } catch {
      setEmpresa(base)
    }
    setCargado(true)
  }, [key, ready, empresaActivaId])

  function guardar(data: Empresa) {
    const conTimestamp: Empresa = { ...data, id: empresaActivaId ?? data.id, actualizadoEn: new Date().toISOString() }
    setEmpresa(conTimestamp)
    try { localStorage.setItem(key, JSON.stringify(conTimestamp)) } catch { /* ignore */ }
    // Mantiene el nombre/logo visibles en el selector de empresas (Sidebar)
    // sincronizados con lo que se guarda aquí, sin que el usuario tenga que
    // repetir el dato en dos lugares distintos.
    if (empresaActivaId) actualizarResumen(empresaActivaId, { nombre: conTimestamp.nombre, logo: conTimestamp.logo })
  }

  return <Ctx.Provider value={{ empresa, cargado, guardar }}>{children}</Ctx.Provider>
}

export const useEmpresa = () => useContext(Ctx)
