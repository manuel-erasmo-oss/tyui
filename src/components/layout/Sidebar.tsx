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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { href: '/',          icon: LayoutDashboard, label: 'Dashboard' },
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
    <aside className="flex h-screen w-64 flex-col bg-zinc-950 text-zinc-400 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">NominaRD</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Gestión de Personal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
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
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'hover:bg-zinc-800 hover:text-zinc-100'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3">
        <Link
          href="/configuracion"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800 hover:text-zinc-100 transition-all"
        >
          <Settings className="h-4 w-4" />
          <span>Configuración</span>
        </Link>
        <div className="mt-3 flex items-center gap-3 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-300">Administrador</p>
            <p className="truncate text-[11px] text-zinc-600">admin@empresa.com</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
