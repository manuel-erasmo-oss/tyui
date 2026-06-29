'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider, FIREBASE_ENABLED } from './firebase'

interface AuthCtx {
  user: User | null
  loading: boolean
  signIn:        (email: string, password: string) => Promise<void>
  signUp:        (email: string, password: string, nombre: string) => Promise<void>
  signInGoogle:  () => Promise<void>
  logout:        () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn:        async () => {},
  signUp:        async () => {},
  signInGoogle:  async () => {},
  logout:        async () => {},
  resetPassword: async () => {},
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
  }

  async function signInGoogle() {
    await signInWithPopup(getFirebaseAuth(), googleProvider)
  }

  async function logout() {
    await signOut(getFirebaseAuth())
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(getFirebaseAuth(), email)
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signInGoogle, logout, resetPassword }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
