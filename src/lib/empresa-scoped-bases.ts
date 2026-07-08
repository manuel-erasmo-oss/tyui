// Constantes puras, sin dependencias de React — separadas de
// empresa-scoped-key.ts (que sí depende de useEmpresas) para que
// empresas-context.tsx pueda importarlas sin crear un import circular.

// Todas las bases de localStorage que almacenan datos propios de UNA empresa
// (no de la cuenta completa) — cielo-empresa es el perfil en sí; el resto son
// los contextos de negocio. eliminarEmpresa() (empresas-context.tsx) las usa
// para borrar todo lo que quede huérfano cuando se elimina una empresa.
export const EMPRESA_SCOPED_BASES = [
  'cielo-empresa',
  'cielo-empleados',
  'cielo-periodos',
  'cielo-prestamos',
  'cielo-aumentos',
  'cielo-licencias',
  'cielo-bandas-salariales',
  'cielo-liquidaciones',
  'cielo-saldo-isr',
  'cielo-feriados',
  'cielo-agenda-custom',
  'cielo-agenda-done',
] as const

// Compone la key final — misma lógica tanto para el hook de React
// (useEmpresaScopedKey) como para el seed de datos demo (que corre fuera de
// React, antes de un reload).
export function buildEmpresaScopedKey(base: string, uid: string | null | undefined, empresaId: string | null | undefined): string {
  const partes = [base, uid ?? undefined, empresaId ?? undefined].filter(Boolean)
  return partes.join('::')
}
