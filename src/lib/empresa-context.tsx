'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Empresa } from '@/types'

const KEY = 'cielo-empresa'

const DEFAULT: Empresa = {
  nombre: '', rnc: '', direccion: '', ciudad: '',
  telefono: '', email: '', representanteLegal: '',
}

interface EmpresaCtx {
  empresa: Empresa
  guardar: (data: Empresa) => void
}

const Ctx = createContext<EmpresaCtx>({ empresa: DEFAULT, guardar: () => {} })

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa>(DEFAULT)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setEmpresa(JSON.parse(raw) as Empresa)
    } catch { /* ignore */ }
  }, [])

  function guardar(data: Empresa) {
    setEmpresa(data)
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ empresa, guardar }}>{children}</Ctx.Provider>
}

export const useEmpresa = () => useContext(Ctx)
