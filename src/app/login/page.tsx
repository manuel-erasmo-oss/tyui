'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function firebaseMsg(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Restablece tu contraseña o intenta más tarde.'
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.'
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada. Contacta soporte.'
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.'
    default:
      return 'Ocurrió un error inesperado. Intenta de nuevo.'
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const INPUT = 'w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10 transition-colors'

export default function LoginPage() {
  const { signIn, signInGoogle, resetPassword } = useAuth()
  const router = useRouter()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [gLoading, setGLoading]   = useState(false)
  const [error, setError]         = useState('')

  // Reset password flow
  const [resetMode, setResetMode]   = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetDone, setResetDone]   = useState(false)
  const [resetLoad, setResetLoad]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      router.replace('/')
    } catch (err: unknown) {
      setError(firebaseMsg((err as { code?: string }).code ?? ''))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGLoading(true)
    try {
      await signInGoogle()
      router.replace('/')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(firebaseMsg(code))
      }
    } finally {
      setGLoading(false)
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setResetLoad(true)
    try {
      await resetPassword(resetEmail)
      setResetDone(true)
    } catch {
      // show success anyway to avoid email enumeration
      setResetDone(true)
    } finally {
      setResetLoad(false)
    }
  }

  return (
    <div className="flex min-h-full w-full">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col bg-[#1B2980] relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <svg viewBox="0 0 32 32" fill="none" className="h-10 w-10 shrink-0">
              <circle cx="16" cy="16" r="9" strokeWidth="5.5"
                strokeDasharray="47.12 9.43" strokeLinecap="round"
                transform="rotate(30 16 16)" stroke="white" />
              <circle cx="16" cy="16" r="2.8" fill="white" />
            </svg>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white">Cielo</span>
                <span className="text-xl font-extralight text-white/60">Cloud</span>
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">Nómina</span>
            </div>
          </div>

          {/* Main copy */}
          <div className="mt-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
              Para pymes dominicanas
            </p>
            <h1 className="text-3xl font-bold text-white leading-tight">
              Gestión de nómina con precisión legal
            </h1>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              Cálculos automáticos de TSS, ISR, regalía pascual, vacaciones y cesantía — siempre alineados con el Código de Trabajo vigente.
            </p>

            <div className="mt-9 space-y-3.5">
              {[
                'TSS e ISR calculados automáticamente',
                'Nómina mensual y quincenal',
                'Comprobantes y reportes PDF',
                'Actualizado a la legislación 2025',
                'Préstamos, liquidaciones y más',
              ].map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-white/40 shrink-0" />
                  <span className="text-sm text-white/65">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Ley 16-92 · Ley 87-01 · Ley 11-92 · República Dominicana
          </p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-[#0d0f1a]">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9 shrink-0">
              <circle cx="16" cy="16" r="9" strokeWidth="5.5"
                strokeDasharray="47.12 9.43" strokeLinecap="round"
                transform="rotate(30 16 16)" className="stroke-[#1B2980] dark:stroke-indigo-400" />
              <circle cx="16" cy="16" r="2.8" className="fill-[#1B2980] dark:fill-indigo-400" />
            </svg>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-zinc-900 dark:text-white">Cielo</span>
                <span className="text-lg font-extralight text-zinc-400 dark:text-zinc-400">Cloud</span>
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Nómina</span>
            </div>
          </div>

          {/* ── Reset password mode ── */}
          {resetMode ? (
            <div>
              <button
                onClick={() => { setResetMode(false); setResetDone(false); setResetEmail('') }}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
              </button>

              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Restablecer contraseña</h2>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>

              {resetDone ? (
                <div className="mt-8 flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Si ese correo está registrado, recibirás el enlace en unos minutos. Revisa también tu carpeta de spam.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReset} className="mt-8 space-y-4">
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    className={INPUT}
                  />
                  <button
                    type="submit"
                    disabled={resetLoad}
                    className="w-full rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors"
                  >
                    {resetLoad ? 'Enviando…' : 'Enviar enlace'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ── Login mode ── */
            <>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Bienvenido de vuelta</h2>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Inicia sesión en tu cuenta</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={INPUT}
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetMode(true)}
                      className="text-xs text-[#1B2980] dark:text-indigo-400 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={INPUT + ' pr-11'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-3">
                    <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors mt-2"
                >
                  {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
                <span className="text-xs text-zinc-400 dark:text-zinc-600">o continúa con</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={gLoading}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] disabled:opacity-60 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <GoogleIcon />
                {gLoading ? 'Conectando…' : 'Continuar con Google'}
              </button>

              <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                ¿No tienes cuenta?{' '}
                <Link href="/registro" className="text-[#1B2980] dark:text-indigo-400 font-semibold hover:underline">
                  Regístrate gratis
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
