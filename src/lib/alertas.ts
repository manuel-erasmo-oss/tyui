'use client'

import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ShieldAlert, Wallet, Percent, Gift, BarChart3, History, Landmark } from 'lucide-react'
import { useEmpleados } from './empleados-context'
import { useEmpresa } from './empresa-context'
import { usePeriodos } from './periodos-context'
import { usePrestamos } from './prestamos-context'
import { useLiquidaciones } from './liquidaciones-context'
import { useBandasSalariales, normalizarPosicion } from './bandas-salariales-context'
import { useRetribuciones } from './retribuciones-context'
import { getSalarioMinimoAplicable, getBonificacionesPendientes, getRetribucionesPendientes } from './dominican-labor'
import { fullName, formatRD } from './utils'

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export type Severidad = 'danger' | 'warning' | 'info'

export interface AlertaItem {
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

export const SEVERIDAD_ORDEN: Record<Severidad, number> = { danger: 0, warning: 1, info: 2 }
export const SEVERIDAD_LABEL: Record<Severidad, string> = { danger: 'Urgente', warning: 'Advertencia', info: 'Informativo' }

const CATEGORIA_LABEL: Record<string, string> = { micro: 'Micro', pequeña: 'Pequeña', mediana: 'Mediana', grande: 'Grande' }

const hoy = new Date()
const anioActual = hoy.getFullYear()
const ANIOS_FISCALES = Array.from({ length: 12 }, (_, i) => anioActual - 10 + i)

// ── Centro de Alertas — lógica compartida ─────────────────────────────────
// Agrega en un solo lugar (ordenado por severidad, no por orden de llegada)
// las alertas que hoy viven dispersas módulo por módulo: salario mínimo,
// vencimiento de Bonificación (Art. 224), préstamos que requieren gestión de
// cobro, empleados fuera de banda salarial y vencimiento de Regalía Pascual.
// Extraído de CentroAlertas.tsx para que tanto la campanita de notificaciones
// del Header (visible en toda la app) como cualquier otra superficie futura
// puedan reutilizar exactamente la misma regla sin duplicar lógica.
export function useAlertas(): AlertaItem[] {
  const { empleadosActivos, empleados } = useEmpleados()
  const { empresa } = useEmpresa()
  const { periodos } = usePeriodos()
  const { prestamos } = usePrestamos()
  const { liquidaciones } = useLiquidaciones()
  const { bandas } = useBandasSalariales()
  const { retribuciones } = useRetribuciones()

  return useMemo(() => {
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

    // ── Retribuciones Complementarias — vencimiento IR-17 ────────────────
    // Cadencia mensual (no anual como Bonificación/Regalía), así que el
    // umbral de aviso es más corto (10 días) para no mostrarse "siempre
    // encendida" desde el primer día del mes — solo avisa cuando el
    // vencimiento (día 10 del mes siguiente) ya está cerca o pasado.
    const pendientesRetrib = getRetribucionesPendientes(retribuciones)
    const alertaRetrib = pendientesRetrib[0]
    if (alertaRetrib && alertaRetrib.diasRestantes <= 10) {
      const vencido = alertaRetrib.diasRestantes < 0
      items.push({
        id: 'retribuciones',
        severidad: vencido ? 'danger' : 'warning',
        icon: Landmark,
        titulo: vencido
          ? `Retribuciones Complementarias ${MESES_CORTO[alertaRetrib.mes - 1]} ${alertaRetrib.anio} — IR-17 vencido hace ${Math.abs(alertaRetrib.diasRestantes)} día(s)`
          : `Retribuciones Complementarias ${MESES_CORTO[alertaRetrib.mes - 1]} ${alertaRetrib.anio} — IR-17 vence en ${alertaRetrib.diasRestantes} día(s)`,
        descripcion: `Impuesto Sustitutivo 27% por declarar — límite ${alertaRetrib.limite.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        href: '/retribuciones-complementarias',
        linkLabel: 'Ir a Retribuciones Complementarias',
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

    // ── Posible pago retroactivo pendiente (ingreso tardío) ──────────────
    // Reutiliza la misma señal principal que el reporte "Empleados Sin
    // Ingresos" de Reportería (candidatos = empleados cuya fechaIngreso cae
    // dentro del mes de un período YA CERRADO, cruzando liquidaciones para
    // no excluir a alguien que se desvinculó después de ese mes) — aplicada
    // aquí de forma proactiva sobre TODOS los períodos cerrados, no solo el
    // que el usuario elija revisar manualmente en el reporte. No repite la
    // señal secundaria de "bruto cero" del reporte (exigiría recalcular el
    // resultado histórico completo) — esta alerta se queda con la señal
    // principal y más barata: el empleado ni siquiera figura entre los
    // procesados de ese período.
    const periodosCerrados = periodos.filter(p => p.estado === 'cerrada' && p.tipo !== 'regalia' && p.tipo !== 'bonificacion')
    const gapsRetroactivos: { nombre: string; periodoLabel: string }[] = []
    for (const p of periodosCerrados) {
      if (p.empleadosProcesados === undefined) continue // sin tracking — no se puede evaluar con confianza
      const finMes = new Date(p.anio, p.mes, 0, 23, 59, 59, 999)
      for (const e of empleados) {
        if (e.suspendido) continue
        const ingreso = new Date(e.fechaIngreso)
        if (ingreso > finMes) continue
        let elegible = e.activo
        if (!elegible) {
          const liq = liquidaciones.find(l => l.empleadoId === e.id)
          elegible = !!liq && new Date(liq.fechaTerminacion) > finMes
        }
        if (!elegible) continue
        if (!p.empleadosProcesados.includes(e.id)) {
          gapsRetroactivos.push({ nombre: fullName(e), periodoLabel: `${MESES_CORTO[p.mes - 1]} ${p.anio}` })
        }
      }
    }
    if (gapsRetroactivos.length > 0) {
      items.push({
        id: 'pago-retroactivo',
        severidad: 'warning',
        icon: History,
        titulo: `${gapsRetroactivos.length} caso${gapsRetroactivos.length !== 1 ? 's' : ''} de posible pago retroactivo pendiente`,
        descripcion: 'Empleados con fecha de ingreso dentro de un período ya cerrado, pero ausentes de los procesados de ese período',
        detalle: gapsRetroactivos.slice(0, 3).map(g => `${g.nombre} — ${g.periodoLabel}`),
        detalleTotal: gapsRetroactivos.length,
        href: '/reportes',
        linkLabel: 'Ver "Empleados Sin Ingresos" en Reportería',
      })
    }

    return items.sort((a, b) => SEVERIDAD_ORDEN[a.severidad] - SEVERIDAD_ORDEN[b.severidad])
  }, [empleadosActivos, empleados, empresa, periodos, prestamos, liquidaciones, bandas, retribuciones])
}
