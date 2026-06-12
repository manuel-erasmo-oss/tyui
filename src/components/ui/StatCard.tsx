import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  iconColor?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = 'bg-[#eef0fb] text-[#1B2980]',
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-5 shadow-sm hover:shadow-md dark:hover:shadow-none dark:hover:border-[#2e3355] transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-tight">{label}</p>
        {trend && trendLabel && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold shrink-0',
              trend === 'up'   ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
              trend === 'down' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' :
                                  'bg-zinc-50 text-zinc-600 dark:bg-[#1a1d2e] dark:text-zinc-400'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trendLabel}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{value}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconColor)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-50 dark:border-[#1d2035] pt-2">{sub}</p>}
    </div>
  )
}
