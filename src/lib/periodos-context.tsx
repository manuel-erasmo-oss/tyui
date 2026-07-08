'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { PeriodoNomina, AjusteLinea, ResultadoNomina } from '@/types'
import { useEmpresaScopedKey } from './empresa-scoped-key'

const KEY = 'cielo-periodos'

// Compara dos períodos del MISMO tipo/quincena por antigüedad (mes/año).
// Se usa para restringir el desposteo solo al período más reciente de su
// serie — reabrir uno intermedio dejaría acumulados inconsistentes en los
// períodos posteriores que ya se generaron a partir de él.
function esMasRecienteQue(a: PeriodoNomina, b: PeriodoNomina): boolean {
  if (a.anio !== b.anio) return a.anio > b.anio
  return a.mes > b.mes
}

export function esPeriodoMasReciente(periodo: PeriodoNomina, periodos: PeriodoNomina[]): boolean {
  const serie = periodos.filter(p => p.tipo === periodo.tipo && p.quincena === periodo.quincena)
  return serie.every(p => p.id === periodo.id || esMasRecienteQue(periodo, p))
}

// El período inmediatamente anterior en la misma serie (tipo/quincena) —
// usado por la auditoría pre-cierre para comparar bruto/neto por empleado.
export function periodoAnterior(periodo: PeriodoNomina, periodos: PeriodoNomina[]): PeriodoNomina | undefined {
  const anteriores = periodos.filter(p =>
    p.tipo === periodo.tipo && p.quincena === periodo.quincena && p.id !== periodo.id &&
    (p.anio < periodo.anio || (p.anio === periodo.anio && p.mes < periodo.mes))
  )
  if (anteriores.length === 0) return undefined
  return anteriores.reduce((a, b) => esMasRecienteQue(a, b) ? a : b)
}

interface PeriodosCtx {
  periodos: PeriodoNomina[]
  generar: (data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>) => PeriodoNomina
  cerrar: (id: string) => void
  eliminar: (id: string) => void
  actualizarAjustes: (periodoId: string, empleadoId: string, ajustes: AjusteLinea[]) => void
  actualizarTotales: (periodoId: string, totales: PeriodoNomina['totales']) => void
  marcarProcesados: (periodoId: string, resultados: Record<string, ResultadoNomina>) => void
  reabrir: (id: string, usuarioEmail: string) => boolean
  marcarPagada: (id: string, fechaPago: string) => void
}

const Ctx = createContext<PeriodosCtx>({
  periodos: [],
  generar: () => { throw new Error('PeriodosProvider not mounted') },
  cerrar: () => {},
  eliminar: () => {},
  actualizarAjustes: () => {},
  actualizarTotales: () => {},
  marcarProcesados: () => {},
  reabrir: () => false,
  marcarPagada: () => {},
})

