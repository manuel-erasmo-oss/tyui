'use client'

import { Header } from '@/components/layout/Header'
import { SALARIO_MINIMO, TASAS_TSS, TOPE_COTIZABLE } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import { Settings, Info, Building2 } from 'lucide-react'

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
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Parámetro</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Valor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Descripción</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 bg-white">
          {rows.map(row => (
            <tr key={row.label} className="hover:bg-zinc-50">
              <td className="px-5 py-3 font-medium text-zinc-900">{row.label}</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-teal-700">{row.value}</td>
              <td className="px-4 py-3 text-zinc-600 text-xs">{row.descripcion}</td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{row.fuente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header title="Configuración" subtitle="Parámetros fiscales y laborales vigentes" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        <div className="rounded-xl border border-teal-100 bg-teal-50 px-5 py-3.5 flex items-center gap-3">
          <Info className="h-4 w-4 text-teal-500 shrink-0" />
          <p className="text-xs text-teal-700">
            Los parámetros mostrados reflejan la legislación vigente en la República Dominicana.
            Actualice estos valores cuando la DGII, CNSS o el Comité Nacional de Salarios emitan nuevas resoluciones.
          </p>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
              <Settings className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">Tasas TSS — Tesorería de la Seguridad Social</h2>
          </div>
          <ParamTable rows={PARAMS_TSS} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
              <Settings className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">Tramos ISR Asalariados — DGII</h2>
          </div>
          <ParamTable rows={PARAMS_ISR} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">Salarios Mínimos Nacionales — Sector Privado No Sectorizado</h2>
          </div>
          <ParamTable rows={PARAMS_SALARIOS} />
        </section>

        <p className="text-center text-xs text-zinc-400">
          NominaRD v0.1.0 · Parámetros actualizados a 2024 · República Dominicana
        </p>
      </div>
    </div>
  )
}
