'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empresa } from '@/types'
import { useUserScopedKey } from './user-scoped-key'

const KEY = 'cielo-empresa'

const DEFAULT: Empresa = {
  nombre: '', rnc: '', direccion: '', ciudad: '',
  telefono: '', email: '', representanteLegal: '',
  modalidadNomina: 'mensual' as const,
}

interface EmpresaCtx {
  empresa: Empresa
  cargado: boolean
  guardar: (data: Empresa) => void
}

const Ctx = createContext<EmpresaCtx>({ empresa: DEFAULT, cargado: false, guardar: () => {} })

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa>(DEFAULT)
  const [cargado, setCargado] = useState(false)
  const { key, ready } = useUserScopedKey(KEY)

  useEffect(() => {
    if (!ready) {
      setCargado(false)
      return
    }
    try {
      const raw = localStorage.getItem(key)
      setEmpresa(raw ? { ...DEFAULT, ...JSON.parse(raw) as Empresa } : DEFAULT)
    } catch {
      setEmpresa(DEFAULT)
    }
    setCargado(true)
  }, [key, ready])

  function guardar(data: Empresa) {
    const conTimestamp = { ...data, actualizadoEn: new Date().toISOString() }
    setEmpresa(conTimestamp)
    try { localStorage.setItem(key, JSON.stringify(conTimestamp)) } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ empresa, cargado, guardar }}>{children}</Ctx.Provider>
}

export const useEmpresa = () => useContext(Ctx)
