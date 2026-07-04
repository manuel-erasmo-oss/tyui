'use client'

import { useAuth } from './auth-context'
import { FIREBASE_ENABLED } from './firebase'
import { scopedKey } from './utils'

// `ready` es false mientras no se sepa con certeza a qué usuario pertenece la
// key (evita leer/escribir datos de la cuenta equivocada durante la carga
// inicial o un cambio de sesión).
export function useUserScopedKey(base: string): { key: string; ready: boolean } {
  const { user, loading } = useAuth()
  if (!FIREBASE_ENABLED) return { key: base, ready: true }
  if (loading || !user) return { key: base, ready: false }
  return { key: scopedKey(base, user.uid), ready: true }
}
