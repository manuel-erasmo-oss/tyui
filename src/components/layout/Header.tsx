'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HelpCircle, Menu, LogOut, Settings, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useAuth } from '@/lib/auth-context'
import { useCommandPalette } from '@/lib/command-palette-context'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

function UserMenu() {
  const { user, logout } = useAuth()
  const router           = useRouter()
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleLogout() {
    setOpen(false)
    await logout()
    router.replace('/login')
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B2980] text-xs font-bold text-white hover:bg-[#151f66] transition-colors shrink-0"
        title="Mi cuenta"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-lg shadow-zinc-200/60 dark:shadow-none overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-[#1d2035]">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {user?.displayName ?? 'Mi cuenta'}
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
              {user?.email ?? ''}
            </p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <Link
              href="/configuracion"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 shrink-0" />
              Configuración
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BuscarTrigger() {
  const { open } = useCommandPalette()
  return (
    <button
      onClick={open}
      className="hidden md:flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] px-2.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-[#33395a] hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="w-24 text-left">Buscar…</span>
      <kbd className="rounded border border-zinc-200 dark:border-[#33395a] bg-white dark:bg-[#141722] px-1.5 py-0.5 text-[10px] font-semibold">
        ⌘K
      </kbd>
    </button>
  )
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4">
      {/* Left */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <button className="md:hidden rounded-lg p-1 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] text-zinc-500 dark:text-zinc-400 transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">{title}</span>
          {subtitle && (
            <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400 hidden sm:inline">{subtitle}</span>
          )}
        </div>
        {actions && <div className="ml-3 shrink-0">{actions}</div>}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <BuscarTrigger />
        <Link
          href="/configuracion"
          className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          Ayuda
        </Link>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
