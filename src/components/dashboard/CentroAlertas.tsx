'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2, ChevronDown, ShieldAlert, Wallet, Percent, Gift, BarChart3, ArrowRight,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useBandasSalariales, normalizarPosicion } from '@/lib/bandas-salariales-context'
import { getSalarioMinimoAplicable, getBonificacionesPendientes } from '@/lib/dominican-labor'
import { fullName, formatRD, cn } from '@/lib/utils'

type Severidad = 'danger' | 'warning' | 'info'

interface AlertaItem {
  id: string
  severidad: Severidad
  icon: LucideIcon
  titulo: string
  descripcion: string
  detalle?: string[]
  detalleTotal?: number
  href: string
  linkLabel: string
}

const SEVERIDAD_ORDEN: Record<Severidad, number> = { danger: 0, warning: 1, info: 2 }

const SEVERIDAD_LABEL: Record<Severidad, string> = { danger: 'Urgente', warning: 'Advertencia', info: 'Informativo' }

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

const SEVERIDAD_DOT: Record<Severidad, string> = {
  danger:  'bg-rose-500',
  warning: 'bg-amber-500',
  info:    'bg-sky-500',
}

const CATEGORIA_LABEL: Record<string, string> = { micro: 'Micro', pequeña: 'Pequeña', mediana: 'Mediana', grande: 'Grande' }

const hoy = new Date()
const anioActual = hoy.getFullYear()
const ANIOS_FISCALES = Array.from({ length: 12 }, (_, i) => anioActual - 10 + i)

