'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Evento {
  id: string
  fecha: string // YYYY-MM-DD
  titulo: string
  tipo: 'fiscal' | 'custom'
}

const MES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fiscalEvents(year: number, month: number): Evento[] {
  // month: 0-indexed
  const m = pad2(month + 1)
  const events: Evento[] = [
    { id: `isr-${year}-${m}`,  fecha: `${year}-${m}-10`, titulo: 'ISR — DGII',  tipo: 'fiscal' },
    { id: `tss-${year}-${m}`,  fecha: `${year}-${m}-10`, titulo: 'TSS — CNSS',  tipo: 'fiscal' },
  ]
  if (month === 11) {
    events.push({ id: `regalia-${year}`, fecha: `${year}-12-20`, titulo: 'Regalía Pascual', tipo: 'fiscal' })
  }
  return events
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstWeekdayOffset(year: number, month: number): number {
  // Monday = 0 … Sunday = 6
  return (new Date(year, month, 1).getDay() + 6) % 7
}

function todayISO(): string {
  const t = new Date()
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`
}

function daysUntil(fecha: string): number {
  const now = new Date(todayISO() + 'T00:00:00')
  const target = new Date(fecha + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

function dotColor(fecha: string, done: boolean): string {
  if (done) return 'bg-zinc-300 dark:bg-zinc-700'
  const d = daysUntil(fecha)
  if (d < 0)   return 'bg-zinc-300 dark:bg-zinc-700'
  if (d <= 5)  return 'bg-rose-500'
  if (d <= 15) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function textColor(fecha: string, done: boolean): string {
  if (done) return 'text-zinc-400 dark:text-zinc-600'
  const d = daysUntil(fecha)
  if (d < 0)   return 'text-zinc-400 dark:text-zinc-600'
  if (d <= 5)  return 'text-rose-600 dark:text-rose-400'
  if (d <= 15) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

export function AgendaNomina() {
  const hoy = new Date()
  const [viewYear,  setViewYear]  = useState(hoy.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoy.getMonth())
  const [custom, setCustom]       = useState<Evento[]>([])
  const [done,   setDone]         = useState<string[]>([])
  const [mounted, setMounted]     = useState(false)
  const [newFecha,  setNewFecha]  = useState('')
  const [newTitulo, setNewTitulo] = useState('')

  useEffect(() => {
    setMounted(true)
    try {
      const c = localStorage.getItem('cielo-agenda-custom')
      if (c) setCustom(JSON.parse(c))
      const d = localStorage.getItem('cielo-agenda-done')
      if (d) setDone(JSON.parse(d))
    } catch {}
  }, [])

  // All events for the viewed month, sorted by date
  const allEvents: Evento[] = [
    ...fiscalEvents(viewYear, viewMonth),
    ...custom.filter(e => {
      const [y, m] = e.fecha.split('-').map(Number)
      return y === viewYear && m === viewMonth + 1
    }),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Calendar cells (null = empty padding cell)
  const days = daysInMonth(viewYear, viewMonth)
  const offset = firstWeekdayOffset(viewYear, viewMonth)
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventDays = new Set(allEvents.map(e => Number(e.fecha.split('-')[2])))
  const isThisMonth = viewYear === hoy.getFullYear() && viewMonth === hoy.getMonth()
  const todayDay   = hoy.getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function toggleDone(id: string) {
    const next = done.includes(id) ? done.filter(x => x !== id) : [...done, id]
    setDone(next)
    if (mounted) localStorage.setItem('cielo-agenda-done', JSON.stringify(next))
  }

  function deleteEvent(id: string) {
    const nextC = custom.filter(e => e.id !== id)
    const nextD = done.filter(x => x !== id)
    setCustom(nextC)
    setDone(nextD)
    if (mounted) {
      localStorage.setItem('cielo-agenda-custom', JSON.stringify(nextC))
      localStorage.setItem('cielo-agenda-done',   JSON.stringify(nextD))
    }
  }

  function addEvent() {
    if (!newFecha || !newTitulo.trim()) return
    const id = `custom-${newFecha}-${newTitulo.trim().slice(0, 8).replace(/\s+/g, '')}-${Date.now().toString(36)}`
    const ev: Evento = { id, fecha: newFecha, titulo: newTitulo.trim(), tipo: 'custom' }
    const next = [...custom, ev]
    setCustom(next)
    if (mounted) localStorage.setItem('cielo-agenda-custom', JSON.stringify(next))
    setNewFecha('')
    setNewTitulo('')
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Agenda Nómina
        </p>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-500 transition-colors">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 w-[104px] text-center">
            {MES_LARGO[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-[#1a1d2e] text-zinc-400 dark:text-zinc-500 transition-colors">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Mini calendar */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-7">
          {DIAS_CORTOS.map(d => (
            <div key={d} className="text-center text-[9px] font-semibold text-zinc-400 dark:text-zinc-600 pb-1.5">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const isToday  = isThisMonth && day === todayDay
            const hasEvent = day !== null && eventDays.has(day)
            return (
              <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
                {day !== null ? (
                  <span className={cn(
                    'h-5 w-5 flex items-center justify-center rounded-full text-[10px] leading-none transition-colors',
                    isToday
                      ? 'bg-[#1B2980] text-white font-bold'
                      : 'text-zinc-500 dark:text-zinc-400',
                  )}>
                    {day}
                  </span>
                ) : (
                  <span className="h-5 w-5" />
                )}
                <span className={cn('h-1 w-1 rounded-full', hasEvent && day !== null ? 'bg-[#1B2980] dark:bg-indigo-400' : 'bg-transparent')} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto max-h-[180px] divide-y divide-zinc-50 dark:divide-[#1d2035]">
        {allEvents.length === 0 && (
          <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 py-4">
            Sin eventos este mes
          </p>
        )}
        {allEvents.map(ev => {
          const isDone   = done.includes(ev.id)
          const dayNum   = Number(ev.fecha.split('-')[2])
          const monthIdx = Number(ev.fecha.split('-')[1]) - 1
          const label    = `${dayNum} ${MES_LARGO[monthIdx].slice(0, 3).toLowerCase()}.`
          return (
            <div key={ev.id} className="flex items-center gap-2 px-4 py-2">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor(ev.fecha, isDone))} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[11px] font-semibold leading-snug truncate',
                  isDone ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-200',
                )}>
                  {ev.titulo}
                </p>
                <p className={cn('text-[10px] leading-none mt-0.5', textColor(ev.fecha, isDone))}>
                  {label}
                  {!isDone && (() => {
                    const d = daysUntil(ev.fecha)
                    if (d < 0)   return ' · vencido'
                    if (d === 0) return ' · hoy'
                    if (d === 1) return ' · mañana'
                    if (d <= 5)  return ` · ${d}d ⚠`
                    if (d <= 15) return ` · ${d}d`
                    return ''
                  })()}
                </p>
              </div>
              <button
                onClick={() => toggleDone(ev.id)}
                title={isDone ? 'Marcar pendiente' : 'Completado'}
                className={cn(
                  'shrink-0 rounded p-0.5 transition-colors',
                  isDone
                    ? 'text-emerald-500 hover:text-zinc-400'
                    : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-500',
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              {ev.tipo === 'custom' && (
                <button
                  onClick={() => deleteEvent(ev.id)}
                  title="Eliminar"
                  className="shrink-0 rounded p-0.5 text-zinc-300 dark:text-zinc-600 hover:text-rose-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add event */}
      <div className="border-t border-zinc-100 dark:border-[#1d2035] px-4 py-3 flex gap-1.5">
        <input
          type="date"
          value={newFecha}
          onChange={e => setNewFecha(e.target.value)}
          className="w-[108px] shrink-0 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-[11px] text-zinc-700 dark:text-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1B2980] dark:focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="Nuevo evento…"
          value={newTitulo}
          onChange={e => setNewTitulo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEvent()}
          className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] text-[11px] text-zinc-700 dark:text-zinc-300 px-2.5 py-1.5 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#1B2980] dark:focus:ring-indigo-500"
        />
        <button
          onClick={addEvent}
          className="shrink-0 rounded-lg bg-[#1B2980] hover:bg-[#151f66] text-white px-2.5 py-1.5 transition-colors flex items-center"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
