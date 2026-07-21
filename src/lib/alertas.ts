'use client'

import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PeriodoNomina } from '@/types'
import { ShieldAlert, Wallet, Percent, Gift, BarChart3, History, Landmark } from 'lucide-react'
import { useEmpleados } from './empleados-context'
import { useEmpresa } from './empresa-context'
import { usePeriodos } from './periodos-context'
import { usePrestamos } from './prestamos-context'
import { useLiquidaciones } from './liquidaciones-context'
import { useBandasSalariales, normalizarPosicion } from './bandas-salariales-context'
import { useRetribuciones } from './retribuciones-context'
import { getSalarioMinimoAplicable, getBonificacionesPendientes, getRetribucionesPendientes, getRegaliaPendientes } from './dominican-labor'
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
    // El título/descripción solo comunican el ejercicio MÁS urgente
    // (pendientesBonif[0]) — con varios años sin pagar acumulados, los demás
    // quedaban completamente invisibles (un usuario que resuelve el más
    // viejo creía estar al día). Los demás pendientes se listan como chips
    // de detalle, igual patrón ya usado en salario-mínimo/préstamos/pago
    // retroactivo.
    const pendientesBonif = getBonificacionesPendientes(empleados, periodos, empresa.cierreFiscal ?? 'diciembre', ANIOS_FISCALES)
    const alertaBonif = pendientesBonif[0]
    if (alertaBonif && alertaBonif.diasRestantes <= 45) {
      const vencido = alertaBonif.diasRestantes < 0
      const otrosBonif = pendientesBonif.slice(1)
      items.push({
        id: 'bonificacion',
        severidad: vencido ? 'danger' : 'warning',
        icon: Percent,
        titulo: vencido
          ? `Bonificación ${alertaBonif.anio} vencida hace ${Math.abs(alertaBonif.diasRestantes)} día(s)`
          : `Bonificación ${alertaBonif.anio} vence en ${alertaBonif.diasRestantes} día(s)`,
        descripcion: `Plazo legal de pago (Art. 224) — límite ${alertaBonif.limite.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`
          + (otrosBonif.length > 0 ? ` — ${otrosBonif.length} ejercicio(s) más sin pagar` : ''),
        detalle: otrosBonif.slice(0, 3).map(p => `${p.anio}${p.diasRestantes < 0 ? ` — vencida hace ${Math.abs(p.diasRestantes)}d` : ` — vence en ${p.diasRestantes}d`}`),
        detalleTotal: otrosBonif.length,
        href: '/bonificacion',
        linkLabel: 'Ir a Bonificación',
      })
    }

    // ── Regalía Pascual — vencimiento (Art. 219, 20 de diciembre) ────────
    // Barre años anteriores (no solo el actual) — un año sin pagar ya no
    // debe desaparecer de las alertas solo porque el calendario avanzó.
    const pendientesRegalia = getRegaliaPendientes(empleados, periodos, ANIOS_FISCALES)
    const alertaRegalia = pendientesRegalia[0]
    if (alertaRegalia && alertaRegalia.diasRestantes <= 30) {
      const vencida = alertaRegalia.diasRestantes < 0
      const otrasRegalia = pendientesRegalia.slice(1)
      items.push({
        id: 'regalia',
        severidad: vencida ? 'danger' : 'warning',
        icon: Gift,
        titulo: vencida
          ? `Regalía Pascual ${alertaRegalia.anio} vencida hace ${Math.abs(alertaRegalia.diasRestantes)} día(s)`
          : `Regalía Pascual ${alertaRegalia.anio} vence en ${alertaRegalia.diasRestantes} día(s)`,
        descripcion: 'Pago obligatorio en la primera quincena de diciembre (Art. 219)'
          + (otrasRegalia.length > 0 ? ` — ${otrasRegalia.length} año(s) más sin pagar` : ''),
        detalle: otrasRegalia.slice(0, 3).map(p => `${p.anio}${p.diasRestantes < 0 ? ` — vencida hace ${Math.abs(p.diasRestantes)}d` : ` — vence en ${p.diasRestantes}d`}`),
        detalleTotal: otrasRegalia.length,
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
      const otrosRetrib = pendientesRetrib.slice(1)
      items.push({
        id: 'retribuciones',
        severidad: vencido ? 'danger' : 'warning',
        icon: Landmark,
        titulo: vencido
          ? `Retribuciones Complementarias ${MESES_CORTO[alertaRetrib.mes - 1]} ${alertaRetrib.anio} — IR-17 vencido hace ${Math.abs(alertaRetrib.diasRestantes)} día(s)`
          : `Retribuciones Complementarias ${MESES_CORTO[alertaRetrib.mes - 1]} ${alertaRetrib.anio} — IR-17 vence en ${alertaRetrib.diasRestantes} día(s)`,
        descripcion: `Impuesto Sustitutivo 27% por declarar — límite ${alertaRetrib.limite.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`
          + (otrosRetrib.length > 0 ? ` — ${otrosRetrib.length} mes(es) más sin declarar` : ''),
        detalle: otrosRetrib.slice(0, 3).map(p => `${MESES_CORTO[p.mes - 1]} ${p.anio}${p.diasRestantes < 0 ? ` — vencido hace ${Math.abs(p.diasRestantes)}d` : ` — vence en ${p.diasRestantes}d`}`),
        detalleTotal: otrosRetrib.length,
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
    // Agrupa por mes/año calendario (no por período individual) — en
    // modalidad quincenal, un mismo mes son 2 períodos cerrados; evaluarlos
    // por separado duplicaba la misma alerta dos veces para el mismo
    // empleado/mes. Un "gap" real es que falte en TODOS los períodos de ese
    // mes, no en uno de los dos.
    const mesesConPeriodo = new Map<string, PeriodoNomina[]>()
    for (const p of periodosCerrados) {
      const key = `${p.anio}-${p.mes}`
      const grupo = mesesConPeriodo.get(key)
      if (grupo) grupo.push(p); else mesesConPeriodo.set(key, [p])
    }

    const gapsRetroactivos: { nombre: string; periodoLabel: string }[] = []
    for (const gruposDelMes of mesesConPeriodo.values()) {
      if (gruposDelMes.some(p => p.empleadosProcesados === undefined)) continue // algún período de ese mes sin tracking — no se puede evaluar con confianza
      const { mes, anio } = gruposDelMes[0]
      const inicioMes = new Date(anio, mes - 1, 1)
      const finMes = new Date(anio, mes, 0, 23, 59, 59, 999)
      for (const e of empleados) {
        // Excluye si estuvo suspendido en ALGÚN momento dentro de este mes
        // específico — usa el historial completo (historialSuspensiones),
        // no solo el estado actual: un empleado reactivado hace tiempo no
        // debe seguir marcado para siempre por una suspensión ya resuelta
        // en un mes que nada tiene que ver con ella. Fallback a la
        // suspensión vigente (sin historial) para registros previos a este
        // campo.
        const suspendidoEseMes = (e.historialSuspensiones ?? []).some(r => {
          const inicio = new Date(r.fechaInicio)
          const fin = r.fechaFin ? new Date(r.fechaFin) : hoy
          return inicio <= finMes && fin >= inicioMes
        }) || (!!e.suspendido && !!e.fechaSuspension && new Date(e.fechaSuspension) <= finMes && (!e.historialSuspensiones || e.historialSuspensiones.length === 0))
        if (suspendidoEseMes) continue
        const ingreso = new Date(e.fechaIngreso)
        if (ingreso > finMes) continue
        let elegible = e.activo
        if (!elegible) {
          const liq = liquidaciones.find(l => l.empleadoId === e.id)
          elegible = !!liq && new Date(liq.fechaTerminacion) > finMes
        }
        if (!elegible) continue
        const faltaEnTodos = gruposDelMes.every(p => !p.empleadosProcesados!.includes(e.id))
        if (faltaEnTodos) {
          gapsRetroactivos.push({ nombre: fullName(e), periodoLabel: `${MESES_CORTO[mes - 1]} ${anio}` })
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
