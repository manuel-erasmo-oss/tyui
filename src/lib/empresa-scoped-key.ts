'use client'

import { useAuth } from './auth-context'
import { FIREBASE_ENABLED } from './firebase'
import { useEmpresas } from './empresas-context'
import { buildEmpresaScopedKey } from './empresa-scoped-bases'

export { buildEmpresaScopedKey, EMPRESA_SCOPED_BASES } from './empresa-scoped-bases'

// `ready` es false mientras no se sepa con certeza a qué cuenta Y a qué
// empresa activa pertenece la key — evita leer/escribir datos de la empresa
// equivocada durante la carga inicial o justo después de cambiar de empresa.
export function useEmpresaScopedKey(base: string): { key: string; ready: boolean } {
  const { user, loading } = useAuth()
  const { empresaActivaId, cargado: empresasCargadas } = useEmpresas()

  if (FIREBASE_ENABLED && (loading || !user)) return { key: base, ready: false }
  if (!empresasCargadas || !empresaActivaId) return { key: base, ready: false }

  const uid = FIREBASE_ENABLED ? user?.uid : undefined
  return { key: buildEmpresaScopedKey(base, uid, empresaActivaId), ready: true }
}
