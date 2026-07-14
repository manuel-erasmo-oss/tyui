'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useEmpleados } from '@/lib/empleados-context'
import {
  getAnosServicio,
  getDivisorSalarioDiario,
  calcularNomina,
  DIAS_VACACIONES_HASTA_5_ANOS,
  DIAS_VACACIONES_MAS_5_ANOS,
} from '@/lib/dominican-labor'
import { useEmpresa } from '@/lib/empresa-context'
import { formatRD, formatDate, formatAnosServicio, fullName } from '@/lib/utils'
import { CalendarDays, Users, Wallet, AlertCircle, Download } from 'lucide-react'

export default function VacacionesPage() {
  const { empleadosEnNomina } = useEmpleados()
  const { empresa } = useEmpresa()
  const filas = empleadosEnNomina.map(e => {
    const anos            = getAnosServicio(e.fechaIngreso)
    const diasAnuales     = anos >= 5 ? DIAS_VACACIONES_MAS_5_ANOS : DIAS_VACACIONES_HASTA_5_ANOS
    // Fraccional, sin truncar — prorratea el mes en curso proporcionalmente.
    // Math.max(0, …): protege contra fechaIngreso en el futuro (error de
    // captura), que de otro modo produciría antigüedad negativa.
    const mesesServicio   = anos < 1 ? Math.max(0, anos * 12) : ((anos % 1) * 12 || 12)
    // + saldo inicial: empleados con historial previo a Cielo Cloud (migración)
    const diasAcumulados  = Math.max(0, (diasAnuales / 12) * mesesServicio + (e.saldoVacacionesInicial ?? 0))
    const valorDiario     = e.salarioBase / getDivisorSalarioDiario(e)
    const valorAcumulado  = diasAcumulados * valorDiario
    // Las vacaciones son salario ordinario (Art. 178) — llevan AFP/SFS/ISR
    // normales si el monto supera la exención del ISR, igual que al pagarse
    // en Liquidación. Este neto es un ESTIMADO de lo que el empleado
    // recibiría si se le pagara hoy — el monto real se calcula (y puede
    // ajustarse) al momento de pagarlo de verdad.
    const retencionEstimada = calcularNomina({ ...e, salarioBase: valorAcumulado })
    const valorNetoEstimado = retencionEstimada.salarioNeto
    const puedeGozar      = anos >= 1
    return { empleado: e, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, valorNetoEstimado, puedeGozar }
  })

  const totalDias        = filas.reduce((s, f) => s + f.diasAcumulados, 0)
  const totalValor       = filas.reduce((s, f) => s + f.valorAcumulado, 0)
  const totalValorNeto   = filas.reduce((s, f) => s + f.valorNetoEstimado, 0)
  const empleadosAptos   = filas.filter(f => f.puedeGozar).length

  // Exporta exactamente las mismas filas ya calculadas para la tabla en
  // pantalla (mismo desglose, mismo total). Carga la librería bajo demanda.
  async function handleExportar() {
    const { exportarExcel } = await import('@/lib/excel-export')
    const filasExcel = filas.map(({ empleado, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, valorNetoEstimado, puedeGozar }) => [
      fullName(empleado),
      empleado.cedula,
      formatAnosServicio(anos),
      diasAnuales,
      valorDiario,
      Number(diasAcumulados.toFixed(2)),
      Number(valorAcumulado.toFixed(2)),
      Number(valorNetoEstimado.toFixed(2)),
      puedeGozar ? 'Puede gozar' : 'En acumulación',
    ])
    await exportarExcel({
      nombreArchivo: `vacaciones-${new Date().toISOString().slice(0, 10)}`,
      empresa: empresa.nombre,
      rnc: empresa.rnc,
      hojas: [{
        nombre: 'Vacaciones',
        titulo: 'Vacaciones por Empleado',
        subtitulo: 'Art. 177/178 · Código de Trabajo · Ley 16-92 · Neto estimado con AFP/SFS/ISR',
        encabezados: ['Empleado', 'Cédula', 'Antigüedad', 'Días/Año', 'Tarifa Diaria', 'Días Acumulados', 'Valor Bruto', 'Neto Estimado', 'Estado'],
        filas: filasExcel,
        totales: ['TOTAL', '', '', '', '', Number(totalDias.toFixed(2)), Number(totalValor.toFixed(2)), Number(totalValorNeto.toFixed(2)), ''],
        anchos: [26, 16, 14, 10, 14, 16, 16, 16, 16],
        columnasEnteras: [3],
      }],
    })
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <Header
        title="Vacaciones"
        subtitle="Art. 177 · Código de Trabajo · Ley 16-92"
        actions={
          <button
            onClick={handleExportar}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1a1d2e] transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50 dark:bg-[#0d0f1a]">

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Días Acumulados"
            value={`${totalDias.toFixed(1)} días`}
            sub="Total planilla activa"
            icon={CalendarDays}
            iconColor="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          />
          <StatCard
            label="Valor Bruto"
            value={formatRD(totalValor)}
            sub="Días acumulados × tarifa diaria"
            icon={Wallet}
            iconColor="bg-[#eef0fb] text-[#1B2980] dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <StatCard
            label="Neto Estimado"
            value={formatRD(totalValorNeto)}
            sub="Si se pagara hoy — con AFP/SFS/ISR"
            icon={Wallet}
            iconColor="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <StatCard
            label="Empleados con Derecho"
            value={`${empleadosAptos} / ${filas.length}`}
            sub="Completaron 1 año de servicio"
            icon={Users}
            iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-[#1d2035] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vacaciones por Empleado</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              14 días laborables (1–5 años) · 18 días laborables (más de 5 años). Tarifa diaria = salario ÷ 23.83
              (÷ 26 en régimen de trabajo intermitente). Neto estimado con AFP/SFS/ISR (Art. 178) al pagarse.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#1d2035] bg-zinc-50 dark:bg-[#1a1d2e]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Antigüedad</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días/Año</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tarifa Diaria</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Días Acum.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor Bruto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Neto Estimado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#252840]">
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0fb] dark:bg-indigo-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1B2980] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4M10 15h4" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Sin empleados activos</p>
                        <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                          Registra empleados en la sección de Empleados para ver sus vacaciones acumuladas.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filas.map(({ empleado, anos, diasAnuales, diasAcumulados, valorDiario, valorAcumulado, valorNetoEstimado, puedeGozar }) => (
                  <tr key={empleado.id} className="hover:bg-[#eef0fb]/30 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-xs font-bold text-sky-700 dark:text-sky-300">
                          {empleado.nombre[0]}{empleado.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{fullName(empleado)}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingresó: {formatDate(empleado.fechaIngreso)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">{formatAnosServicio(anos)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        diasAnuales === DIAS_VACACIONES_MAS_5_ANOS
                          ? 'bg-[#eef0fb] text-[#151f66] dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-[#1a1d2e] dark:text-zinc-400'
                      }`}>
                        {diasAnuales} días
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatRD(valorDiario)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {diasAcumulados.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatRD(valorAcumulado)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                      {formatRD(valorNetoEstimado)}
                    </td>
                    <td className="px-4 py-3.5">
                      {puedeGozar
                        ? <Badge variant="success">Puede gozar</Badge>
                        : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">En acumulación</span>
                          </div>
                        )
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7cef0] dark:border-[#252840] bg-[#eef0fb] dark:bg-[#1a1d2e]">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#1B2980] dark:text-indigo-400">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-700 dark:text-sky-300">{totalDias.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-500 dark:text-zinc-400">{formatRD(totalValor)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-700 dark:text-sky-300">{formatRD(totalValorNeto)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 px-5 py-4 text-xs text-sky-800 dark:text-sky-300">
          <p className="font-semibold mb-1">Art. 177–179, Código de Trabajo — República Dominicana</p>
          <p>Después de un trabajo continuo no menor de un año, el trabajador tendrá derecho a <strong>un período de vacaciones remuneradas de catorce (14) días laborables</strong>. Después de cinco años de servicio ininterrumpido, el trabajador tendrá derecho a <strong>dieciocho (18) días laborables</strong> de vacaciones. Las vacaciones no pueden ser sustituidas por una compensación en dinero, excepto cuando el contrato termina sin que hayan sido disfrutadas.</p>
          <p className="mt-2">A diferencia de la cesantía/preaviso (indemnizaciones exentas) y de la Regalía Pascual (100% exenta, Art. 219), las vacaciones son salario ordinario continuado (Art. 178) — llevan AFP, SFS e ISR normales si el monto supera la exención del ISR. La columna "Neto Estimado" muestra lo que el empleado recibiría hoy después de esas retenciones.</p>
        </div>
      </div>
    </div>
  )
}
