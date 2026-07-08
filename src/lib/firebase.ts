import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// True only when Firebase env vars are present at build time.
// When false, auth is bypassed so the app stays accessible.
export const FIREBASE_ENABLED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Nombre de la instancia de Firebase App "de siempre" — la que ya usaban
// todas las sesiones antes de multicuenta. Se mantiene como default explícito
// para que una cuenta ya logueada siga funcionando exactamente igual sin
// ninguna migración.
export const DEFAULT_APP_NAME = '[DEFAULT]'

// Multicuenta real: cada empresa vinculada en este dispositivo vive en su
// propia instancia con nombre de Firebase App (mismo proyecto/config, pero
// Auth persiste el estado de sesión por separado para cada nombre de app —
// así se puede tener más de una cuenta autenticada simultáneamente en la
// misma pestaña, y cambiar entre ellas es instantáneo una vez que ya inició
// sesión al menos una vez).
export function getFirebaseAuthNamed(appName: string) {
  const existing = getApps().find(a => a.name === appName)
  const app = existing ?? (appName === DEFAULT_APP_NAME && getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig, appName))
  return getAuth(app)
}

// Lazy getter — never called at module level so the build doesn't fail
// without env vars. Only runs in the browser (inside useEffect / event handlers).
export function getFirebaseAuth() {
  return getFirebaseAuthNamed(DEFAULT_APP_NAME)
}

export const googleProvider = new GoogleAuthProvider()

