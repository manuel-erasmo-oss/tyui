'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useIsDark } from '@/lib/theme'

interface Props {
  data: { mes: string; nomina: number; tss: number }[]
}

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(0)}K`

export function PayrollBarChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  const isDark = useIsDark()
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" />

  const gridColor   = isDark ? '#252840' : '#f4f4f5'
  const tickColor   = isDark ? '#515868' : '#a1a1aa'
  const cursorColor = isDark ? '#1a1d2e' : '#f4f4f5'
  const tooltipStyle = {
    fontSize: 11,
    border: `1px solid ${isDark ? '#252840' : '#e4e4e7'}`,
    borderRadius: 8,
    backgroundColor: isDark ? '#1a1d2e' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#18181b',
    boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,.08)',
  }
  const nominaColor = isDark ? '#818cf8' : '#1B2980'

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={10} barGap={2}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          formatter={(v, name) => [fmt(Number(v)), name === 'nomina' ? 'Nómina bruta' : 'TSS empleador']}
          contentStyle={tooltipStyle}
          cursor={{ fill: cursorColor }}
        />
        <Bar dataKey="nomina" fill={nominaColor} radius={[3, 3, 0, 0]} />
        <Bar dataKey="tss"    fill="#10b981"     radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
