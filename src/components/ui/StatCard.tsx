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
  iconColor = 'bg-teal-50 text-teal-600',
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-500 leading-tight">{label}</p>
        {trend && trendLabel && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold shrink-0',
              trend === 'up'   ? 'bg-emerald-50 text-emerald-700' :
              trend === 'down' ? 'bg-rose-50 text-rose-700' :
                                  'bg-zinc-50 text-zinc-600'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trendLabel}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-2xl font-bold text-zinc-900 leading-none">{value}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconColor)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-zinc-400 border-t border-zinc-50 pt-2">{sub}</p>}
    </div>
  )
}
