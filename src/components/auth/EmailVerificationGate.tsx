'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MailCheck, RefreshCw, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface Props {
  children: React.ReactNode
}

export function EmailVerificationGate({ children }: Props) {
  const { user, sendVerification, refreshUser, logout } = useAuth()
  const router = useRouter()
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [checking, setChecking] = useState(false)

  const esCuentaPassword = user?.providerData.some(p => p.providerId === 'password') ?? false

  // Google ya verifica el correo por su cuenta — solo bloqueamos cuentas email/contraseña
  if (!user || !esCuentaPassword || user.emailVerified) return <>{children}</>

  async function handleReenviar() {
    setSending(true)
    try {
      await sendVerification()
      setSent(true)
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

  async function handleYaVerifique() {
    setChecking(true)
    try {
      await refreshUser()
    } catch { /* ignore */ } finally {
      setChecking(false)
    }
  }

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#0d0f1a] p-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/40">
            <MailCheck className="h-7 w-7 text-[#1B2980] dark:text-indigo-400" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Verifica tu correo</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Enviamos un enlace de confirmación a{' '}
          <strong className="font-semibold text-zinc-700 dark:text-zinc-300">{user.email}</strong>.
          Ábrelo desde tu bandeja de entrada para activar tu cuenta.
        </p>

        {sent && (
          <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Correo reenviado — revisa también spam.
          </p>
        )}

        <button
          type="button"
          onClick={handleYaVerifique}
          disabled={checking}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-60 py-3 text-sm font-semibold text-white transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Verificando…' : 'Ya verifiqué mi correo'}
        </button>

        <button
          type="button"
          onClick={handleReenviar}
          disabled={sending}
          className="mt-3 w-full text-sm font-medium text-[#1B2980] dark:text-indigo-400 hover:underline disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Reenviar correo de verificación'}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
