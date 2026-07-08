'use client'

import { useState, FormEvent } from 'react'
import { X, ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, LogIn, UserPlus2, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { firebaseAuthMsg } from '@/lib/firebase-errors'
import { GoogleIcon } from './GoogleIcon'

const INPUT = 'w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10 transition-colors'

const FEATURES = [
  'Cada empresa con su propio correo y datos',
  'Aislamiento completo de información entre empresas',
  'Cambia entre empresas vinculadas en segundos',
  'Ideal para contadores con varios clientes',
]

function PasswordStrength({ pwd }: { pwd: string }) {
  if (!pwd) return null
  const checks = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)]
  const score = checks.filter(Boolean).length
  const color = score <= 1 ? 'bg-rose-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-yellow-500' : 'bg-emerald-500'
  const label = score <= 1 ? 'Muy débil' : score === 2 ? 'Débil' : score === 3 ? 'Buena' : 'Fuerte'
  return (
    <div className="mt-2">
      <div className="mb-1 flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? color : 'bg-zinc-200 dark:bg-[#252840]'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${score <= 1 ? 'text-rose-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {label}
      </p>
    </div>
  )
}

type Paso = 'elegir' | 'login' | 'registro'

export function AgregarCuentaModal({ onClose }: { onClose: () => void }) {
  const { agregarCuentaLogin, agregarCuentaRegistro, agregarCuentaGoogle } = useAuth()

  const [paso, setPaso] = useState<Paso>('elegir')
  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [showCfm, setShowCfm]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  function volver() {
    setPaso('elegir')
    setError('')
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await agregarCuentaLogin(email, password)
      onClose()
    } catch (err: unknown) {
      setError(firebaseAuthMsg((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  async function handleRegistro(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setError(''); setLoading(true)
    try {
      await agregarCuentaRegistro(email, password, nombre.trim())
      setSuccess(true)
      setTimeout(onClose, 1400)
    } catch (err: unknown) {
      setError(firebaseAuthMsg((err as { code?: string }).code ?? ''))
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(''); setGLoading(true)
    try {
      await agregarCuentaGoogle()
      onClose()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(firebaseAuthMsg(code))
      }
      setGLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex bg-white dark:bg-[#0d0f1a] animate-backdrop-in">
      {/* ── Panel de marca ───────────────────────────────────────── */}
      <div className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden bg-[#1B2980] lg:flex">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative z-10 flex h-full flex-col p-10">
          <div className="flex items-center gap-3.5">
            <svg viewBox="0 0 32 32" fill="none" className="h-10 w-10 shrink-0">
              <circle cx="16" cy="16" r="9" strokeWidth="5.5" strokeDasharray="47.12 9.43" strokeLinecap="round" transform="rotate(30 16 16)" stroke="white" />
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
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">Multiempresa</p>
            <h1 className="text-3xl font-bold leading-tight text-white">Agrega otra empresa a tu cuenta</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Cada empresa es su propia cuenta, completamente independiente — ideal si manejas la nómina de varios clientes.
            </p>
            <div className="mt-9 space-y-3.5">
              {FEATURES.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
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

      {/* ── Panel de formulario ──────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <button
          onClick={onClose}
          title="Cerrar"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-[#1a1d2e] dark:hover:text-zinc-200 transition-colors"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9 shrink-0">
              <circle cx="16" cy="16" r="9" strokeWidth="5.5" strokeDasharray="47.12 9.43" strokeLinecap="round" transform="rotate(30 16 16)" className="stroke-[#1B2980] dark:stroke-indigo-400" />
              <circle cx="16" cy="16" r="2.8" className="fill-[#1B2980] dark:fill-indigo-400" />
            </svg>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-zinc-900 dark:text-white">Cielo</span>
              <span className="text-lg font-extralight text-zinc-400">Cloud</span>
            </div>
          </div>

          {/* ── Paso: elegir ─────────────────────────────────────── */}
          {paso === 'elegir' && (
            <div className="animate-content-in">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Agregar empresa</h2>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">¿Cómo quieres vincularla a este dispositivo?</p>

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => setPaso('login')}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 dark:border-[#252840] p-4 text-left hover:border-[#1B2980]/40 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/20 transition-colors"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
                    <LogIn className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ya tengo una cuenta</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">Esta empresa ya usa Cielo Cloud — inicia sesión con su correo.</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  onClick={() => setPaso('registro')}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 dark:border-[#252840] p-4 text-left hover:border-[#1B2980]/40 hover:bg-[#eef0fb] dark:hover:bg-indigo-950/20 transition-colors"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fb] dark:bg-indigo-950/40 text-[#1B2980] dark:text-indigo-400">
                    <UserPlus2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Es una empresa nueva</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">Crea una cuenta nueva con su propio correo, es gratis.</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Paso: iniciar sesión ─────────────────────────────── */}
          {paso === 'login' && (
            <div className="animate-content-in">
              <button onClick={volver} className="mb-5 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Volver
              </button>

              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Con la cuenta de la empresa que quieres agregar.</p>

              <button
                onClick={handleGoogle}
                disabled={gLoading}
                className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-[#1a1d2e] disabled:opacity-60 transition-colors"
              >
                <GoogleIcon />
                {gLoading ? 'Conectando…' : 'Continuar con Google'}
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
                <span className="text-xs text-zinc-400 dark:text-zinc-600">o con correo</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Correo electrónico</label>
                  <input type="email" placeholder="empresa@correo.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" className={INPUT} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Contraseña</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className={INPUT + ' pr-11'} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="mt-2 w-full rounded-xl bg-[#1B2980] py-3 text-sm font-semibold text-white hover:bg-[#151f66] disabled:opacity-60 transition-colors">
                  {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>
              </form>
            </div>
          )}

          {/* ── Paso: crear cuenta ───────────────────────────────── */}
          {paso === 'registro' && (
            <div className="animate-content-in">
              {success ? (
                <div className="py-8 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">¡Cuenta creada!</h2>
                  <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                    Te enviamos un correo de verificación para esta empresa. Ábrelo para activarla.
                  </p>
                </div>
              ) : (
                <>
                  <button onClick={volver} className="mb-5 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Volver
                  </button>

                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Crear cuenta nueva</h2>
                  <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Para la empresa que quieres agregar. Es gratis.</p>

                  <button
                    onClick={handleGoogle}
                    disabled={gLoading}
                    className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-[#1a1d2e] disabled:opacity-60 transition-colors"
                  >
                    <GoogleIcon />
                    {gLoading ? 'Conectando…' : 'Continuar con Google'}
                  </button>

                  <div className="my-5 flex items-center gap-3">
                    <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
                    <span className="text-xs text-zinc-400 dark:text-zinc-600">o con correo</span>
                    <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
                  </div>

                  <form onSubmit={handleRegistro} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Nombre completo</label>
                      <input type="text" placeholder="Juan Pérez" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus autoComplete="name" className={INPUT} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Correo electrónico</label>
                      <input type="email" placeholder="empresa@correo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={INPUT} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Contraseña</label>
                      <div className="relative">
                        <input type={showPwd ? 'text' : 'password'} placeholder="Mín. 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" className={INPUT + ' pr-11'} />
                        <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrength pwd={password} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Confirmar contraseña</label>
                      <div className="relative">
                        <input type={showCfm ? 'text' : 'password'} placeholder="Repite la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" className={INPUT + ' pr-11'} />
                        <button type="button" onClick={() => setShowCfm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                          {showCfm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirm && password !== confirm && <p className="mt-1.5 text-[11px] text-rose-500">Las contraseñas no coinciden.</p>}
                    </div>

                    {error && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-3">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl bg-[#1B2980] py-3 text-sm font-semibold text-white hover:bg-[#151f66] disabled:opacity-60 transition-colors">
                      {loading ? 'Creando cuenta…' : 'Crear cuenta'}
                    </button>

                    <p className="text-center text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-600">
                      Al registrarte aceptas que esta es una herramienta de gestión interna y no constituye asesoría legal ni contable certificada.
                    </p>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
