'use client'

import { useState } from 'react'
import { Mail, X, Send, Download, CheckCircle2 } from 'lucide-react'
import { useEmpleados } from '@/lib/empleados-context'
import { useEmpresa } from '@/lib/empresa-context'
import {
  enviarComprobante, plantillaComprobanteDeEmpresa, resolverPlantilla, PLACEHOLDERS_COMPROBANTE,
} from '@/lib/comprobante-email'
import type { PlantillaComprobante } from '@/lib/comprobante-email'
import { getAnosServicio, calcularConPeriodo } from '@/lib/dominican-labor'
import { formatRD, fullName, formatDate, BTN_PRIMARY } from '@/lib/utils'
import { labelPeriodo, resultadoRegalia, resultadoBonificacion, descargarComprobantePDF } from '@/lib/nomina-shared'
import type { Empleado, PeriodoNomina, ResultadoNomina } from '@/types'

// Empleados + resultado a mostrar en el modal — para cualquier período ya
// CERRADO (el único estado desde el que se abre este modal, vía "Marcar como
// Pagada" en Gestión de Envíos). Prioriza el snapshot histórico
// (resultadosPorEmpleado) cuando existe — la fuente fidedigna de lo
// realmente pagado, congelada al momento de procesar. Los períodos
// anteriores a ese campo (o sembrados directo como datos demo, sin pasar
// por el flujo real de "Procesar") no lo tienen — para esos se recalcula en
// vivo con calcularConPeriodo, igual criterio ya usado en
// calcularSalarioPromedioUltimos12Meses: si el período trackea quién fue
// procesado se respeta esa membresía, si no se asume que incluyó a todos
// los empleados en nómina.
function filasComprobante(
  periodo: PeriodoNomina, empleados: Empleado[], empleadosEnNomina: Empleado[],
): { empleado: Empleado; resultado: ResultadoNomina }[] {
  const snapshots = periodo.resultadosPorEmpleado
  if (snapshots && Object.keys(snapshots).length > 0) {
    return Object.entries(snapshots).flatMap(([empId, resultado]) => {
      const e = empleados.find(x => x.id === empId)
      return e ? [{ empleado: e, resultado }] : []
    })
  }
  if (periodo.tipo === 'regalia') {
    return Object.entries(periodo.montosRegalia ?? {}).flatMap(([empId, monto]) => {
      const e = empleados.find(x => x.id === empId)
      if (!e) return []
      return [{ empleado: e, resultado: resultadoRegalia(empId, monto, getAnosServicio(e.fechaIngreso)) }]
    })
  }
  if (periodo.tipo === 'bonificacion') {
    return Object.entries(periodo.montosBonificacion ?? {}).flatMap(([empId, monto]) => {
      const e = empleados.find(x => x.id === empId)
      if (!e) return []
      return [{ empleado: e, resultado: resultadoBonificacion(e, monto) }]
    })
  }
  const ajustesPeriodo = periodo.ajustesPorEmpleado ?? {}
  const roster = periodo.empleadosProcesados
    ? periodo.empleadosProcesados.flatMap(id => {
        const e = empleados.find(x => x.id === id)
        return e ? [e] : []
      })
    : empleadosEnNomina
  return roster.map(e => ({ empleado: e, resultado: calcularConPeriodo(e, ajustesPeriodo[e.id] ?? [], periodo) }))
}

