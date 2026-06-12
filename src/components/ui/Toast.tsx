'use client'

import { useEffect } from 'react'
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
  info:    <Info         className="h-4 w-4 text-[#1B2980]   shrink-0" />,
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl animate-toast-in">
      {ICONS[type]}
      <p className="text-sm font-medium text-zinc-900">{message}</p>
      <button
        onClick={onClose}
        className="ml-1 rounded p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
