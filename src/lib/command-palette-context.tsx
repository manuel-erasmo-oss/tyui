'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { CommandPalette } from '@/components/command-palette/CommandPalette'

interface CommandPaletteCtx {
  open: () => void
  close: () => void
  toggle: () => void
}

const Ctx = createContext<CommandPaletteCtx>({ open: () => {}, close: () => {}, toggle: () => {} })

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return (
    <Ctx.Provider value={{ open, close, toggle }}>
      {children}
      <CommandPalette open={isOpen} onClose={close} />
    </Ctx.Provider>
  )
}

export const useCommandPalette = () => useContext(Ctx)
