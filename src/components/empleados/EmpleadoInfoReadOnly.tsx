'use client'

import {
  X, Building2, Mail, Phone, User, Calendar, CreditCard, Globe, FileText, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmpleadoAvatar } from '@/components/empleados/EmpleadoAvatar'
import { FlagImg } from '@/components/empleados/EmpleadoFormFields'
import { calcularCesantia, calcularPreaviso, getAnosServicio, getDivisorSalarioDiario } from '@/lib/dominican-labor'
import { formatRD, formatDate, formatAnosServicio, fullName, contratoBadgeClass, contratoLabel } from '@/lib/utils'
import { getPais, formatDocNumber, labelTipoDoc, calcularEdad, downloadBase64 } from '@/lib/empleado-form'
import type { Empleado } from '@/types'

// Ficha de empleado de SOLO LECTURA — mismas secciones informativas que el
// tab "Información" del drawer de Empleados (Datos Personales, Documentos,
// Datos Laborales, Derechos estimados), sin ninguna de las acciones que
// mutan datos (suspender, dar de baja, registrar saldo ISR, dependientes).
// Pensada para módulos que solo necesitan CONSULTAR la ficha de un empleado
// (ej. Regalía Pascual) sin ofrecer edición — evita reutilizar el drawer
// completo de Empleados, que mezcla visualización con acciones de mutación.
export function EmpleadoInfoReadOnly({
  empleado, todosEmpleados, onClose,
}: {
  empleado: Empleado
  todosEmpleados: Empleado[]
  onClose: () => void
}) {
  const anos       = getAnosServicio(empleado.fechaIngreso)
  const cesantia   = calcularCesantia(empleado.salarioBase, anos, getDivisorSalarioDiario(empleado))
  const preaviso   = calcularPreaviso(empleado.salarioBase, anos, getDivisorSalarioDiario(empleado))
  const supervisor = todosEmpleados.find(e => e.id === empleado.supervisorId)
  const pais       = empleado.nacionalidad ? getPais(empleado.nacionalidad) : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-xl bg-white dark:bg-[#141722] shadow-2xl animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between bg-[#1B2980] dark:bg-[#111527] px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <EmpleadoAvatar emp={empleado} size="sm" className="ring-2 ring-white/20" />
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{fullName(empleado)}</p>
              <p className="text-[11px] text-indigo-200 leading-tight">{empleado.cargo} · {empleado.departamento}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero strip */}
        <div className="shrink-0 flex items-center gap-5 px-8 py-5 border-b border-zinc-100 dark:border-[#1d2035] bg-gradient-to-r from-slate-50 to-white dark:from-[#1a1d2e] dark:to-[#141722]">
          <EmpleadoAvatar emp={empleado} size="lg" className="ring-4 ring-white dark:ring-[#252840] shadow-md" />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">{fullName(empleado)}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{empleado.cargo} · {empleado.departamento}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={`ring-1 ${contratoBadgeClass(empleado.tipoContrato)}`}>
                {contratoLabel(empleado.tipoContrato)}
              </Badge>
              <Badge variant={empleado.activo ? 'success' : 'neutral'}>
                {empleado.activo ? 'Activo' : 'Inactivo'}
              </Badge>
              {empleado.activo && empleado.suspendido && <Badge variant="warning">Suspendido</Badge>}
              {empleado.activo && empleado.salidaPendiente && <Badge variant="danger">Salida Pendiente</Badge>}
              {pais && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-[#252840] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <FlagImg code={pais.code} className="h-3.5 w-5" /> {pais.nombre}
                </span>
              )}
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatRD(empleado.salarioBase)}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Salario mensual</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{formatAnosServicio(anos)} de antigüedad</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="space-y-6">
            {/* Datos Personales */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Personales</h3>
              <div className="space-y-2.5">
                {pais && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Nacionalidad</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      <FlagImg code={pais.code} /> {pais.nombre}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">{labelTipoDoc(empleado.tipoDocumento)}</span>
                  <span className="text-sm font-medium font-mono text-zinc-800 dark:text-zinc-200">
                    {formatDocNumber(empleado.cedula, empleado.tipoDocumento)}
                  </span>
                </div>
                {empleado.fechaNacimiento && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Nacimiento</span>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {formatDate(empleado.fechaNacimiento)} · {calcularEdad(empleado.fechaNacimiento)} años
                    </span>
                  </div>
                )}
                {empleado.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Correo</span>
                    <a href={`mailto:${empleado.email}`}
                      className="text-sm font-medium text-[#1B2980] dark:text-indigo-400 hover:underline truncate"
                      onClick={e => e.stopPropagation()}>
                      {empleado.email}
                    </a>
                  </div>
                )}
                {empleado.telefono && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Teléfono</span>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{empleado.telefono}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Departamento</span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{empleado.departamento}</span>
                </div>
                {supervisor && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">Supervisor</span>
                    <div className="flex items-center gap-2">
                      <EmpleadoAvatar emp={supervisor} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fullName(supervisor)}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{supervisor.cargo}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Documentos adjuntos */}
            {(empleado.documentoIdentidad || empleado.contratoLaboral) && (
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Documentos</h3>
                <div className="space-y-2">
                  {empleado.documentoIdentidad && empleado.documentoIdentidadNombre && (
                    <button type="button"
                      onClick={() => downloadBase64(empleado.documentoIdentidad!, empleado.documentoIdentidadNombre!)}
                      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors group">
                      <FileText className="h-4 w-4 text-[#1B2980] dark:text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{labelTipoDoc(empleado.tipoDocumento)} — escaneo</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.documentoIdentidadNombre}</p>
                      </div>
                      <Download className="h-3.5 w-3.5 text-zinc-400 group-hover:text-[#1B2980] dark:group-hover:text-indigo-400 shrink-0 transition-colors" />
                    </button>
                  )}
                  {empleado.contratoLaboral && empleado.contratoLaboralNombre && (
                    <button type="button"
                      onClick={() => downloadBase64(empleado.contratoLaboral!, empleado.contratoLaboralNombre!)}
                      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors group">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Contrato Laboral</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{empleado.contratoLaboralNombre}</p>
                      </div>
                      <Download className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-colors" />
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Datos Laborales */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Fecha de Ingreso', value: formatDate(empleado.fechaIngreso) },
                  { label: 'Antigüedad',        value: formatAnosServicio(anos) },
                  { label: 'Salario Mensual',   value: formatRD(empleado.salarioBase) },
                  { label: 'Salario Anual',     value: formatRD(empleado.salarioBase * 12) },
                  { label: 'Banco',             value: empleado.banco ?? '—' },
                  { label: 'N° Cuenta',         value: empleado.numeroCuenta ?? '—' },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase text-zinc-400 dark:text-zinc-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Derechos estimados */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Derechos (Estimado Acumulado)
              </h3>
              <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                Cálculo conforme a Ley 16-92 · Código de Trabajo
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Cesantía estimada', sub: 'Art. 80 — Auxilio de cesantía', value: cesantia,                   color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-950/20',    border: 'border-rose-100 dark:border-rose-900/40' },
                  { label: 'Preaviso',           sub: 'Art. 76 — Desahucio',           value: preaviso,                   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20',  border: 'border-amber-100 dark:border-amber-900/40' },
                  { label: 'Regalía Pascual',    sub: 'Art. 219 — 1/12 anual/mes',     value: empleado.salarioBase / 12,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/40' },
                ].map(r => (
                  <div key={r.label} className={`flex items-center justify-between rounded-lg border ${r.border} ${r.bg} px-4 py-3`}>
                    <div>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{r.sub}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${r.color}`}>{formatRD(r.value)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
