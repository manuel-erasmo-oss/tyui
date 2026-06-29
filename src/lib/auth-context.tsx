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
import { auth, googleProvider } from './firebase'

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
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUp(email: string, password: string, nombre: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nombre })
  }

  async function signInGoogle() {
    await signInWithPopup(auth, googleProvider)
  }

  async function logout() {
    await signOut(auth)
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signInGoogle, logout, resetPassword }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
