'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { useIsDark } from '@/lib/theme'

interface Props {
  data: { mes: string; valor: number }[]
  color?: string
}

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(0)}K`

export function TrendLineChart({ data, color = '#1B2980' }: Props) {
  const [mounted, setMounted] = useState(false)
  const isDark = useIsDark()
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50 dark:bg-[#1a1d2e]" />

  const activeColor = isDark ? '#818cf8' : color
  const gridColor   = isDark ? '#252840' : '#f4f4f5'
  const tickColor   = isDark ? '#515868' : '#a1a1aa'
  const tooltipStyle = {
    fontSize: 11,
    border: `1px solid ${isDark ? '#252840' : '#e4e4e7'}`,
    borderRadius: 8,
    backgroundColor: isDark ? '#1a1d2e' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#18181b',
    boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,.08)',
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          formatter={(v) => [fmt(Number(v)), 'Nómina neta']}
          contentStyle={tooltipStyle}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={activeColor}
          strokeWidth={2}
          dot={{ r: 3, fill: activeColor, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: activeColor, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
