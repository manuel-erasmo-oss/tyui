'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

interface Props {
  data: { mes: string; valor: number }[]
  color?: string
}

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(0)}K`

export function TrendLineChart({ data, color = '#1B2980' }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50" />

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="#f4f4f5" />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          formatter={(v) => [fmt(Number(v)), 'Nómina neta']}
          contentStyle={{ fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
