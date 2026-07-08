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
  HandCoins,
  Percent,
  FileClock,
  BarChart2,
  Landmark,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'

const NAV_ITEMS = [
  { href: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/empleados',       icon: Users,           label: 'Empleados' },
  { href: '/nomina',          icon: Calculator,      label: 'Procesar Nómina' },
  { href: '/regalia-pascual', icon: Gift,            label: 'Regalía Pascual' },
  { href: '/vacaciones',      icon: CalendarDays,    label: 'Vacaciones' },
  { href: '/prestamos',       icon: HandCoins,       label: 'Préstamos' },
  { href: '/licencias',       icon: FileClock,       label: 'Licencias' },
  { href: '/bonificacion',    icon: Percent,         label: 'Bonificación Utilidades' },
  { href: '/retribuciones-complementarias', icon: Landmark, label: 'Retribuciones Complementarias' },
  { href: '/liquidacion',     icon: UserMinus,       label: 'Liquidación' },
  { href: '/aumentos',        icon: TrendingUp,      label: 'Aumentos Salariales' },
  { href: '/bandas-salariales', icon: BarChart2,     label: 'Bandas Salariales' },
  { href: '/reportes',        icon: FileBarChart2,   label: 'Reportería' },
]

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout } = useAuth()

  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

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
          'flex h-[80px] shrink-0 items-center border-b border-zinc-200 dark:border-[#252840]',
          c ? 'flex-col justify-center gap-2.5 px-0' : 'px-5 gap-4',
        )}
      >
        {/* Isotipo — arco geométrico 300° */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          aria-label="Cielo Cloud"
          className={cn('shrink-0', c ? 'h-[46px] w-[46px]' : 'h-10 w-10')}
        >
          {/*
            Arco grueso: círculo r=9, strokeWidth=5.5
            300° de arco · gap=60° con terminaciones redondeadas
            rotate(30°) → apertura centrada al Este (derecha)
            C = 2π×9 ≈ 56.55 · arco300° ≈ 47.12 · gap ≈ 9.43
          */}
          <circle
            cx="16" cy="16" r="9"
            strokeWidth="5.5"
            strokeDasharray="47.12 9.43"
            strokeLinecap="round"
            transform="rotate(30 16 16)"
            className="stroke-[#1B2980] dark:stroke-white"
          />
          {/* Punto interior */}
          <circle cx="16" cy="16" r="2.8" className="fill-[#1B2980] dark:fill-white" />
        </svg>

        {/* Wordmark — visible solo expandido */}
        {!c && (
          <div className="flex flex-col min-w-0 flex-1 gap-[3px]">
            {/* Nombre de marca con contraste de peso */}
            <div className="flex items-baseline gap-[5px]">
              <span className="text-[16px] font-bold tracking-[-0.02em] text-zinc-900 dark:text-white leading-none">
                Cielo
              </span>
              <span className="text-[16px] font-extralight tracking-[-0.01em] text-zinc-400 dark:text-zinc-300 leading-none">
                Cloud
              </span>
            </div>
            {/* Descriptor en versalitas espaciadas */}
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500 leading-none">
              Nómina
            </span>
          </div>
        )}

        {/* Toggle */}
        <button
          onClick={toggle}
          title={c ? 'Expandir' : 'Colapsar'}
          className={cn(
            'flex items-center justify-center rounded-lg transition-colors shrink-0',
            'text-zinc-300 hover:text-[#1B2980] hover:bg-[#eef0fb]',
            'dark:text-zinc-600 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30',
            c ? 'h-5 w-5' : 'h-6 w-6',
          )}
        >
          {c
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft  className="h-3.5 w-3.5" />}
        </button>
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

        {/* User profile + logout */}
        <div
          className={cn(
            'flex items-center py-2.5',
            c ? 'flex-col gap-1.5 px-0' : 'gap-2.5 px-4',
          )}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: '#1B2980' }}
          >
            {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          {!c && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {user?.displayName ?? 'Mi cuenta'}
              </p>
              <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                {user?.email ?? ''}
              </p>
            </div>
          )}
          {c ? (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 dark:text-zinc-600 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
