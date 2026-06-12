'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calculator,
  Gift,
  CalendarDays,
  FileBarChart2,
  Settings,
  Building2,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',                 icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/empleados',        icon: Users,           label: 'Empleados' },
  { href: '/nomina',           icon: Calculator,      label: 'Procesar Nómina' },
  { href: '/regalia-pascual',  icon: Gift,            label: 'Regalía Pascual' },
  { href: '/vacaciones',       icon: CalendarDays,    label: 'Vacaciones' },
  { href: '/reportes',         icon: FileBarChart2,   label: 'Reportes TSS / ISR' },
]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className="hidden md:flex h-screen w-56 flex-col bg-zinc-100 shrink-0 border-r border-zinc-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-zinc-200 bg-zinc-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
          <Building2 className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-zinc-900">NominaRD</span>
      </div>

      {/* + Nuevo */}
      <div className="px-3 py-3 border-b border-zinc-200">
        <button className="flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-zinc-400 py-1.5 text-sm font-semibold text-zinc-600 hover:border-zinc-500 hover:bg-zinc-200 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-white text-zinc-900 font-semibold border-l-[3px] border-teal-600'
                  : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border-l-[3px] border-transparent'
              )}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-teal-600' : 'text-zinc-400'
                )}
              />
              <span className="flex-1 leading-none">{item.label}</span>
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  active ? 'text-zinc-400' : 'text-zinc-300'
                )}
              />
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 py-1">
        <Link
          href="/configuracion"
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
            isActive('/configuracion')
              ? 'bg-white text-zinc-900 font-semibold border-l-[3px] border-teal-600'
              : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border-l-[3px] border-transparent'
          )}
        >
          <Settings
            className={cn(
              'h-4 w-4 shrink-0',
              isActive('/configuracion') ? 'text-teal-600' : 'text-zinc-400'
            )}
          />
          <span className="flex-1">Ajustes del menú</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
        </Link>

        {/* User */}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-700">Administrador</p>
            <p className="truncate text-[10px] text-zinc-400">admin@empresa.com</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
