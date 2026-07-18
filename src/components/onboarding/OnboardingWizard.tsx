'use client'

import { useState } from 'react'
import { Building2, Users, UserCircle, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { useEmpresa } from '@/lib/empresa-context'
import { SALARIO_MINIMO } from '@/lib/dominican-labor'
import { formatRD } from '@/lib/utils'
import type { CategoriaEmpresa, CierreFiscal, RangoEmpleados, RolUsuario, SectorEmpresa } from '@/types'

const SECTORES: { value: SectorEmpresa; label: string; descripcion: string }[] = [
  { value: 'oficinas_comercio',    label: 'Oficinas y Comercio',        descripcion: 'Servicios, retail, oficinas administrativas' },
  { value: 'industria_liviana',    label: 'Industria Liviana',          descripcion: 'Manufactura ligera, alimentos, textil' },
  { value: 'industria_pesada',     label: 'Industria Pesada',           descripcion: 'Manufactura pesada, transporte, logística' },
  { value: 'construccion_mineria', label: 'Construcción y Minería',     descripcion: 'Obras, construcción, minería (alto riesgo)' },
]

const RANGOS: { value: RangoEmpleados; label: string; sugerida: CategoriaEmpresa }[] = [
  { value: '1-9',   label: '1 a 9 empleados',    sugerida: 'micro' },
  { value: '10-19', label: '10 a 19 empleados',  sugerida: 'pequeña' },
  { value: '20-49', label: '20 a 49 empleados',  sugerida: 'mediana' },
  { value: '50+',   label: '50 o más empleados', sugerida: 'grande' },
]

const CATEGORIAS: { value: CategoriaEmpresa; label: string; salario: number }[] = [
  { value: 'micro',   label: 'Micro',   salario: SALARIO_MINIMO.microempresas },
  { value: 'pequeña', label: 'Pequeña', salario: SALARIO_MINIMO.pequeñasEmpresas },
  { value: 'mediana', label: 'Mediana', salario: SALARIO_MINIMO.medianaEmpresa },
  { value: 'grande',  label: 'Grande',  salario: SALARIO_MINIMO.grandesEmpresas },
]

const CIERRES_FISCALES: { value: CierreFiscal; label: string; descripcion: string }[] = [
  { value: 'diciembre',  label: '31 de diciembre', descripcion: 'Año calendario — el más común' },
  { value: 'marzo',      label: '31 de marzo',      descripcion: 'Ejercicio abril–marzo' },
  { value: 'junio',      label: '30 de junio',      descripcion: 'Ejercicio julio–junio' },
  { value: 'septiembre', label: '30 de septiembre', descripcion: 'Ejercicio octubre–septiembre' },
]

const ROLES: { value: RolUsuario; label: string; descripcion: string }[] = [
  { value: 'dueño',   label: 'Dueño / Gerente General',        descripcion: 'Visión completa del negocio' },
  { value: 'contador', label: 'Contador / Encargado de Nómina', descripcion: 'Cálculos, TSS e ISR al día' },
  { value: 'rrhh',     label: 'Recursos Humanos',               descripcion: 'Gestión de empleados y expedientes' },
  { value: 'otro',     label: 'Otro',                            descripcion: 'Otra función administrativa' },
]

const INPUT_CLASS =
  'w-full rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#1a1d2e] px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#1B2980] dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-[#1B2980]/10 dark:focus:ring-indigo-500/10 transition-colors'

function OptionCard({
  active, onClick, title, subtitle, extra,
}: { active: boolean; onClick: () => void; title: string; subtitle?: string; extra?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border p-3.5 text-left transition-colors ${
        active
          ? 'border-[#1B2980] dark:border-indigo-500 bg-[#eef0fb] dark:bg-indigo-950/30'
          : 'border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] hover:border-zinc-300 dark:hover:border-[#33395a]'
      }`}
    >
      {active && (
        <div className="absolute right-2.5 top-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1B2980] dark:bg-indigo-500">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      <p className={`text-sm font-semibold ${active ? 'text-[#1B2980] dark:text-indigo-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
        {title}
      </p>
      {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      {extra && <p className="mt-1.5 text-xs font-bold tabular-nums text-[#1B2980] dark:text-indigo-400">{extra}</p>}
    </button>
  )
}

export function OnboardingWizard() {
  const { empresa, guardar } = useEmpresa()
  const [paso, setPaso] = useState(1)

  const [nombre, setNombre]     = useState(empresa.nombre ?? '')
  const [rnc, setRnc]           = useState(empresa.rnc ?? '')
  const [ciudad, setCiudad]     = useState(empresa.ciudad ?? '')
  const [sector, setSector]     = useState<SectorEmpresa | null>(empresa.sectorEmpresa ?? null)
  const [zonaFranca, setZonaFranca] = useState(empresa.zonaFranca ?? false)
  const [cierreFiscal, setCierreFiscal] = useState<CierreFiscal>(empresa.cierreFiscal ?? 'diciembre')

  const [rango, setRango]           = useState<RangoEmpleados | null>(empresa.numeroEmpleadosAprox ?? null)
  const [categoria, setCategoria]   = useState<CategoriaEmpresa | null>(empresa.categoriaEmpresa ?? null)
  const [modalidad, setModalidad]   = useState<'mensual' | 'quincenal'>(empresa.modalidadNomina ?? 'mensual')

  const [rol, setRol] = useState<RolUsuario | null>(empresa.rolUsuario ?? null)

  function elegirRango(r: RangoEmpleados) {
    setRango(r)
    setCategoria(RANGOS.find(x => x.value === r)!.sugerida)
  }

  const paso1Valido = nombre.trim() !== '' && sector !== null
  const paso2Valido = rango !== null && categoria !== null
  const paso3Valido = rol !== null

  function finalizar() {
    if (!rol) return
    guardar({
      ...empresa,
      nombre: nombre.trim(),
      rnc: rnc.trim(),
      ciudad: ciudad.trim(),
      sectorEmpresa: sector ?? undefined,
      zonaFranca,
      cierreFiscal,
      numeroEmpleadosAprox: rango ?? undefined,
      categoriaEmpresa: categoria ?? undefined,
      modalidadNomina: modalidad,
      rolUsuario: rol,
      onboardingCompleto: true,
    })
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-zinc-50 dark:bg-[#0d0f1a] p-6">
      <div className="w-full max-w-xl">

        {/* Progress */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === paso ? 'w-8 bg-[#1B2980] dark:bg-indigo-500' : n < paso ? 'w-4 bg-[#1B2980]/40 dark:bg-indigo-500/40' : 'w-4 bg-zinc-200 dark:bg-[#252840]'
              }`}
            />
          ))}
        </div>
        <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Paso {paso} de 3
        </p>

        {/* Step 1 — Empresa */}
        {paso === 1 && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/40">
                <Building2 className="h-6 w-6 text-[#1B2980] dark:text-indigo-400" />
              </div>
            </div>
            <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">Cuéntanos sobre tu empresa</h1>
            <p className="mt-1.5 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Esto nos permite calcular correctamente el seguro de riesgo laboral (SRL) y el salario mínimo aplicable.
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre de la empresa</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Distribuciones del Caribe, SRL" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">RNC (opcional)</label>
                  <input value={rnc} onChange={e => setRnc(e.target.value)} placeholder="Ej. 101-12345-6" className={INPUT_CLASS} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Ciudad (opcional)</label>
                <input value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Ej. Santo Domingo" className={INPUT_CLASS} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Sector principal de operación</label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SECTORES.map(s => (
                    <OptionCard key={s.value} active={sector === s.value} onClick={() => setSector(s.value)} title={s.label} subtitle={s.descripcion} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={zonaFranca} onChange={e => setZonaFranca(e.target.checked)} className="h-4 w-4 rounded accent-[#1B2980]" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Mi empresa opera bajo régimen de zona franca</span>
              </label>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Cierre de ejercicio fiscal
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {CIERRES_FISCALES.map(c => (
                    <OptionCard key={c.value} active={cierreFiscal === c.value} onClick={() => setCierreFiscal(c.value)} title={c.label} subtitle={c.descripcion} />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  Determina la ventana de la Bonificación por Utilidades y su plazo legal de pago
                  (90–120 días después del cierre, Art. 223/224).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Tamaño y nómina */}
        {paso === 2 && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/40">
                <Users className="h-6 w-6 text-[#1B2980] dark:text-indigo-400" />
              </div>
            </div>
            <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">Tamaño y nómina</h1>
            <p className="mt-1.5 text-center text-sm text-zinc-500 dark:text-zinc-400">
              El salario mínimo legal varía según la categoría de empresa (Resolución 079-2025).
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">¿Cuántos empleados tienes aproximadamente?</label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {RANGOS.map(r => (
                    <OptionCard key={r.value} active={rango === r.value} onClick={() => elegirRango(r.value)} title={r.label} />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Categoría de empresa {rango && <span className="text-zinc-400 dark:text-zinc-600">(sugerida según tu respuesta — puedes cambiarla)</span>}
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {CATEGORIAS.map(c => (
                    <OptionCard key={c.value} active={categoria === c.value} onClick={() => setCategoria(c.value)} title={c.label} extra={formatRD(c.salario)} />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Modalidad de nómina preferida</label>
                <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-[#252840] w-fit">
                  {(['mensual', 'quincenal'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModalidad(m)}
                      className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                        modalidad === m
                          ? 'bg-[#1B2980] text-white'
                          : 'bg-white dark:bg-[#141722] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]'
                      }`}
                    >
                      {m === 'mensual' ? 'Mensual' : 'Quincenal'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Sobre ti */}
        {paso === 3 && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/40">
                <UserCircle className="h-6 w-6 text-[#1B2980] dark:text-indigo-400" />
              </div>
            </div>
            <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">Sobre ti</h1>
            <p className="mt-1.5 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Esto nos ayuda a mostrarte la información más relevante para tu función.
            </p>

            <div className="mt-6">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ROLES.map(r => (
                  <OptionCard key={r.value} active={rol === r.value} onClick={() => setRol(r.value)} title={r.label} subtitle={r.descripcion} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center gap-3">
          {paso > 1 && (
            <button
              type="button"
              onClick={() => setPaso(p => p - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
          )}

          {paso < 3 ? (
            <button
              type="button"
              onClick={() => setPaso(p => p + 1)}
              disabled={paso === 1 ? !paso1Valido : !paso2Valido}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white transition-colors"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizar}
              disabled={!paso3Valido}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1B2980] hover:bg-[#151f66] disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white transition-colors"
            >
              Ir al Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
