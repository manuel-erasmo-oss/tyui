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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { href: '/',          icon: LayoutDashboard, label: 'Inicio' },
      { href: '/empleados', icon: Users,            label: 'Empleados' },
    ],
  },
  {
    label: 'Nómina',
    items: [
      { href: '/nomina',          icon: Calculator,   label: 'Procesar Nómina' },
      { href: '/regalia-pascual', icon: Gift,         label: 'Regalía Pascual' },
      { href: '/vacaciones',      icon: CalendarDays, label: 'Vacaciones' },
    ],
  },
  {
    label: 'Informes',
    items: [
      { href: '/reportes', icon: FileBarChart2, label: 'Reportes TSS / ISR' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className="hidden md:flex h-screen w-60 flex-col bg-white border-r border-zinc-200 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-zinc-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-900 leading-none">NominaRD</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">República Dominicana</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                        active
                          ? 'bg-teal-50 text-teal-700 font-medium'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-teal-600' : 'text-zinc-400'
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-100 px-3 py-3 space-y-0.5">
        <Link
          href="/configuracion"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
            isActive('/configuracion')
              ? 'bg-teal-50 text-teal-700 font-medium'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          )}
        >
          <Settings
            className={cn(
              'h-4 w-4 shrink-0',
              isActive('/configuracion') ? 'text-teal-600' : 'text-zinc-400'
            )}
          />
          <span>Configuración</span>
        </Link>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
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
