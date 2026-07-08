'use client'

import { useState, useEffect, useRef } from 'react'
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
  ChevronsUpDown,
  HandCoins,
  Percent,
  FileClock,
  BarChart2,
  Landmark,
  LogOut,
  Building2,
  Check,
  Plus,
  X,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth, type CuentaVinculada } from '@/lib/auth-context'
import { firebaseAuthMsg } from '@/lib/firebase-errors'

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

// Lee el nombre de empresa guardado para OTRA cuenta vinculada, directo de
// localStorage — sin pasar por React ni "cambiar" de cuenta de verdad, solo
// para poder mostrar algo mejor que el correo en la lista del selector.
function nombreEmpresaDe(uid: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`cielo-empresa::${uid}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { nombre?: string }
    return parsed.nombre || null
  } catch {
    return null
  }
}

const INPUT_SW = 'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10 transition-colors'

type ModoAgregar = 'elegir' | 'login' | 'registro'

function CuentaSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, cuentasVinculadas, cuentaActivaAppName, cambiarCuenta, quitarCuenta, agregarCuentaLogin, agregarCuentaRegistro } = useAuth()
  const [open, setOpen] = useState(false)
  const [agregando, setAgregando] = useState<ModoAgregar | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function cerrar() {
    setOpen(false)
    setAgregando(null)
    setEmail(''); setPassword(''); setNombre(''); setShowPwd(false); setError(''); setLoading(false)
  }

  // La cuenta activa puede no estar todavía en `cuentasVinculadas` (caso de
  // siempre — una sola cuenta, nunca se usó "agregar empresa") — se arma una
  // fila para ella igual, usando `user` directo.
  const activaComoFila: CuentaVinculada | null = user
    ? { appName: cuentaActivaAppName, uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL }
    : null
  const filas: CuentaVinculada[] = cuentasVinculadas.some(c => c.appName === cuentaActivaAppName)
    ? cuentasVinculadas
    : activaComoFila ? [activaComoFila, ...cuentasVinculadas] : cuentasVinculadas

  const activa = filas.find(c => c.appName === cuentaActivaAppName) ?? null
  const nombreActivo = (activa && nombreEmpresaDe(activa.uid)) || activa?.displayName || activa?.email || 'Mi cuenta'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await agregarCuentaLogin(email, password)
      cerrar()
    } catch (err: unknown) {
      setError(firebaseAuthMsg((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setError(''); setLoading(true)
    try {
      await agregarCuentaRegistro(email, password, nombre.trim())
      cerrar()
    } catch (err: unknown) {
      setError(firebaseAuthMsg((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative border-b border-zinc-200 dark:border-[#252840] p-2">
      <button
        onClick={() => setOpen(v => !v)}
        title={collapsed ? nombreActivo : undefined}
        className={cn(
          'flex w-full items-center rounded-lg py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef0fb] dark:bg-indigo-950/40 text-[10px] font-bold text-[#1B2980] dark:text-indigo-400">
          {activa?.photoURL ? <img src={activa.photoURL} alt="" className="h-full w-full object-cover" /> : nombreActivo[0]?.toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{nombreActivo}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {filas.length > 1 ? `${filas.length} empresas` : 'Cambiar de empresa'}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 top-full mt-1 w-72 overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-lg shadow-zinc-200/60 dark:shadow-none',
            collapsed ? 'left-full ml-2' : 'left-2',
          )}
        >
          {/* ── Lista de cuentas vinculadas ─────────────────────────── */}
          {agregando === null && (
            <>
              <div className="max-h-64 overflow-y-auto py-1">
                {filas.map(c => {
                  const nombreFila = nombreEmpresaDe(c.uid) || c.displayName || c.email || 'Sin nombre'
                  return (
                    <div key={c.appName} className="group flex items-center gap-1 px-2">
                      <button
                        onClick={() => { cambiarCuenta(c.appName); cerrar() }}
                        className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-[#1a1d2e] text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
                          {c.photoURL ? <img src={c.photoURL} alt="" className="h-full w-full object-cover" /> : nombreFila[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-zinc-700 dark:text-zinc-300">{nombreFila}</p>
                          {c.email && <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{c.email}</p>}
                        </div>
                        {c.appName === cuentaActivaAppName && <Check className="h-3.5 w-3.5 shrink-0 text-[#1B2980] dark:text-indigo-400" />}
                      </button>
                      {filas.length > 1 && (
                        <button
                          onClick={() => quitarCuenta(c.appName)}
                          title="Quitar de este dispositivo"
                          className="shrink-0 rounded-lg p-1.5 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:text-zinc-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-zinc-100 dark:border-[#1d2035] p-1">
                <button
                  onClick={() => setAgregando('elegir')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1B2980] dark:text-indigo-400 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/30 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar empresa
                </button>
              </div>
            </>
          )}

          {/* ── Elegir: iniciar sesión o crear cuenta ───────────────── */}
          {agregando === 'elegir' && (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <button onClick={() => setAgregando(null)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Agregar una empresa</p>
              </div>
              <p className="mb-3 px-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Cada empresa es su propia cuenta de Cielo Cloud, con su propio correo — completamente independiente.
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={() => { setAgregando('login'); setError('') }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-[#1B2980]/40 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/20 transition-colors"
                >
                  Iniciar sesión en una cuenta existente
                </button>
                <button
                  onClick={() => { setAgregando('registro'); setError('') }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] px-3 py-2.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-[#1B2980]/40 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/20 transition-colors"
                >
                  Crear una cuenta nueva
                </button>
              </div>
            </div>
          )}

          {/* ── Iniciar sesión en cuenta existente ──────────────────── */}
          {agregando === 'login' && (
            <form onSubmit={handleLogin} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <button type="button" onClick={() => setAgregando('elegir')} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Iniciar sesión</p>
              </div>
              <div className="space-y-2">
                <input type="email" placeholder="correo@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus className={INPUT_SW} />
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required className={INPUT_SW + ' pr-9'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {error && (
                  <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-2">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 py-2 text-xs font-semibold text-white transition-colors">
                  {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>
              </div>
            </form>
          )}

          {/* ── Crear cuenta nueva ───────────────────────────────────── */}
          {agregando === 'registro' && (
            <form onSubmit={handleRegistro} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <button type="button" onClick={() => setAgregando('elegir')} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Crear cuenta nueva</p>
              </div>
              <div className="space-y-2">
                <input type="text" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus className={INPUT_SW} />
                <input type="email" placeholder="correo@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required className={INPUT_SW} />
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required className={INPUT_SW + ' pr-9'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {error && (
                  <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-2">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 py-2 text-xs font-semibold text-white transition-colors">
                  {loading ? 'Creando cuenta…' : 'Crear cuenta y verificar correo'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

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

      {/* ── Selector de empresa/cuenta ───────────────────────────── */}
      <CuentaSwitcher collapsed={c} />

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
