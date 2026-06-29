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

// Lazy getter — never called at module level so the build doesn't fail
// without env vars. Only runs in the browser (inside useEffect / event handlers).
export function getFirebaseAuth() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  return getAuth(app)
}

export const googleProvider = new GoogleAuthProvider()
