import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
}

const VARIANTS = {
  default: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger:  'bg-rose-50 text-rose-700 ring-rose-200',
  info:    'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