export function EnvioComprobantesModal({
  periodo, onClose, onToast,
}: {
  periodo: PeriodoNomina
  onClose: () => void
  onToast: (mensaje: string) => void
}) {
  const { empleados, empleadosEnNomina } = useEmpleados()
  const { empresa } = useEmpresa()
  const [plantillaComprobante, setPlantillaComprobante] = useState<PlantillaComprobante>(plantillaComprobanteDeEmpresa(empresa))
  const [enviadosComprobante, setEnviadosComprobante] = useState<Set<string>>(new Set())

  const periodoLabel = labelPeriodo(periodo)
  const concepto = periodo.tipo === 'regalia'
    ? 'Regalía Pascual'
    : periodo.tipo === 'bonificacion'
      ? 'Bonificación por Utilidades'
      : periodo.tipo === 'quincenal'
        ? `Nómina Quincenal (${periodo.quincena}ª quincena)`
        : 'Nómina Mensual'
  const filas = filasComprobante(periodo, empleados, empleadosEnNomina)
  const fechaPagoTexto = periodo.fechaPago ? formatDate(periodo.fechaPago) : ''

  // Intenta abrir la ventana de correo para un empleado; devuelve si se logró.
  // No asume éxito: el navegador puede bloquear la ventana (ver enviarComprobante).
  function intentarEnviar(emp: Empleado, resultado: ResultadoNomina): boolean {
    if (!emp.email) return false
    const { asunto, cuerpo } = resolverPlantilla(plantillaComprobante, {
      '{nombre}':    fullName(emp),
      '{periodo}':   periodoLabel,
      '{concepto}':  concepto,
      '{neto}':      formatRD(resultado.salarioNeto),
      '{fechaPago}': fechaPagoTexto,
      '{empresa}':   empresa.nombre || 'la empresa',
    })
    const abierto = enviarComprobante({ destinatarioEmail: emp.email, destinatarioNombre: fullName(emp), asunto, cuerpo })
    if (abierto) setEnviadosComprobante(prev => new Set(prev).add(emp.id))
    return abierto
  }

  function handleEnviar(emp: Empleado, resultado: ResultadoNomina) {
    if (!intentarEnviar(emp, resultado)) {
      onToast(`El navegador bloqueó la ventana de correo para ${fullName(emp)} — permite ventanas emergentes o envíalo individualmente`)
    }
  }

  function handleEnviarTodos() {
    const pendientes = filas.filter(f => f.empleado.email && !enviadosComprobante.has(f.empleado.id))
    const bloqueados = pendientes.filter(({ empleado: emp, resultado }) => !intentarEnviar(emp, resultado)).length
    if (bloqueados > 0) {
      onToast(`Tu navegador bloqueó ${bloqueados} de ${pendientes.length} ventanas — envíalas individualmente o permite ventanas emergentes para este sitio`)
    }
  }

  const pendientesEnvio = filas.filter(f => f.empleado.email && !enviadosComprobante.has(f.empleado.id)).length
  const sinCorreo = filas.filter(f => !f.empleado.email).length

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1d2035]">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#1B2980] dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Enviar Comprobantes de Pago — {periodoLabel}
              </h2>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-[11px] text-amber-800 dark:text-amber-300">
              Cielo Cloud no tiene servidor de correo propio todavía: cada "Enviar" abre tu propio
              cliente de correo con el mensaje listo. Descarga el PDF de cada empleado y adjúntalo
              antes de dar clic en enviar desde tu correo.
            </div>

            {/* Plantilla editable */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Asunto</label>
                <input
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-sm focus:border-[#1B2980] focus:outline-none"
                  value={plantillaComprobante.asunto}
                  onChange={e => setPlantillaComprobante(prev => ({ ...prev, asunto: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Cuerpo del correo</label>
                <textarea
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 px-3 py-2 text-xs font-mono focus:border-[#1B2980] focus:outline-none"
                  rows={7}
                  value={plantillaComprobante.cuerpo}
                  onChange={e => setPlantillaComprobante(prev => ({ ...prev, cuerpo: e.target.value }))}
                />
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                Variables disponibles (se reemplazan por cada empleado):{' '}
                {PLACEHOLDERS_COMPROBANTE.map(p => p.token).join(', ')}
              </p>
            </div>

            {/* Lista de empleados */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {pendientesEnvio > 0 ? `${pendientesEnvio} pendiente${pendientesEnvio === 1 ? '' : 's'}` : 'Todos enviados'}
                {sinCorreo > 0 && ` · ${sinCorreo} sin correo registrado`}
              </p>
              <button
                onClick={handleEnviarTodos}
                disabled={pendientesEnvio === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar a Todos ({pendientesEnvio})
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-[#1a1d2e] text-left text-zinc-500 dark:text-zinc-400">
                    <th className="px-3 py-2 font-medium">Empleado</th>
                    <th className="px-3 py-2 font-medium">Correo</th>
                    <th className="px-3 py-2 font-medium text-right">Neto</th>
                    <th className="px-3 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                  {filas.map(({ empleado: emp, resultado }) => (
                    <tr key={emp.id}>
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{fullName(emp)}</td>
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                        {emp.email || <span className="text-rose-500 dark:text-rose-400">Sin correo registrado</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {formatRD(resultado.salarioNeto)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => descargarComprobantePDF(emp, resultado, periodoLabel, empresa)}
                            title="Descargar PDF"
                            className="rounded-lg border border-zinc-200 dark:border-[#252840] p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#252840] transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleEnviar(emp, resultado)}
                            disabled={!emp.email}
                            title={emp.email ? 'Enviar por correo' : 'Empleado sin correo registrado'}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                              enviadosComprobante.has(emp.id)
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-[#1B2980] hover:bg-[#151f66] text-white disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                          >
                            {enviadosComprobante.has(emp.id) ? (
                              <><CheckCircle2 className="h-3.5 w-3.5" /> Abierto</>
                            ) : (
                              <><Send className="h-3.5 w-3.5" /> Enviar</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-[#1d2035] px-6 py-4">
            <button onClick={onClose} className={BTN_PRIMARY}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
