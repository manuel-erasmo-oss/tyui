'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAlertas, SEVERIDAD_LABEL, type Severidad } from '@/lib/alertas'
import { cn } from '@/lib/utils'

const SEVERIDAD_GRADIENTE: Record<Severidad, string> = {
  danger:  'linear-gradient(135deg, #e11d48, #fb7185)',
  warning: 'linear-gradient(135deg, #d97706, #fbbf24)',
  info:    'linear-gradient(135deg, #0284c7, #38bdf8)',
}

const SEVERIDAD_HALO: Record<Severidad, string> = {
  danger:  'bg-rose-500',
  warning: 'bg-amber-500',
  info:    'bg-sky-500',
}

const SEVERIDAD_BORDE: Record<Severidad, string> = {
  danger:  'border-l-rose-400 dark:border-l-rose-600',
  warning: 'border-l-amber-400 dark:border-l-amber-600',
  info:    'border-l-sky-400 dark:border-l-sky-600',
}

const SEVERIDAD_TEXTO: Record<Severidad, string> = {
  danger:  'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info:    'text-sky-600 dark:text-sky-400',
}

const SEVERIDAD_BADGE: Record<Severidad, string> = {
  danger:  'bg-rose-500',
  warning: 'bg-amber-500',
  info:    'bg-sky-500',
}

// ── Campanita de notificaciones ───────────────────────────────────────────
// Reemplaza el banner grande que antes vivía fijo en el Dashboard: ahora es
// un ícono compacto en el Header (visible en TODA la app, no solo en el
// Dashboard) con un badge de conteo, que al hacer click abre un popover con
// el detalle — cada fila navega directo al módulo donde hay que accionar.
export function NotificationBell() {
  const alertas = useAlertas()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const severidadMasAlta: Severidad | null = alertas.some(a => a.severidad === 'danger')
    ? 'danger'
    : alertas.some(a => a.severidad === 'warning')
      ? 'warning'
      : alertas.length > 0 ? 'info' : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
        title="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {severidadMasAlta && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#141722]',
            SEVERIDAD_BADGE[severidadMasAlta],
          )}>
            {alertas.length}
          </span>
        )}
      </button>

      {open && (
        // Fijo al viewport (con margen a los lados) en pantallas angostas —
        // `absolute right-0` posicionado relativo al botón se sale por la
        // izquierda de la pantalla cuando la campana está cerca del borde
        // derecho de un viewport móvil, cortando el contenido. Desde `sm:`
        // en adelante vuelve al anclaje normal junto al botón.
        <div className="fixed inset-x-4 top-14 z-50 max-h-[75vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-lg shadow-zinc-200/60 dark:shadow-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-[22rem]">
          <div className="sticky top-0 border-b border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notificaciones</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {alertas.length === 0 ? 'Sin alertas pendientes' : `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} por revisar`}
            </p>
          </div>

          {alertas.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-5">
              <div className="relative h-8 w-8 shrink-0">
                <div className="absolute inset-0 rounded-lg bg-emerald-500 blur-md opacity-25" />
                <div
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{ backgroundImage: 'linear-gradient(135deg, #059669, #34d399)' }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Todo en orden — nada pendiente.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-[#1d2035]">
              {alertas.map(item => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group flex items-start gap-3 border-l-2 border-transparent px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]',
                      SEVERIDAD_BORDE[item.severidad],
                    )}
                  >
                    <div className="relative h-8 w-8 shrink-0">
                      <div className={cn('absolute inset-0 rounded-lg blur-md opacity-0 transition-opacity group-hover:opacity-30', SEVERIDAD_HALO[item.severidad])} />
                      <div
                        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
                        style={{ backgroundImage: SEVERIDAD_GRADIENTE[item.severidad] }}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.titulo}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{item.descripcion}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide', SEVERIDAD_TEXTO[item.severidad])}>
                          {SEVERIDAD_LABEL[item.severidad]}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#1B2980] dark:text-indigo-400">
                          {item.linkLabel}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
