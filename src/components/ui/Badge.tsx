import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
}

const VARIANTS = {
  default: 'bg-[#eef0fb] text-[#151f66] ring-[#1B2980]/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/50',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/50',
  danger:  'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/50',
  info:    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-800/50',
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-[#1a1d2e] dark:text-zinc-400 dark:ring-[#252840]',
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
