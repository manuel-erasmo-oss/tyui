'use client'

import { Bell, Search, HelpCircle, LayoutGrid } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-zinc-900 leading-none">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar..."
            className="h-8 w-48 rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-all"
          />
        </div>

        {actions && <div className="ml-1">{actions}</div>}

        <button className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button className="relative rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>
        <button className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
          <LayoutGrid className="h-4 w-4" />
        </button>
        <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
          A
        </div>
      </div>
    </header>
  )
}
