'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2, ChevronDown, AlertTriangle, Wallet, Percent, Gift, BarChart3,
} from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import { usePeriodos } from '@/lib/periodos-context'
import { usePrestamos } from '@/lib/prestamos-context'
import { useBandasSalariales, normalizarPosicion } from '@/lib/bandas-salariales-context'
import { getSalarioMinimoAplicable, getBonificacionesPendientes } from '@/lib/dominican-labor'
import { fullName, formatRD } from '@/lib/utils'

type Severidad = 'danger' | 'warning' | 'info'

interface AlertaItem {
  id: string
  severidad: Severidad
  icon: LucideIcon
  titulo: string
  descripcion: string
  detalle?: string[]
  href: string
  linkLabel: string
}

const SEVERIDAD_ORDEN: Record<Severidad, number> = { danger: 0, warning: 1, info: 2 }

const SEVERIDAD_ESTILO: Record<Severidad, string> = {
  danger:  'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  info:    'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
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
        icon: AlertTriangle,
        titulo: `${empleadosBajoMinimo.length} empleado${empleadosBajoMinimo.length !== 1 ? 's' : ''} por debajo del salario mínimo`,
        descripcion: `${categoriaLabel} — mínimo legal ${formatRD(salarioMinimoAplicable)}/mes`,
        detalle: empleadosBajoMinimo.slice(0, 3).map(e => `${fullName(e)} — ${formatRD(e.salarioBase)}`),
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
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-3.5 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Todo en orden — sin alertas pendientes.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Centro de Alertas</span>
          <span className="rounded-full bg-zinc-100 dark:bg-[#1a1d2e] px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {alertas.length}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-400 dark:text-zinc-500 transition-transform ${expandido ? 'rotate-180' : ''}`} />
      </button>
      {expandido && (
        <ul className="divide-y divide-zinc-200 dark:divide-[#252840] border-t border-zinc-100 dark:border-[#1d2035]">
          {alertas.map(item => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${SEVERIDAD_ESTILO[item.severidad]}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{item.descripcion}</p>
                  {item.detalle && item.detalle.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {item.detalle.map((d, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 dark:text-zinc-400">{d}</li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-1.5 inline-block text-xs font-semibold text-[#1B2980] dark:text-indigo-400">
                    {item.linkLabel} →
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
