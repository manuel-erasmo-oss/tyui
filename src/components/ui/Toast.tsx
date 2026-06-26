'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
  error:   <AlertCircle  className="h-4 w-4 text-rose-500    shrink-0" />,
  info:    <Info         className="h-4 w-4 text-indigo-400  shrink-0" />,
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitDelay = duration - 180
    const exitTimer = setTimeout(() => setExiting(true), exitDelay)
    const closeTimer = setTimeout(onClose, duration)
    return () => { clearTimeout(exitTimer); clearTimeout(closeTimer) }
  }, [onClose, duration])

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, 180)
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-4 py-3 shadow-xl dark:shadow-2xl ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}>
      {ICONS[type]}
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{message}</p>
      <button
        onClick={handleClose}
        className="ml-1 rounded p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
