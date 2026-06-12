import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

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
  iconColor = 'bg-indigo-50 text-indigo-600',
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && trendLabel && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              trend === 'up'      ? 'bg-emerald-50 text-emerald-700' :
              trend === 'down'    ? 'bg-rose-50 text-rose-700' :
              'bg-zinc-50 text-zinc-600'
            )}
          >
            {trendLabel}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
    </div>
  )
}
