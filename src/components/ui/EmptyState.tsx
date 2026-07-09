import { Inbox, type LucideIcon } from 'lucide-react'
import { BTN_PRIMARY, cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message: string
  action?: { label: string; onClick: () => void }
  className?: string
}

/** Estado vacío compartido — badge de ícono con halo de marca en vez del
 *  simple ícono gris genérico, para que "no hay datos" se sienta parte del
 *  mismo sistema de diseño que el resto de la app, no un placeholder. */
export function EmptyState({ icon: Icon = Inbox, title, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-[#252840] bg-white dark:bg-[#141722] py-16 gap-1 px-6',
      className,
    )}>
      <div className="relative mb-3">
        <div className="absolute inset-0 rounded-2xl bg-[#1B2980]/10 dark:bg-indigo-500/10 blur-lg" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
          <Icon className="h-6 w-6 text-[#1B2980] dark:text-indigo-400" strokeWidth={1.75} />
        </div>
      </div>
      {title && <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>}
      <p className="mt-1 max-w-xs text-center text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      {action && (
        <button onClick={action.onClick} className={cn(BTN_PRIMARY, 'mt-4')}>
          {action.label}
        </button>
      )}
    </div>
  )
}
