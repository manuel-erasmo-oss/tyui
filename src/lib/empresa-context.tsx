'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empresa } from '@/types'

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setEmpresa({ ...DEFAULT, ...JSON.parse(raw) as Empresa })
    } catch { /* ignore */ }
    setCargado(true)
  }, [])

  function guardar(data: Empresa) {
    setEmpresa(data)
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ empresa, cargado, guardar }}>{children}</Ctx.Provider>
}

export const useEmpresa = () => useContext(Ctx)
