'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useIsDark } from '@/lib/theme'

interface Slice { name: string; value: number; color: string }
interface Props { data: Slice[] }

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(1)}K`

export function CostDonutChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  const isDark = useIsDark()
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" />

  const tooltipStyle = {
    fontSize: 11,
    border: `1px solid ${isDark ? '#252840' : '#e4e4e7'}`,
    borderRadius: 8,
    backgroundColor: isDark ? '#1a1d2e' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#18181b',
    boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,.08)',
  }

  const displayData = isDark
    ? data.map(d => ({ ...d, color: d.color === '#1B2980' ? '#818cf8' : d.color }))
    : data

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={110} height={110}>
        <PieChart>
          <Pie
            data={displayData}
            innerRadius={32}
            outerRadius={50}
            dataKey="value"
            paddingAngle={2}
            strokeWidth={0}
          >
            {displayData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [fmt(Number(v))]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 flex-1 min-w-0">
        {displayData.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{d.name}</span>
            </div>
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
