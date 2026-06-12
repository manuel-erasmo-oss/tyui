'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  CreditCard,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { EMPLEADOS } from '@/lib/mock-data'
import {
  calcularCesantia,
  calcularPreaviso,
  getAnosServicio,
} from '@/lib/dominican-labor'
import {
  formatRD,
  formatDate,
  formatCedula,
  formatAnosServicio,
  fullName,
  contratoBadgeClass,
  contratoLabel,
} from '@/lib/utils'
import type { Empleado } from '@/types'

function EmpleadoDrawer({
  empleado,
  onClose,
}: {
  empleado: Empleado
  onClose: () => void
}) {
  const anos = getAnosServicio(empleado.fechaIngreso)
  const cesantia = calcularCesantia(empleado.salarioBase, anos)
  const preaviso = calcularPreaviso(empleado.salarioBase, anos)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-md overflow-y-auto bg-white dark:bg-[#141722] shadow-2xl dark:shadow-none animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 dark:border-[#1d2035] bg-white dark:bg-[#141722] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Ficha del Empleado</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1f2235] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1B2980] text-lg font-bold text-white">
              {empleado.nombre[0]}{empleado.apellido[0]}
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{empleado.cargo} · {empleado.departamento}</p>
              <Badge className={`mt-1 ring-1 ${contratoBadgeClass(empleado.tipoContrato)}`}>
                {contratoLabel(empleado.tipoContrato)}
              </Badge>
            </div>
          </div>

          {/* Datos generales */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Generales</h3>
            <div className="space-y-2.5">
              {[
                { icon: CreditCard, label: 'Cédula',          value: formatCedula(empleado.cedula) },
                { icon: Mail,       label: 'Correo',           value: empleado.email ?? '—' },
                { icon: Phone,      label: 'Teléfono',         value: empleado.telefono ?? '—' },
                { icon: Building2,  label: 'Departamento',     value: empleado.departamento },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <row.icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-28">{row.label}</span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Datos laborales */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Datos Laborales</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Fecha de Ingreso',   value: formatDate(empleado.fechaIngreso) },
                { label: 'Antigüedad',         value: formatAnosServicio(anos) },
                { label: 'Salario Mensual',    value: formatRD(empleado.salarioBase, 0) },
                { label: 'Salario Anual',      value: formatRD(empleado.salarioBase * 12, 0) },
                { label: 'Banco',              value: empleado.banco ?? '—' },
                { label: 'N° Cuenta',          value: empleado.numeroCuenta ?? '—' },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#1a1d2e] px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase text-zinc-400 dark:text-zinc-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Derechos laborales */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Derechos (Estimado Acumulado)
            </h3>
            <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
              Cálculo conforme a Ley 16-92 · Código de Trabajo
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Cesantía estimada</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Art. 80 — Auxilio de cesantía</p>
                </div>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatRD(cesantia, 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Preaviso</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Art. 76 — Desahucio</p>
                </div>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatRD(preaviso, 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Regalía Pascual</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Art. 219 — Provisionada 1/12 anual</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatRD(empleado.salarioBase / 12, 0)}
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">/mes</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function EmpleadosPage() {
  const [busqueda, setBusqueda] = useState('')
  const [departamento, setDepartamento] = useState('Todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Empleado | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const departamentos = ['Todos', ...new Set(EMPLEADOS.map(e => e.departamento))]

  const filtrados = EMPLEADOS.filter(e => {
    const nombre = fullName(e).toLowerCase()
    const cedula = e.cedula
    const matchBusqueda =
      nombre.includes(busqueda.toLowerCase()) ||
      cedula.includes(busqueda) ||
      e.cargo.toLowerCase().includes(busqueda.toLowerCase())
    const matchDepto = departamento === 'Todos' || e.departamento === departamento
    const matchActivo = mostrarInactivos ? true : e.activo
    return matchBusqueda && matchDepto && matchActivo
  })

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Empleados"
        subtitle={`${EMPLEADOS.filter(e => e.activo).length} activos · ${EMPLEADOS.filter(e => !e.activo).length} inactivos`}
        actions={
          <button
            onClick={() => setToast('Abriendo formulario de nuevo empleado…')}
            className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#151f66] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Filtros */}
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula o cargo…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e] dark:text-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] focus:outline-none focus:ring-2 focus:ring-[#1B2980]-100"
            />
          </div>
          <select
            value={departamento}
            onChange={e => setDepartamento(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] dark:text-zinc-200 py-2 pl-3 pr-8 text-sm text-zinc-700 focus:border-[#1B2980] focus:outline-none"
          >
            {departamentos.map(d => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={e => setMostrarInactivos(e.target.checked)}
              className="rounded border-zinc-300 text-[#1B2980]"
            />
            Mostrar inactivos
          </label>
        </div>

        {/* Tabla */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e] text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cédula</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Departamento</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo Contrato</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ingreso</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salario Base</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035]">
                {filtrados.map(emp => (
                  <tr
                    key={emp.id}
                    className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors cursor-pointer"
                    onClick={() => setEmpleadoSeleccionado(emp)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${emp.activo ? 'bg-[#d5d9f4] text-[#151f66] dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-zinc-100 dark:bg-[#1a1d2e] text-zinc-500'}`}
                        >
                          {emp.nombre[0]}{emp.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(emp)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {formatCedula(emp.cedula)}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{emp.departamento}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${contratoBadgeClass(emp.tipoContrato)}`}>
                        {contratoLabel(emp.tipoContrato)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{formatDate(emp.fechaIngreso)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatRD(emp.salarioBase, 0)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={emp.activo ? 'success' : 'neutral'}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      No se encontraron empleados con los filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Mostrando {filtrados.length} de {EMPLEADOS.length} empleados
          </p>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {empleadoSeleccionado && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm" />
          <EmpleadoDrawer
            empleado={empleadoSeleccionado}
            onClose={() => setEmpleadoSeleccionado(null)}
          />
        </>
      )}
    </div>
  )
}
