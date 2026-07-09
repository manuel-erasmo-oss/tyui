'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2, User, Mail, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { firebaseAuthMsg } from '@/lib/firebase-errors'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { AuthBrandPanel, MobileLogo } from '@/components/auth/AuthBrandPanel'

const INPUT = 'w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] pl-11 pr-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-[#1B2980]/8 dark:focus:ring-indigo-500/10 transition-all'
const FIELD_ICON = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-600'

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

  return (
    <div className="flex min-h-full w-full">

      <AuthBrandPanel
        eyebrow="Empieza hoy, gratis"
        title="Tu nómina dominicana en minutos"
        description="Registra tu empresa, agrega empleados y procesa tu primera nómina hoy — con todos los cálculos legales incluidos."
        features={[
          'Configuración en menos de 5 minutos',
          'Cálculos TSS e ISR sin errores',
          'Acceso desde cualquier dispositivo',
          'Soporte para pymes de todos los tamaños',
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

        <div className="relative w-full max-w-[420px]">
          <MobileLogo />

          <div className="animate-auth-card-in rounded-3xl border border-zinc-100 dark:border-[#1a1d2e] bg-white dark:bg-[#141722] p-8 sm:p-10 shadow-xl shadow-zinc-200/60 dark:shadow-black/30">
            {success ? (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">¡Cuenta creada!</h2>
                <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                  Te enviamos un correo de verificación. Ábrelo para activar tu cuenta.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1B2980] dark:text-indigo-400">
                  Cielo Cloud · Nómina
                </p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Crea tu cuenta</h2>
                <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Es gratis, siempre.</p>

                {/* Google first */}
                <button
                  onClick={handleGoogle}
                  disabled={gLoading}
                  className="mt-7 w-full flex items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] hover:bg-zinc-50 dark:hover:bg-[#20243a] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-all"
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
                    <div className="relative">
                      <User className={FIELD_ICON} />
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
                  </div>

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
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className={FIELD_ICON} />
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
                      <Lock className={FIELD_ICON} />
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
                    className="w-full rounded-xl bg-gradient-to-r from-[#1B2980] to-[#2f3fa8] hover:shadow-lg hover:shadow-[#1B2980]/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white font-semibold py-3 text-sm transition-all mt-1"
                  >
                    {loading ? 'Creando cuenta…' : 'Crear cuenta'}
                  </button>

                  <p className="text-[10px] text-center text-zinc-400 dark:text-zinc-600 leading-relaxed">
                    Al registrarte aceptas que esta es una herramienta de gestión interna y no constituye asesoría legal ni contable certificada.
                  </p>
                </form>
              </>
            )}
          </div>

          {!success && (
            <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-[#1B2980] dark:text-indigo-400 font-semibold hover:underline">
                Inicia sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
