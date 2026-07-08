'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  updateProfile,
} from 'firebase/auth'
import { getFirebaseAuthNamed, googleProvider, FIREBASE_ENABLED, DEFAULT_APP_NAME } from './firebase'

// ─── Multicuenta ────────────────────────────────────────────────────────────
// Cada empresa vinculada en este dispositivo es una cuenta REAL de Firebase
// Auth — su propio correo/contraseña, su propia verificación — no un perfil
// dentro de la misma cuenta. Esto es lo que permite que "cada empresa pague
// su cuota independiente" más adelante (cada una es su propio uid, su propia
// identidad, sin depender del contador).
//
// El registro de "qué cuentas están vinculadas en este navegador" vive fuera
// del sistema de datos scopeado por cuenta (useUserScopedKey) — a propósito,
// porque es lo que hace posible saber a cuál cambiar antes de que haya una
// cuenta "activa" determinada.
const REGISTRO_KEY = 'cielo-cuentas-vinculadas'

export interface CuentaVinculada {
  appName: string
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface RegistroCuentas {
  cuentas: CuentaVinculada[]
  activaAppName: string | null   // null = usar DEFAULT_APP_NAME (retrocompat — cuenta única de siempre)
}

const REGISTRO_VACIO: RegistroCuentas = { cuentas: [], activaAppName: null }

function cargarRegistro(): RegistroCuentas {
  try {
    const raw = localStorage.getItem(REGISTRO_KEY)
    return raw ? (JSON.parse(raw) as RegistroCuentas) : REGISTRO_VACIO
  } catch {
    return REGISTRO_VACIO
  }
}

function genAppName(): string {
  return `cuenta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

interface AuthCtx {
  user: User | null
  loading: boolean
  cuentasVinculadas: CuentaVinculada[]
  cuentaActivaAppName: string
  signIn:                 (email: string, password: string) => Promise<void>
  signUp:                 (email: string, password: string, nombre: string) => Promise<void>
  signInGoogle:           () => Promise<void>
  logout:                 () => Promise<void>
  resetPassword:          (email: string) => Promise<void>
  sendVerification:       () => Promise<void>
  refreshUser:            () => Promise<void>
  cambiarCuenta:          (appName: string) => void
  agregarCuentaLogin:     (email: string, password: string) => Promise<void>
  agregarCuentaRegistro:  (email: string, password: string, nombre: string) => Promise<void>
  agregarCuentaGoogle:    () => Promise<void>
  quitarCuenta:           (appName: string) => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  cuentasVinculadas: [],
  cuentaActivaAppName: DEFAULT_APP_NAME,
  signIn:                 async () => {},
  signUp:                 async () => {},
  signInGoogle:           async () => {},
  logout:                 async () => {},
  resetPassword:          async () => {},
  sendVerification:       async () => {},
  refreshUser:            async () => {},
  cambiarCuenta:          () => {},
  agregarCuentaLogin:     async () => {},
  agregarCuentaRegistro:  async () => {},
  agregarCuentaGoogle:    async () => {},
  quitarCuenta:           async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [registro, setRegistroState] = useState<RegistroCuentas>(REGISTRO_VACIO)
  const [registroListo, setRegistroListo] = useState(false)
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const activaAppName = registro.activaAppName ?? DEFAULT_APP_NAME

  function setRegistro(updater: RegistroCuentas | ((prev: RegistroCuentas) => RegistroCuentas)) {
    setRegistroState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: RegistroCuentas) => RegistroCuentas)(prev) : updater
      try { localStorage.setItem(REGISTRO_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Cargar el registro de cuentas vinculadas una sola vez al montar.
  useEffect(() => {
    if (!FIREBASE_ENABLED) { setLoading(false); setRegistroListo(true); return }
    setRegistroState(cargarRegistro())
    setRegistroListo(true)
  }, [])

  // Suscribirse al estado de auth de la cuenta activa — se re-suscribe cada
  // vez que activaAppName cambia (cambio de cuenta). Como Firebase persiste
  // la sesión por separado para cada nombre de app, cambiar a una cuenta que
  // ya inició sesión antes en este dispositivo es prácticamente instantáneo.
  useEffect(() => {
    if (!FIREBASE_ENABLED || !registroListo) return
    const auth = getFirebaseAuthNamed(activaAppName)
    getRedirectResult(auth).catch(() => {})
    setLoading(true)
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [activaAppName, registroListo])

  function upsertCuenta(appName: string, u: User) {
    const entry: CuentaVinculada = { appName, uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }
    setRegistro(prev => {
      const yaEsta = prev.cuentas.some(c => c.appName === appName)
      const cuentas = yaEsta ? prev.cuentas.map(c => c.appName === appName ? entry : c) : [...prev.cuentas, entry]
      return { cuentas, activaAppName: appName }
    })
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(getFirebaseAuthNamed(activaAppName), email, password)
  }

  async function signUp(email: string, password: string, nombre: string) {
    const auth = getFirebaseAuthNamed(activaAppName)
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nombre })
    await sendEmailVerification(cred.user)
  }

  async function signInGoogle() {
    await signInWithRedirect(getFirebaseAuthNamed(activaAppName), googleProvider)
  }

  async function logout() {
    await signOut(getFirebaseAuthNamed(activaAppName))
    // Si esta cuenta ya estaba registrada como una de varias vinculadas, se
    // quita de la lista al cerrar sesión — si no (el caso de siempre, una
    // sola cuenta), no hay nada más que hacer.
    setRegistro(prev => {
      if (!prev.cuentas.some(c => c.appName === activaAppName)) return prev
      const restantes = prev.cuentas.filter(c => c.appName !== activaAppName)
      return { cuentas: restantes, activaAppName: restantes[0]?.appName ?? null }
    })
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(getFirebaseAuthNamed(activaAppName), email)
  }

  async function sendVerification() {
    const cu = getFirebaseAuthNamed(activaAppName).currentUser
    if (cu) await sendEmailVerification(cu)
  }

  async function refreshUser() {
    const cu = getFirebaseAuthNamed(activaAppName).currentUser
    if (!cu) return
    await reload(cu)
    // Firebase mutates `cu` in place — spread into a new object so React detects the change
    setUser({ ...cu } as User)
  }

  function cambiarCuenta(appName: string) {
    if (appName === activaAppName) return
    setRegistro(prev => ({ ...prev, activaAppName: appName }))
  }

  // Antes de agregar una segunda cuenta, registra la cuenta activa actual (si
  // hay una) como su propia entrada — así no "desaparece" del selector en
  // cuanto el registro empieza a tener más de una cuenta.
  function asegurarCuentaActualRegistrada() {
    if (user && !registro.cuentas.some(c => c.appName === activaAppName)) {
      upsertCuenta(activaAppName, user)
    }
  }

  async function agregarCuentaLogin(email: string, password: string) {
    asegurarCuentaActualRegistrada()
    const appName = genAppName()
    const cred = await signInWithEmailAndPassword(getFirebaseAuthNamed(appName), email, password)
    upsertCuenta(appName, cred.user)
  }

  async function agregarCuentaRegistro(email: string, password: string, nombre: string) {
    asegurarCuentaActualRegistrada()
    const appName = genAppName()
    const auth = getFirebaseAuthNamed(appName)
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nombre })
    await sendEmailVerification(cred.user)
    upsertCuenta(appName, cred.user)
  }

  // Popup en vez de redirect (a diferencia de signInGoogle, usado por
  // /login) — un redirect completo abandonaría el dashboard actual, que es
  // justo lo que NO queremos al agregar una segunda empresa desde dentro de
  // la app. El popup es autocontenido y funciona igual de bien con una
  // instancia de Firebase App con nombre propio.
  async function agregarCuentaGoogle() {
    asegurarCuentaActualRegistrada()
    const appName = genAppName()
    const cred = await signInWithPopup(getFirebaseAuthNamed(appName), googleProvider)
    upsertCuenta(appName, cred.user)
  }

  async function quitarCuenta(appName: string) {
    await signOut(getFirebaseAuthNamed(appName))
    setRegistro(prev => {
      const restantes = prev.cuentas.filter(c => c.appName !== appName)
      const activa = prev.activaAppName === appName ? (restantes[0]?.appName ?? null) : prev.activaAppName
      return { cuentas: restantes, activaAppName: activa }
    })
  }

  return (
    <Ctx.Provider value={{
      user, loading,
      cuentasVinculadas: registro.cuentas,
      cuentaActivaAppName: activaAppName,
      signIn, signUp, signInGoogle, logout, resetPassword, sendVerification, refreshUser,
      cambiarCuenta, agregarCuentaLogin, agregarCuentaRegistro, agregarCuentaGoogle, quitarCuenta,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
