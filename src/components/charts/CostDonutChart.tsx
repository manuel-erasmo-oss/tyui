'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface Slice { name: string; value: number; color: string }
interface Props { data: Slice[] }

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(1)}K`

export function CostDonutChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50" />

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={110} height={110}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={32}
            outerRadius={50}
            dataKey="value"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [fmt(Number(v))]}
            contentStyle={{ fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[11px] text-zinc-500 truncate">{d.name}</span>
            </div>
            <span className="text-[11px] font-medium text-zinc-700 tabular-nums shrink-0">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
