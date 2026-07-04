import type { Empleado } from '@/types'
import { fullName } from '@/lib/utils'

export function EmpleadoAvatar({
  emp, size = 'md', className = '',
}: { emp: Empleado; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm'
  if (emp.fotoPerfil) {
    return (
      <img
        src={emp.fotoPerfil}
        alt={fullName(emp)}
        className={`${dim} rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ backgroundColor: emp.avatarColor ?? (emp.activo ? '#1B2980' : '#6b7280') }}
    >
      {emp.nombre[0]}{emp.apellido[0]}
    </div>
  )
}
