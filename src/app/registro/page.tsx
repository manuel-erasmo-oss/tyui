'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function firebaseMsg(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?'
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.'
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.'
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.'
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado en Firebase. Agrégalo en Firebase Console → Authentication → Settings → Dominios autorizados.'
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite popups para este sitio e intenta de nuevo.'
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con Google no está activado. Actívalo en Firebase Console → Authentication → Sign-in method.'
    default:
      return `Error: ${code || 'desconocido'}. Intenta de nuevo o usa correo y contraseña.`
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

function PasswordStrength({ pwd }: { pwd: string }) {
  if (!pwd) return null
  const checks = [
    pwd.length >= 8,
    /[A-Z]/.test(pwd),
    /[0-9]/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
  ]
  const score = checks.filter(Boolean).length
  const color = score <= 1 ? 'bg-rose-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-yellow-500' : 'bg-emerald-500'
  const label = score <= 1 ? 'Muy débil' : score === 2 ? 'Débil' : score === 3 ? 'Buena' : 'Fuerte'
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < score ? color : 'bg-zinc-200 dark:bg-[#252840]'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${score <= 1 ? 'text-rose-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {label}
      </p>
    </div>
  )
}

export default function RegistroPage() {
  const { signUp, signInGoogle } = useAuth()
  const router = useRouter()

  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showCfm, setShowCfm]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [gLoading, setGLoading]   = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, nombre.trim())
      setSuccess(true)
      setTimeout(() => router.replace('/'), 1200)
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

  return (
    <div className="flex min-h-full w-full">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col bg-[#1B2980] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col h-full p-10">
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

          <div className="mt-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
              Empieza hoy, gratis
            </p>
            <h1 className="text-3xl font-bold text-white leading-tight">
              Tu nómina dominicana en minutos
            </h1>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              Registra tu empresa, agrega empleados y procesa tu primera nómina hoy — con todos los cálculos legales incluidos.
            </p>

            <div className="mt-9 space-y-3.5">
              {[
                'Configuración en menos de 5 minutos',
                'Cálculos TSS e ISR sin errores',
                'Acceso desde cualquier dispositivo',
                'Soporte para pymes de todos los tamaños',
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
        <div className="w-full max-w-[400px]">

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
            </div>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">¡Cuenta creada!</h2>
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">Redirigiendo al dashboard…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Crea tu cuenta</h2>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Es gratis, siempre.</p>

              {/* Google first */}
              <button
                onClick={handleGoogle}
                disabled={gLoading}
                className="mt-7 w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] disabled:opacity-60 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <GoogleIcon />
                {gLoading ? 'Conectando…' : 'Continuar con Google'}
              </button>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
                <span className="text-xs text-zinc-400 dark:text-zinc-600">o con correo</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                    autoComplete="name"
                    className={INPUT}
                  />
                </div>

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
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Mín. 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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
                  <PasswordStrength pwd={password} />
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showCfm ? 'text' : 'password'}
                      placeholder="Repite la contraseña"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={INPUT + ' pr-11'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCfm(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showCfm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1.5 text-[11px] text-rose-500">Las contraseñas no coinciden.</p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-3">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors mt-1"
                >
                  {loading ? 'Creando cuenta…' : 'Crear cuenta'}
                </button>

                <p className="text-[10px] text-center text-zinc-400 dark:text-zinc-600 leading-relaxed">
                  Al registrarte aceptas que esta es una herramienta de gestión interna y no constituye asesoría legal ni contable certificada.
                </p>
              </form>

              <p className="mt-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="text-[#1B2980] dark:text-indigo-400 font-semibold hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