// ── Centro de Alertas ─────────────────────────────────────────────────────
// Agrega en un solo lugar (ordenado por severidad, no por orden de llegada)
// las alertas que hoy viven dispersas módulo por módulo: salario mínimo,
// vencimiento de Bonificación (Art. 224), préstamos que requieren gestión de
// cobro, empleados fuera de banda salarial y vencimiento de Regalía Pascual.
// Cada fila navega al módulo correspondiente, que conserva el detalle
// completo — este componente es un resumen priorizado, no un duplicado.
export function CentroAlertas() {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa } = useEmpresa()
  const { periodos } = usePeriodos()
  const { prestamos } = usePrestamos()
  const { bandas } = useBandasSalariales()
  const [expandido, setExpandido] = useState(true)

  const alertas = useMemo(() => {
    const items: AlertaItem[] = []

    // ── Salario mínimo bajo ──────────────────────────────────────────────
    const salarioMinimoAplicable = getSalarioMinimoAplicable(empresa)
    const empleadosBajoMinimo = salarioMinimoAplicable
      ? empleadosActivos.filter(e => e.salarioBase < salarioMinimoAplicable)
      : []
    if (empleadosBajoMinimo.length > 0 && salarioMinimoAplicable) {
      const categoriaLabel = empresa.zonaFranca
        ? 'Zona Franca'
        : (empresa.categoriaEmpresa ? `Categoría ${CATEGORIA_LABEL[empresa.categoriaEmpresa]}` : '')
      items.push({
        id: 'salario-minimo',
        severidad: 'danger',
        icon: ShieldAlert,
        titulo: `${empleadosBajoMinimo.length} empleado${empleadosBajoMinimo.length !== 1 ? 's' : ''} por debajo del salario mínimo`,
        descripcion: `${categoriaLabel} — mínimo legal ${formatRD(salarioMinimoAplicable)}/mes`,
        detalle: empleadosBajoMinimo.slice(0, 3).map(e => `${fullName(e)} — ${formatRD(e.salarioBase)}`),
        detalleTotal: empleadosBajoMinimo.length,
        href: '/empleados',
        linkLabel: 'Ir a Empleados',
      })
    }

    // ── Bonificación por Utilidades — vencimiento (Art. 224) ─────────────
    const pendientesBonif = getBonificacionesPendientes(empleados, periodos, empresa.cierreFiscal ?? 'diciembre', ANIOS_FISCALES)
    const alertaBonif = pendientesBonif[0]
    if (alertaBonif && alertaBonif.diasRestantes <= 45) {
      const vencido = alertaBonif.diasRestantes < 0
      items.push({
        id: 'bonificacion',
        severidad: vencido ? 'danger' : 'warning',
        icon: Percent,
        titulo: vencido
          ? `Bonificación ${alertaBonif.anio} vencida hace ${Math.abs(alertaBonif.diasRestantes)} día(s)`
          : `Bonificación ${alertaBonif.anio} vence en ${alertaBonif.diasRestantes} día(s)`,
        descripcion: `Plazo legal de pago (Art. 224) — límite ${alertaBonif.limite.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        href: '/bonificacion',
        linkLabel: 'Ir a Bonificación',
      })
    }

    // ── Regalía Pascual — vencimiento (Art. 219, 20 de diciembre) ────────
    const periodoRegaliaAnio = periodos.find(p => p.tipo === 'regalia' && p.anio === anioActual)
    const regaliaPagada = periodoRegaliaAnio?.estado === 'cerrada'
    const diasParaDic20 = Math.ceil((new Date(anioActual, 11, 20).getTime() - hoy.getTime()) / (1000 * 3600 * 24))
    if (!regaliaPagada && diasParaDic20 <= 30) {
      const vencida = diasParaDic20 < 0
      items.push({
        id: 'regalia',
        severidad: vencida ? 'danger' : 'warning',
        icon: Gift,
        titulo: vencida
          ? `Regalía Pascual ${anioActual} vencida hace ${Math.abs(diasParaDic20)} día(s)`
          : `Regalía Pascual ${anioActual} vence en ${diasParaDic20} día(s)`,
        descripcion: 'Pago obligatorio en la primera quincena de diciembre (Art. 219)',
        href: '/regalia-pascual',
        linkLabel: 'Ir a Regalía Pascual',
      })
    }

    // ── Préstamos que requieren gestión de cobro ─────────────────────────
    const empleadoPorId = new Map(empleados.map(e => [e.id, e]))
    const prestamosGestion = prestamos.filter(p => p.requiereGestionCobro)
    if (prestamosGestion.length > 0) {
      items.push({
        id: 'prestamos',
        severidad: 'warning',
        icon: Wallet,
        titulo: `${prestamosGestion.length} préstamo${prestamosGestion.length !== 1 ? 's' : ''} requiere${prestamosGestion.length !== 1 ? 'n' : ''} gestión de cobro`,
        descripcion: '3 o más cuotas omitidas consecutivas por insuficiencia de fondos',
        detalle: prestamosGestion.slice(0, 3).map(p => empleadoPorId.get(p.empleadoId) ? fullName(empleadoPorId.get(p.empleadoId)!) : 'Empleado'),
        detalleTotal: prestamosGestion.length,
        href: '/prestamos',
        linkLabel: 'Ir a Préstamos',
      })
    }

    // ── Empleados fuera de banda salarial ────────────────────────────────
    if (bandas.length > 0) {
      let fueraDeBanda = 0
      for (const emp of empleadosActivos) {
        const banda = bandas.find(b => normalizarPosicion(b.posicion) === normalizarPosicion(emp.cargo))
        if (!banda) continue
        if (emp.salarioBase < banda.salarioMinimo || emp.salarioBase > banda.salarioMaximo) fueraDeBanda++
      }
      if (fueraDeBanda > 0) {
        items.push({
          id: 'bandas',
          severidad: 'info',
          icon: BarChart3,
          titulo: `${fueraDeBanda} empleado${fueraDeBanda !== 1 ? 's' : ''} fuera de banda salarial`,
          descripcion: 'Salario por debajo del mínimo o por encima del máximo de su posición',
          href: '/bandas-salariales',
          linkLabel: 'Ir a Bandas Salariales',
        })
      }
    }

    return items.sort((a, b) => SEVERIDAD_ORDEN[a.severidad] - SEVERIDAD_ORDEN[b.severidad])
  }, [empleadosActivos, empleados, empresa, periodos, prestamos, bandas])

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-3.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-[#141722] px-5 py-4">
        <div className="relative h-9 w-9 shrink-0">
          <div className="absolute inset-0 rounded-xl bg-emerald-500 blur-md opacity-30" />
          <div
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundImage: 'linear-gradient(135deg, #059669, #34d399)' }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Todo en orden</p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">Sin alertas pendientes en ningún módulo.</p>
        </div>
      </div>
    )
  }

  // Resumen de conteos por severidad, para el subtítulo del header.
  const conteoPorSeveridad = alertas.reduce<Record<Severidad, number>>(
    (acc, a) => ({ ...acc, [a.severidad]: acc[a.severidad] + 1 }),
    { danger: 0, warning: 0, info: 0 },
  )

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="flex w-full items-center justify-between gap-3 bg-gradient-to-br from-white to-zinc-50 dark:from-[#141722] dark:to-[#161a2c] px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0">
            <div className="absolute inset-0 rounded-xl bg-[#1B2980] blur-md opacity-25" />
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundImage: 'linear-gradient(135deg, #1B2980, #2f3fa8)' }}
            >
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Centro de Alertas</span>
              <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2 py-0.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                {alertas.length}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              {(['danger', 'warning', 'info'] as Severidad[]).filter(s => conteoPorSeveridad[s] > 0).map(s => (
                <span key={s} className="flex items-center gap-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full', SEVERIDAD_DOT[s])} />
                  {conteoPorSeveridad[s]} {SEVERIDAD_LABEL[s].toLowerCase()}{conteoPorSeveridad[s] !== 1 ? 's' : ''}
                </span>
              ))}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform ${expandido ? 'rotate-180' : ''}`} />
      </button>
      {expandido && (
        <ul className="divide-y divide-zinc-100 dark:divide-[#1d2035] border-t border-zinc-100 dark:border-[#1d2035]">
          {alertas.map(item => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  'group flex items-start gap-3.5 border-l-2 border-transparent px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]',
                  SEVERIDAD_BORDE[item.severidad],
                )}
              >
                <div className="relative h-9 w-9 shrink-0">
                  <div className={cn('absolute inset-0 rounded-xl blur-md opacity-0 transition-opacity group-hover:opacity-30', SEVERIDAD_HALO[item.severidad])} />
                  <div
                    className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundImage: SEVERIDAD_GRADIENTE[item.severidad] }}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.titulo}</p>
                    <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wide', SEVERIDAD_TEXTO[item.severidad])}>
                      {SEVERIDAD_LABEL[item.severidad]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{item.descripcion}</p>
                  {item.detalle && item.detalle.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.detalle.map((d, i) => (
                        <span key={i} className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2 py-0.5 text-[10.5px] font-medium text-zinc-600 dark:text-zinc-300">
                          {d}
                        </span>
                      ))}
                      {item.detalleTotal && item.detalleTotal > item.detalle.length && (
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium text-zinc-400 dark:text-zinc-500">
                          +{item.detalleTotal - item.detalle.length} más
                        </span>
                      )}
                    </div>
                  )}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1B2980] dark:text-indigo-400">
                    {item.linkLabel}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
