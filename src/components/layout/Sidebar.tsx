'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  UserMinus,
  TrendingUp,
  Users,
  Calculator,
  Gift,
  CalendarDays,
  FileBarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  HandCoins,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/empleados',       icon: Users,           label: 'Empleados' },
  { href: '/nomina',          icon: Calculator,      label: 'Procesar Nómina' },
  { href: '/regalia-pascual', icon: Gift,            label: 'Regalía Pascual' },
  { href: '/vacaciones',      icon: CalendarDays,    label: 'Vacaciones' },
  { href: '/prestamos',       icon: HandCoins,       label: 'Préstamos' },
  { href: '/liquidacion',     icon: UserMinus,       label: 'Liquidación' },
  { href: '/aumentos',        icon: TrendingUp,      label: 'Aumentos Salariales' },
  { href: '/reportes',        icon: FileBarChart2,   label: 'Reportería' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    if (localStorage.getItem('cielo-sidebar') === '1') setCollapsed(true)
  }, [])

  const toggle = () =>
    setCollapsed(v => {
      localStorage.setItem('cielo-sidebar', v ? '0' : '1')
      return !v
    })

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  // Avoid hydration flash — render expanded until client mounts
  const c = mounted && collapsed

  return (
    <aside
      className={cn(
        'hidden md:flex h-screen flex-col bg-white dark:bg-[#141722] shrink-0',
        'border-r border-zinc-200 dark:border-[#252840]',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        c ? 'w-[68px]' : 'w-60',
      )}
    >
      {/* ── Logo / Brand ─────────────────────────────────────────── */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-zinc-200 dark:border-[#252840]',
          c ? 'flex-col justify-center gap-1.5 px-0' : 'px-4 gap-3',
        )}
      >
        {/* Isotipo */}
        <div
          className={cn(
            'flex items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40 shrink-0',
            c ? 'h-9 w-9' : 'h-8 w-8',
          )}
        >
          <svg
            viewBox="0 0 32 32"
            className={cn('fill-none', c ? 'h-5 w-5' : 'h-[18px] w-[18px]')}
            aria-hidden="true"
          >
            <path
              d="M9 22a5 5 0 01-.9-9.9 7 7 0 0113.4-1.1H22a4 4 0 010 8H9z"
              className="fill-[#1B2980] dark:fill-indigo-400"
            />
            <path
              d="M14 15.5a2.5 2.5 0 015 0"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
              className="dark:stroke-[#141722]"
            />
          </svg>
        </div>

        {/* Wordmark — hidden when collapsed */}
        {!c && (
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <span className="text-sm font-bold tracking-tight text-[#1B2980] dark:text-white truncate">
              Cielo <span className="font-light">Cloud</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Nómina
            </span>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          title={c ? 'Expandir menú' : 'Colapsar menú'}
          className={cn(
            'flex items-center justify-center rounded-lg transition-colors',
            'text-zinc-400 hover:text-[#1B2980] hover:bg-[#eef0fb]',
            'dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30',
            c ? 'h-5 w-5' : 'h-7 w-7 shrink-0',
          )}
        >
          {c
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft  className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Nuevo empleado ───────────────────────────────────────── */}
      <div
        className={cn(
          'border-b border-zinc-200 dark:border-[#252840]',
          c ? 'flex justify-center px-0 py-3' : 'px-3 py-3',
        )}
      >
        {c ? (
          <button
            onClick={() => router.push('/empleados?nuevo=1')}
            title="Nuevo empleado"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-300 dark:border-[#2e3355] text-zinc-500 dark:text-zinc-400 hover:border-[#1B2980] hover:text-[#1B2980] dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => router.push('/empleados?nuevo=1')}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-zinc-300 dark:border-[#2e3355] py-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:border-[#1B2980] hover:text-[#1B2980] dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={c ? item.label : undefined}
              className={cn(
                'flex items-center py-2.5 text-sm transition-colors border-l-[3px]',
                c ? 'justify-center px-0' : 'gap-3 px-4',
                active
                  ? 'bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400 font-semibold border-[#1B2980] dark:border-indigo-500'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-100 border-transparent',
              )}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active
                    ? 'text-[#1B2980] dark:text-indigo-400'
                    : 'text-zinc-400 dark:text-zinc-600',
                )}
              />
              {!c && (
                <>
                  <span className="flex-1 leading-none">{item.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-[#2e3355]" />
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="border-t border-zinc-200 dark:border-[#252840] py-1">
        <Link
          href="/configuracion"
          title={c ? 'Configuración' : undefined}
          className={cn(
            'flex items-center py-2.5 text-sm transition-colors border-l-[3px]',
            c ? 'justify-center px-0' : 'gap-3 px-4',
            isActive('/configuracion')
              ? 'bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400 font-semibold border-[#1B2980] dark:border-indigo-500'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] hover:text-zinc-900 dark:hover:text-zinc-100 border-transparent',
          )}
        >
          <Settings
            className={cn(
              'h-4 w-4 shrink-0',
              isActive('/configuracion')
                ? 'text-[#1B2980] dark:text-indigo-400'
                : 'text-zinc-400 dark:text-zinc-600',
            )}
          />
          {!c && (
            <>
              <span className="flex-1">Configuración</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 dark:text-[#2e3355]" />
            </>
          )}
        </Link>

        {/* User profile */}
        <div
          className={cn(
            'flex items-center py-2.5',
            c ? 'justify-center px-0' : 'gap-2.5 px-4',
          )}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: '#1B2980' }}
          >
            A
          </div>
          {!c && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Administrador
              </p>
              <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                admin@cielocloud.do
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
