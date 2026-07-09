'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Moon, Sun, LogOut, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { NAV_ITEMS, CONFIGURACION_ITEM, type NavItem } from '@/lib/nav-items'
import { useTheme } from '@/lib/theme'
import { useAuth } from '@/lib/auth-context'

interface Entry {
  id: string
  label: string
  hint?: string
  icon: NavItem['icon']
  section: 'Navegación' | 'Acciones'
  run: () => void
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { theme, toggle: toggleTheme } = useTheme()
  const { logout } = useAuth()

  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const entries: Entry[] = useMemo(() => {
    const navegacion: Entry[] = [...NAV_ITEMS, CONFIGURACION_ITEM].map(item => ({
      id: `nav-${item.href}`,
      label: item.label,
      hint: item.keywords,
      icon: item.icon,
      section: 'Navegación',
      run: () => router.push(item.href),
    }))

    const acciones: Entry[] = [
      {
        id: 'toggle-theme',
        label: theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
        icon: theme === 'dark' ? Sun : Moon,
        section: 'Acciones',
        run: () => toggleTheme(),
      },
      {
        id: 'logout',
        label: 'Cerrar sesión',
        icon: LogOut,
        section: 'Acciones',
        run: () => { logout(); router.replace('/login') },
      },
    ]

    return [...navegacion, ...acciones]
  }, [router, theme, toggleTheme, logout])

  const filtered = useMemo(() => {
    const q = normalizar(query.trim())
    if (!q) return entries
    return entries.filter(e =>
      normalizar(e.label).includes(q) || (e.hint && normalizar(e.hint).includes(q)),
    )
  }, [entries, query])

  useEffect(() => { setSelected(0) }, [query, open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      // Esperar al frame siguiente — el input recién se monta con el modal.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function activar(entry: Entry) {
    entry.run()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selected]) activar(filtered[selected])
    }
  }

  if (!open) return null

  let runningIdx = -1

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="animate-backdrop-in absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="animate-modal-in relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-2xl shadow-zinc-900/20">
        <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-[#1d2035] px-4">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-600" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulos, acciones…"
            className="w-full bg-transparent py-3.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="hidden sm:block shrink-0 rounded-md border border-zinc-200 dark:border-[#252840] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-600">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          )}

          {(['Navegación', 'Acciones'] as const).map(section => {
            const items = filtered.filter(e => e.section === section)
            if (items.length === 0) return null
            return (
              <div key={section} className="px-2 pb-1">
                <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                  {section}
                </p>
                {items.map(entry => {
                  runningIdx += 1
                  const idx = runningIdx
                  const active = idx === selected
                  return (
                    <button
                      key={entry.id}
                      data-idx={idx}
                      onClick={() => activar(entry)}
                      onMouseEnter={() => setSelected(idx)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <entry.icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#1B2980] dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-600'}`} />
                      <span className="flex-1 truncate font-medium">{entry.label}</span>
                      {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[#1B2980]/60 dark:text-indigo-400/60" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="hidden sm:flex items-center gap-4 border-t border-zinc-100 dark:border-[#1d2035] px-4 py-2.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-600">
          <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navegar</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> abrir</span>
          <span className="ml-auto">Cielo Cloud</span>
        </div>
      </div>
    </div>
  )
}
