'use client'

import { Bell, Search, HelpCircle, Settings, Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[#151f66] bg-[#1B2980] dark:bg-[#141722] dark:border-[#252840] px-4">
      {/* Left */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <button className="md:hidden rounded-lg p-1 hover:bg-white/10 text-white/70 transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <span className="text-xl font-bold tracking-tight text-white truncate">{title}</span>
          {subtitle && (
            <span className="ml-2 text-sm text-white/55 hidden sm:inline">{subtitle}</span>
          )}
        </div>
        {actions && <div className="ml-3 shrink-0">{actions}</div>}
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-0.5">
        <button className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <HelpCircle className="h-4 w-4" />
          Ayuda
        </button>
        <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <Search className="h-4 w-4" />
        </button>
        <button className="relative rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
        </button>
        <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <Settings className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <div className="ml-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold bg-white text-[#1B2980]">
          A
        </div>
      </div>
    </header>
  )
}
