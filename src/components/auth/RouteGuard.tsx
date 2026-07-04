'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEmpresa } from '@/lib/empresa-context'
import { FIREBASE_ENABLED } from '@/lib/firebase'
import { cargarDatosDemo } from '@/lib/seed-data'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { EmailVerificationGate } from '@/components/auth/EmailVerificationGate'

const PUBLIC_PATHS = ['/login', '/registro']

// Cuenta de uso personal/pruebas: sin verificación de correo y con datos
// demo precargados automáticamente, sin pasar por el wizard de onboarding.
const ADMIN_EMAIL = 'admin@admin.com'

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#0d0f1a]">
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 32 32" fill="none" className="h-12 w-12">
          <circle
            cx="16" cy="16" r="9"
            strokeWidth="5.5"
            strokeDasharray="47.12 9.43"
            strokeLinecap="round"
            transform="rotate(30 16 16)"
            className="stroke-[#1B2980] dark:stroke-indigo-400"
          />
          <circle cx="16" cy="16" r="2.8" className="fill-[#1B2980] dark:fill-indigo-400" />
        </svg>
        <div className="h-0.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-[#252840]">
          <div className="h-full w-8 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-[#1B2980] dark:bg-indigo-500" />
        </div>
      </div>
    </div>
  )
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading }  = useAuth()
  const { empresa, cargado: empresaCargada } = useEmpresa()
  const router              = useRouter()
  const pathname            = usePathname()

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const esAdmin  = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic) router.replace('/login')
    if (user  &&  isPublic) router.replace('/')
  }, [user, loading, isPublic, router])

  const needsOnboarding = empresaCargada && !empresa.onboardingCompleto

  // Cuenta admin de uso personal — precarga datos demo y salta el onboarding
  useEffect(() => {
    if (!FIREBASE_ENABLED || !esAdmin || !needsOnboarding) return
    cargarDatosDemo(user?.uid)
    window.location.reload()
  }, [esAdmin, needsOnboarding, user?.uid])

  // Firebase not configured → skip auth, only gate on onboarding
  if (!FIREBASE_ENABLED) {
    if (isPublic) return null
    if (!empresaCargada) return <LoadingScreen />
    if (needsOnboarding) return <OnboardingWizard />
    return (
      <>
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">{children}</main>
        <BottomNav />
      </>
    )
  }

  if (loading) return <LoadingScreen />

  // Auth pages — full-screen, no sidebar
  if (isPublic) {
    if (user) return null
    return <div className="flex flex-1 overflow-y-auto">{children}</div>
  }

  if (!user) return null

  const esCuentaPassword  = user.providerData.some(p => p.providerId === 'password')
  const needsVerification = esCuentaPassword && !user.emailVerified && !esAdmin

  // Verificación de correo y onboarding se muestran a pantalla completa, sin sidebar
  if (needsVerification) return <EmailVerificationGate />
  if (!empresaCargada)   return <LoadingScreen />
  // Admin: mientras se precargan los datos demo y recarga la página, solo loading
  if (needsOnboarding)    return esAdmin ? <LoadingScreen /> : <OnboardingWizard />

  // Protected pages — fully set up, show app chrome
  return (
    <>
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </>
  )
}