export function PeriodosProvider({ children }: { children: ReactNode }) {
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([])
  const { key, ready } = useEmpresaScopedKey(KEY)

  useEffect(() => {
    if (!ready) return
    try {
      const raw = localStorage.getItem(key)
      setPeriodos(raw ? JSON.parse(raw) as PeriodoNomina[] : [])
    } catch {
      setPeriodos([])
    }
  }, [key, ready])

  function generar(data: Omit<PeriodoNomina, 'id' | 'fechaGeneracion'>): PeriodoNomina {
    const nuevo: PeriodoNomina = {
      ...data,
      id: `periodo-${Date.now().toString(36)}`,
      fechaGeneracion: new Date().toISOString(),
      ajustesPorEmpleado: data.ajustesPorEmpleado ?? {},
    }
    setPeriodos(prev => {
      const next = [nuevo, ...prev]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    return nuevo
  }

  function cerrar(id: string) {
    setPeriodos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, estado: 'cerrada' as const } : p)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function eliminar(id: string) {
    setPeriodos(prev => {
      const next = prev.filter(p => p.id !== id)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function actualizarAjustes(periodoId: string, empleadoId: string, ajustes: AjusteLinea[]) {
    setPeriodos(prev => {
      const next = prev.map(p =>
        p.id === periodoId
          ? { ...p, ajustesPorEmpleado: { ...(p.ajustesPorEmpleado ?? {}), [empleadoId]: ajustes } }
          : p
      )
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Los totales de un período se calculan a partir de ajustesPorEmpleado
  // (y de cualquier crédito de Saldo ISR aplicado), que viven fuera de este
  // contexto — por eso el recálculo en sí ocurre en nomina/page.tsx y aquí
  // solo se persiste el resultado. Sin esto, totales queda congelado con el
  // valor calculado al crear el período, y nunca refleja ajustes agregados
  // después ni créditos ISR aplicados — visible en las cards de la lista de
  // períodos y en toda Reportería, que leen este campo directamente.
  function actualizarTotales(periodoId: string, totales: PeriodoNomina['totales']) {
    setPeriodos(prev => {
      const next = prev.map(p => p.id === periodoId ? { ...p, totales } : p)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // `resultados` es el ResultadoNomina REAL calculado para cada empleado en
  // el momento exacto de procesarlo — se guarda tal cual en
  // resultadosPorEmpleado como registro histórico inmutable (fuente
  // fidedigna de lo que realmente se pagó), independiente de que el
  // Empleado en vivo cambie después (aumento salarial, etc.). Ver
  // PeriodoNomina.resultadosPorEmpleado en types/index.ts.
  function marcarProcesados(periodoId: string, resultados: Record<string, ResultadoNomina>) {
    setPeriodos(prev => {
      const next = prev.map(p => {
        if (p.id !== periodoId) return p
        const ya = new Set(p.empleadosProcesados ?? [])
        Object.keys(resultados).forEach(id => ya.add(id))
        const procesados = [...ya]
        const todosProcesados = procesados.length >= p.totalEmpleados
        return {
          ...p,
          empleadosProcesados: procesados,
          resultadosPorEmpleado: { ...(p.resultadosPorEmpleado ?? {}), ...resultados },
          estado: todosProcesados ? 'procesada' as const : p.estado,
        }
      })
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Desposteo: devuelve un período 'procesada'/'cerrada' a 'en_proceso'.
  // Restringido al período MÁS RECIENTE de su tipo/quincena (ver
  // esPeriodoMasReciente) y siempre deja rastro en bitacoraDesposteos.
  // Devuelve false sin modificar nada si el período no existe, ya está
  // en_proceso, o no es el más reciente de su serie.
  function reabrir(id: string, usuarioEmail: string): boolean {
    const periodo = periodos.find(p => p.id === id)
    if (!periodo) return false
    if (periodo.estado === 'en_proceso') return false
    if (!esPeriodoMasReciente(periodo, periodos)) return false

    setPeriodos(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p
        const registro = {
          fecha: new Date().toISOString(),
          usuarioEmail,
          estadoAnterior: p.estado,
        }
        return {
          ...p,
          estado: 'en_proceso' as const,
          empleadosProcesados: [],
          // Los snapshots del histórico quedan obsoletos al reabrir — se
          // vuelven a capturar cuando cada empleado se reprocese.
          resultadosPorEmpleado: {},
          bitacoraDesposteos: [...(p.bitacoraDesposteos ?? []), registro],
        }
      })
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    return true
  }

  // Trazabilidad de pago: marca un período cerrado como pagado tras
  // confirmar la transferencia ACH correspondiente.
  function marcarPagada(id: string, fechaPago: string) {
    setPeriodos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, pagada: true, fechaPago } : p)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <Ctx.Provider value={{ periodos, generar, cerrar, eliminar, actualizarAjustes, actualizarTotales, marcarProcesados, reabrir, marcarPagada }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePeriodos = () => useContext(Ctx)
