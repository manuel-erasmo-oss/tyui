'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface Props {
  data: { mes: string; nomina: number; tss: number }[]
}

const fmt = (v: number) => `RD$${(v / 1_000).toFixed(0)}K`

export function PayrollBarChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[120px] animate-pulse rounded bg-zinc-50" />

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={10} barGap={2}>
        <CartesianGrid vertical={false} stroke="#f4f4f5" />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          formatter={(v, name) => [fmt(Number(v)), name === 'nomina' ? 'Nómina bruta' : 'TSS empleador']}
          contentStyle={{ fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
          cursor={{ fill: '#f4f4f5' }}
        />
        <Bar dataKey="nomina" fill="#1B2980" radius={[3, 3, 0, 0]} />
        <Bar dataKey="tss"    fill="#00E676" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
