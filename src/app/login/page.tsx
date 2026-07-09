'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Mail, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { firebaseAuthMsg } from '@/lib/firebase-errors'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { AuthBrandPanel, MobileLogo } from '@/components/auth/AuthBrandPanel'

const INPUT = 'w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] pl-11 pr-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-[#1B2980]/8 dark:focus:ring-indigo-500/10 transition-all'
const FIELD_ICON = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-600'

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
      setError(firebaseAuthMsg((err as { code?: string }).code ?? ''))
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
        setError(firebaseAuthMsg(code))
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

      <AuthBrandPanel
        eyebrow="Para pymes dominicanas"
        title="Gestión de nómina con precisión legal"
        description="Cálculos automáticos de TSS, ISR, regalía pascual, vacaciones y cesantía — siempre alineados con el Código de Trabajo vigente."
        features={[
          'TSS e ISR calculados automáticamente',
          'Nómina mensual y quincenal',
          'Comprobantes y reportes PDF',
          'Actualizado a la legislación 2026',
          'Préstamos, liquidaciones y más',
        ]}
      />

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-12 bg-zinc-50 dark:bg-[#0d0f1a]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 10%, rgba(27,41,128,0.06), transparent 45%), radial-gradient(circle at 85% 90%, rgba(27,41,128,0.05), transparent 45%)',
          }}
        />

        <div className="relative w-full max-w-[400px]">
          <MobileLogo />

          <div className="animate-auth-card-in rounded-3xl border border-zinc-100 dark:border-[#1a1d2e] bg-white dark:bg-[#141722] p-8 sm:p-10 shadow-xl shadow-zinc-200/60 dark:shadow-black/30">
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
                    <div className="relative">
                      <Mail className={FIELD_ICON} />
                      <input
                        type="email"
                        placeholder="tu@correo.com"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        required
                        className={INPUT}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={resetLoad}
                      className="w-full rounded-xl bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] hover:shadow-lg hover:shadow-[#1B2980]/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white font-semibold py-3 text-sm transition-all"
                    >
                      {resetLoad ? 'Enviando…' : 'Enviar enlace'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ── Login mode ── */
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1B2980] dark:text-indigo-400">
                  Cielo Cloud · Nómina
                </p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Bienvenido de vuelta</h2>
                <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Inicia sesión en tu cuenta</p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className={FIELD_ICON} />
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
                      <Lock className={FIELD_ICON} />
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
                    className="w-full rounded-xl bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] hover:shadow-lg hover:shadow-[#1B2980]/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white font-semibold py-3 text-sm transition-all mt-2"
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
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#20243a] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-all"
                >
                  <GoogleIcon />
                  {gLoading ? 'Conectando…' : 'Continuar con Google'}
                </button>
              </>
            )}
          </div>

          {!resetMode && (
            <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              ¿No tienes cuenta?{' '}
              <Link href="/registro" className="text-[#1B2980] dark:text-indigo-400 font-semibold hover:underline">
                Regístrate gratis
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
