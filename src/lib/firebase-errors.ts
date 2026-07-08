// Mensajes en español para los códigos de error más comunes de Firebase Auth
// — combina los mapeos que ya existían por separado en /login y /registro,
// para reutilizar en el selector de cuentas del Sidebar sin duplicarlos.
export function firebaseAuthMsg(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.'
    case 'auth/email-already-in-use':
      return 'Este correo ya tiene una cuenta. Intenta iniciar sesión en vez de crear una nueva.'
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Restablece tu contraseña o intenta más tarde.'
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.'
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada. Contacta soporte.'
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.'
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado en Firebase. Agrégalo en Firebase Console → Authentication → Settings → Dominios autorizados.'
    case 'auth/operation-not-allowed':
      return 'Este método de inicio de sesión no está activado. Actívalo en Firebase Console → Authentication → Sign-in method.'
    default:
      return `Error: ${code || 'desconocido'}. Intenta de nuevo.`
  }
}
