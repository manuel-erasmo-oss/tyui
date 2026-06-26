'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { SALARIO_MINIMO, TASAS_TSS, TOPE_COTIZABLE } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import { Save, Settings, Info, Building2, FlaskConical, AlertTriangle } from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { Toast } from '@/components/ui/Toast'
import { cargarDatosDemo } from '@/lib/seed-data'
import type { Empresa } from '@/types'

interface ParamRow {
  label: string
  value: string
  descripcion: string
  fuente: string
}

const PARAMS_TSS: ParamRow[] = [
  {
    label: 'AFP Empleado',
    value: `${(TASAS_TSS.afpEmpleado * 100).toFixed(2)}%`,
    descripcion: 'Descuento al empleado para fondo de pensiones',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'AFP Empleador',
    value: `${(TASAS_TSS.afpEmpleador * 100).toFixed(2)}%`,
    descripcion: 'Aporte patronal al fondo de pensiones',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SFS Empleado',
    value: `${(TASAS_TSS.sfsEmpleado * 100).toFixed(2)}%`,
    descripcion: 'Descuento al empleado para salud familiar',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SFS Empleador',
    value: `${(TASAS_TSS.sfsEmpleador * 100).toFixed(2)}%`,
    descripcion: 'Aporte patronal al seguro familiar de salud',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Riesgo Bajo',
    value: `${(TASAS_TSS.srlBajo * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — oficinas/servicios (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Riesgo Medio',
    value: `${(TASAS_TSS.srlMedio * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — industria (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'SRL Riesgo Alto',
    value: `${(TASAS_TSS.srlAlto * 100).toFixed(2)}%`,
    descripcion: 'Seguro de Riesgos Laborales — construcción/minería (solo empleador)',
    fuente: 'CNSS — Ley 87-01',
  },
  {
    label: 'Tope Salario Cotizable',
    value: formatRD(TOPE_COTIZABLE, 0),
    descripcion: '20 veces el salario mínimo del sector privado (grandes empresas)',
    fuente: 'CNSS',
  },
]

const PARAMS_ISR: ParamRow[] = [
  { label: 'Tramo I', value: 'Exento', descripcion: 'Hasta RD$ 416,220.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo II', value: '15%', descripcion: 'RD$ 416,220.01 a RD$ 624,329.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo III', value: '20%', descripcion: 'RD$ 624,329.01 a RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
  { label: 'Tramo IV', value: '25%', descripcion: 'Más de RD$ 867,123.00 anuales', fuente: 'DGII — Ley 11-92' },
]

const PARAMS_SALARIOS: ParamRow[] = [
  { label: 'Grandes Empresas', value: formatRD(SALARIO_MINIMO.grandesEmpresas, 0), descripcion: 'Más de 50 trabajadores o capital > RD$ 2M', fuente: 'Comité Nac. de Salarios 2024' },
  { label: 'Pequeñas Empresas', value: formatRD(SALARIO_MINIMO.pequeñasEmpresas, 0), descripcion: '10 a 49 trabajadores', fuente: 'Comité Nac. de Salarios 2024' },
  { label: 'Microempresas', value: formatRD(SALARIO_MINIMO.microempresas, 0), descripcion: 'Menos de 10 trabajadores', fuente: 'Comité Nac. de Salarios 2024' },
  { label: 'Zona Franca', value: formatRD(SALARIO_MINIMO.zonaFranca, 0), descripcion: 'Trabajadores en zonas francas industriales', fuente: 'Comité Nac. de Salarios 2024' },
]

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-[#252840] bg-zinc-50 dark:bg-[#1a1d2e]">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Parámetro</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Descripción</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-[#1d2035] bg-white dark:bg-[#141722]">
          {rows.map(row => (
            <tr key={row.label} className="hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]">
              <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.label}</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-[#151f66] dark:text-indigo-300">{row.value}</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">{row.descripcion}</td>
              <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs">{row.fuente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10'

const LABEL_CLASS = 'block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1'

export default function ConfiguracionPage() {
  const { empresa, guardar } = useEmpresa()
  const [form, setForm]         = useState<Empresa>(empresa)
  const [showToast, setShowToast] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)

  useEffect(() => {
    setForm(empresa)
  }, [empresa])

  function handleCargarDemo() {
    cargarDatosDemo()
    window.location.reload()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    guardar(form)
    setShowToast(true)
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Configuración" subtitle="Perfil de empresa y parámetros fiscales vigentes" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-50 dark:bg-[#0d0f1a]">

        {/* Company profile card */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
              <Building2 className="h-4 w-4 text-[#1B2980] dark:text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Perfil de la Empresa</h2>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6">
            <form onSubmit={handleSave} className="space-y-4">
              {/* Nombre */}
              <div>
                <label htmlFor="nombre" className={LABEL_CLASS}>Nombre de la empresa</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Distribuciones del Caribe, SRL"
                  className={INPUT_CLASS}
                />
              </div>

              {/* RNC + Ciudad */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rnc" className={LABEL_CLASS}>RNC</label>
                  <input
                    id="rnc"
                    name="rnc"
                    type="text"
                    value={form.rnc}
                    onChange={handleChange}
                    placeholder="Ej. 101-12345-6"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="ciudad" className={LABEL_CLASS}>Ciudad</label>
                  <input
                    id="ciudad"
                    name="ciudad"
                    type="text"
                    value={form.ciudad}
                    onChange={handleChange}
                    placeholder="Ej. Santo Domingo"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label htmlFor="direccion" className={LABEL_CLASS}>Dirección</label>
                <input
                  id="direccion"
                  name="direccion"
                  type="text"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Ej. Av. Winston Churchill #1099, Piantini"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Teléfono + Email */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="telefono" className={LABEL_CLASS}>Teléfono</label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="text"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="Ej. 809-555-1234"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Ej. admin@empresa.com"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Representante Legal */}
              <div>
                <label htmlFor="representanteLegal" className={LABEL_CLASS}>Representante Legal</label>
                <input
                  id="representanteLegal"
                  name="representanteLegal"
                  type="text"
                  value={form.representanteLegal}
                  onChange={handleChange}
                  placeholder="Ej. María García Pérez"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Modalidad de Nómina */}
              <div>
                <label className={LABEL_CLASS}>Modalidad de pago de nómina</label>
                <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840] w-fit">
                  {(['mensual', 'quincenal'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, modalidadNomina: m }))}
                      className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                        (form.modalidadNomina ?? 'mensual') === m
                          ? 'bg-[#1B2980] text-white'
                          : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                      }`}
                    >
                      {m === 'mensual' ? 'Mensual' : 'Quincenal'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  Esta configuración define el tipo de período predeterminado al crear nóminas.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-[#1B2980] px-4 py-2 text-sm font-medium text-white hover:bg-[#151f66] focus:outline-none focus:ring-2 focus:ring-[#1B2980]/40 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Guardar datos
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Demo data loader */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
              <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos de Demostración</h2>
          </div>
          <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-white dark:bg-[#141722] p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Carga un escenario completo de demostración con 7 empleados, 2 préstamos activos y 4 períodos de nómina
              cerrados (Marzo–Junio 2026), calculados conforme a la legislación vigente.
            </p>
            <ul className="mb-4 mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400 list-disc list-inside">
              <li>Carlos Rodríguez — préstamo RD$80,000 (4 cuotas pagadas, saldo RD$53,333.32)</li>
              <li>Ana Martínez — préstamo RD$18,000 (2 cuotas pagadas, saldo RD$12,000)</li>
              <li>Bono de desempeño en Abril para María González (impacto en ISR)</li>
              <li>Comisión en Junio para Luisa Reyes (eleva su base gravable a tramo II)</li>
            </ul>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDemo(true)}
                className="flex items-center gap-2 rounded-lg border border-violet-300 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
              >
                <FlaskConical className="h-4 w-4" />
                Cargar Datos Demo
              </button>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Reemplaza todos los datos actuales. La página se recargará automáticamente.
              </p>
            </div>
          </div>
        </section>

        {/* Confirm demo dialog */}
        {confirmDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in">
            <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 shadow-2xl animate-modal-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿Cargar datos demo?</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Esto reemplazará todos los datos actuales (empleados, préstamos, períodos y empresa)
                    con el escenario de demostración. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDemo(false)}
                  className="rounded-lg border border-zinc-200 dark:border-[#252840] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCargarDemo}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                >
                  Sí, cargar demo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Parámetros Fiscales Vigentes
          </span>
          <div className="flex-1 border-t border-zinc-200 dark:border-[#252840]" />
        </div>

        <div className="rounded-xl border border-teal-100 dark:border-indigo-800/40 bg-[#eef0fb] dark:bg-indigo-950/30 px-5 py-3.5 flex items-center gap-3">
          <Info className="h-4 w-4 text-[#1B2980] dark:text-indigo-300 shrink-0" />
          <p className="text-xs text-[#151f66] dark:text-indigo-200">
            Los parámetros mostrados reflejan la legislación vigente en la República Dominicana.
            Actualice estos valores cuando la DGII, CNSS o el Comité Nacional de Salarios emitan nuevas resoluciones.
          </p>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
              <Settings className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tasas TSS — Tesorería de la Seguridad Social</h2>
          </div>
          <ParamTable rows={PARAMS_TSS} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
              <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tramos ISR Asalariados — DGII</h2>
          </div>
          <ParamTable rows={PARAMS_ISR} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salarios Mínimos Nacionales — Sector Privado No Sectorizado</h2>
          </div>
          <ParamTable rows={PARAMS_SALARIOS} />
        </section>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Cielo Cloud v0.1.0 · Parámetros actualizados a 2024 · República Dominicana
        </p>
      </div>

      {showToast && (
        <Toast
          message="Datos guardados"
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
