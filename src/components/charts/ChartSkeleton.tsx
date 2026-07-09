'use client'

interface Props {
  variant: 'bars' | 'donut' | 'line'
  height?: number
}

const BAR_HEIGHTS = [42, 68, 50, 82, 60]

export function ChartSkeleton({ variant, height = 120 }: Props) {
  if (variant === 'donut') {
    return (
      <div className="flex animate-pulse items-center justify-center" style={{ height }}>
        <svg viewBox="0 0 100 100" className="h-[92px] w-[92px]">
          <circle cx="50" cy="50" r="38" fill="none" strokeWidth="16" className="stroke-zinc-100 dark:stroke-[#1f2337]" />
        </svg>
      </div>
    )
  }

  if (variant === 'line') {
    return (
      <div className="animate-pulse" style={{ height }}>
        <svg viewBox="0 0 200 70" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M0,50 C25,20 45,55 70,35 C95,15 115,45 140,28 C160,15 180,38 200,20"
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stroke-zinc-200 dark:stroke-[#1f2337]"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex animate-pulse items-end gap-2" style={{ height }}>
      {BAR_HEIGHTS.map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm bg-zinc-100 dark:bg-[#1f2337]" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}
