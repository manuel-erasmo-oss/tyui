'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  updateProfile,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider, FIREBASE_ENABLED } from './firebase'

interface AuthCtx {
  user: User | null
  loading: boolean
  signIn:            (email: string, password: string) => Promise<void>
  signUp:            (email: string, password: string, nombre: string) => Promise<void>
  signInGoogle:      () => Promise<void>
  logout:            () => Promise<void>
  resetPassword:     (email: string) => Promise<void>
  sendVerification:  () => Promise<void>
  refreshUser:       () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn:            async () => {},
  signUp:            async () => {},
  signInGoogle:      async () => {},
  logout:            async () => {},
  resetPassword:     async () => {},
  sendVerification:  async () => {},
  refreshUser:       async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    // Pick up the result when Google redirects back to the app
    getRedirectResult(auth).catch(() => {})
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  }

  async function signUp(email: string, password: string, nombre: string) {
    const auth = getFirebaseAuth()
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nombre })
    await sendEmailVerification(cred.user)
  }

  async function signInGoogle() {
    await signInWithRedirect(getFirebaseAuth(), googleProvider)
  }

  async function logout() {
    await signOut(getFirebaseAuth())
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(getFirebaseAuth(), email)
  }

  async function sendVerification() {
    const cu = getFirebaseAuth().currentUser
    if (cu) await sendEmailVerification(cu)
  }

  async function refreshUser() {
    const cu = getFirebaseAuth().currentUser
    if (!cu) return
    await reload(cu)
    // Firebase mutates `cu` in place — spread into a new object so React detects the change
    setUser({ ...cu } as User)
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signInGoogle, logout, resetPassword, sendVerification, refreshUser }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
