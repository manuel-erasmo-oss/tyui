# Cielo Cloud Nómina — Contexto de Desarrollo

## Stack y configuración

- **Next.js 14.2.5** · App Router · `output: 'export'` · `basePath: '/tyui'` → GitHub Pages estático
- **TypeScript 5** strict mode · `'use client'` en todas las páginas
- **Tailwind CSS 3** · `darkMode: 'class'`
- **lucide-react** para todos los iconos
- **Inter** con `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'` (globals.css)

## Paleta de colores (sistema de diseño)

| Token | Valor | Uso |
|---|---|---|
| Brand navy | `#1B2980` | Acento principal, nombres en tablas, S. Neto |
| Brand dark | `#151f66` | Hover del brand |
| Brand light | `#eef0fb` | Fondos de footer, KPI cards suaves |
| Dark card | `#141722` | Fondo de cards en dark mode |
| Dark page | `#0d0f1a` | Fondo de página en dark mode |
| Dark secondary | `#1a1d2e` | Fondos secundarios dark |
| Dark border | `#252840` | Bordes dark |

**Regla de tablas**: mínimo color. Solo S. Neto va en `text-[#1B2980]`. Todos los demás valores numéricos van en `text-zinc-500` (neutral). Los nombres de empleados van en `text-[#1B2980]` con cédula debajo en `text-zinc-400`.

## Legislación dominicana implementada

### Motor de nómina (`src/lib/dominican-labor.ts`)

| Concepto | Tasa / Valor | Base legal |
|---|---|---|
| AFP Empleado | 2.87% | Ley 87-01 |
| AFP Empleador | 7.10% | Ley 87-01 |
| SFS Empleado | 3.04% | Ley 87-01 |
| SFS Empleador | 7.09% | Ley 87-01 |
| SRL Categoría I | 1.10% | CNSS (oficinas y comercio) |
| SRL Categoría II | 1.15% | CNSS (industria liviana) |
| SRL Categoría III | 1.20% | CNSS (industria pesada) |
| SRL Categoría IV | 1.30% | CNSS (construcción y minería, alto riesgo) |
| Infotep | 1.00% (solo empleador) | Ley 116-80 |
| Salario mínimo cotizable TSS | RD$23,223.00 | Resolución 079-2025 CNSS (vigente 01-feb-2026) |
| Tope cotizable AFP | RD$464,460 | 20 × salario mínimo cotizable TSS |
| Tope cotizable SFS | RD$232,230 | 10 × salario mínimo cotizable TSS |
| Tope cotizable SRL | RD$92,892 | 4 × salario mínimo cotizable TSS |
| **Dep. SFS adicional** | **RD$1,919.78/mes fijo** | **Resolución 624-02 CNSS (vigente 2024-2025)** |
| ISR tramo 1 | 0% hasta RD$416,220 anual | DGII Ley 11-92 art. 296 |
| ISR tramo 2 | 15% hasta RD$624,329 | DGII Ley 11-92 |
| ISR tramo 3 | 20% hasta RD$867,123 (fijo RD$31,216.00) | DGII Ley 11-92 |
| ISR tramo 4 | 25% sobre exceso (fijo RD$79,776.00) | DGII Ley 11-92 |
| Semana laboral | 44 horas | Art. 147 Código de Trabajo |
| H.E. 35% | tarifa hora × 1.35 | Art. 203 Código de Trabajo |
| H.E. 100% | tarifa hora × 2.00 | Art. 203 (feriados) |
| Vacaciones ≤5 años | 14 días laborables | Art. 177 Código de Trabajo |
| Vacaciones >5 años | 18 días laborables | Art. 177 Código de Trabajo |
| Regalía Pascual | salarioBase / 12 | Art. 219 Código de Trabajo |
| Cesantía 3–6 meses | 6 días | Art. 80 Ley 16-92 |
| Cesantía 6–12 meses | 13 días | Art. 80 Ley 16-92 |
| Cesantía 1–5 años | 21 días/año | Art. 80 Ley 16-92 |
| Cesantía 5+ años | 23 días/año (sin tramo adicional) | Art. 80 Ley 16-92 |
| Preaviso 3–6 meses | 7 días | Art. 76 Ley 16-92 |
| Preaviso 6–12 meses | 14 días | Art. 76 Ley 16-92 |
| Preaviso 12+ meses | 28 días fijo (nunca 45) | Art. 76 Ley 16-92 |
| Salario mínimo grandes empresas | RD$29,988.00 | Resolución 079-2025 (vigente 01-feb-2026) |
| Salario mínimo mediana empresa | RD$27,489.60 | Resolución 079-2025 (vigente 01-feb-2026) |
| Salario mínimo pequeñas empresas | RD$18,421.20 | Resolución 079-2025 (vigente 01-feb-2026) |
| Salario mínimo microempresas | RD$16,993.20 | Resolución 079-2025 (vigente 01-feb-2026) |
| Salario mínimo zona franca | RD$15,800 | sin cambios — resolución distinta |

### Quincenal
- 1ª quincena: bruto/2, TSS/2, **ISR = 0** (anticipo — práctica estándar pymes DR)
- 2ª quincena: bruto/2, TSS/2, ISR mensual completo (liquidación)
- Dep. SFS quincenal: **RD$959.89/quincena** (RD$1,919.78 / 2), pre-cargado al crear período

## Tipos clave (`src/types/index.ts`)

```typescript
export type EstadoPeriodo = 'en_proceso' | 'procesada' | 'cerrada'

export type ParentescoDependiente =
  | 'hijo_mayor_18_no_estudiante'   // Hijo/Hijastro +18 no estudiante
  | 'hijo_mayor_21'                  // Hijo/Hijastro +21 años
  | 'padre_titular'
  | 'madre_titular'
  | 'padre_conyuge'
  | 'madre_conyuge'

export interface Dependiente {
  id: string
  nombre: string
  apellido: string
  cedula?: string
  parentesco: ParentescoDependiente
  fechaNacimiento?: string
  // NO tiene cuotaMensual — se calcula siempre con cuotaDependienteSFS()
}

export interface ParametrosNomina {
  diasTrabajados?: number
  diasLaborablesMes?: number
  horasExtras35?: number
  horasExtras100?: number
  bonificaciones?: number
  comisiones?: number
  sfsDependientes?: number    // ← primer clase, separado de otrosDescuentos
  otrosDescuentos?: number
  categoriaRiesgo?: CategoriaRiesgoSRL
}

// ResultadoNomina tiene sfsDependientes como campo propio
// (entre isrMensual y otrosDescuentos)
```

## Arquitectura de módulos

### `src/app/nomina/page.tsx`
- Vista lista de períodos → vista detalle (misma página, estado `periodoAbierto`)
- `calcularConAjustes(empleado, ajustes, tipo, quincena)` — función local que separa:
  - `sfsDependientes`: ajustes con `concepto === 'dependiente_sfs'`
  - `otrosDescuentos`: solo `prestamo` + `otro_descuento` (dep SFS ya NO va aquí)
- Al crear período: pre-carga préstamos activos Y dependientes SFS como `AjusteLinea[]`
- Tabla principal: columnas Empleado · Ajustes · S.Bruto · AFP+SFS · ISR · **Dep. SFS** · S.Neto · Costo Emp.
- Modal comprobante: renglón "SFS Dep. Adicionales" en sección Descuentos
- CSV exportado incluye columna "SFS Dep."
- Footer de totales: `bg-[#eef0fb]` (brand light-indigo, NO negro)
- Estado `en_proceso` → checkboxes por empleado + botón "Procesar" individual + "Procesar Todo"
- Previene períodos duplicados (mismo tipo/mes/año/quincena)

### `src/app/empleados/page.tsx`
- Drawer lateral con **3 tabs**: `'info' | 'dependientes' | 'historial'`
- Tab **Dependientes Adicionales SFS**: CRUD completo, cuota fija mostrada como read-only (RD$1,919.78)
- Tab **Historial Nómina**: períodos donde `fechaIngreso <= fechaGeneracion`; KPIs YTD (Bruto, Neto, ISR); tabla con columnas S.Bruto · AFP+SFS · ISR · **Dep. SFS** · S.Neto · Estado
- `calcularConAjustes` propio (igual lógica que nomina/page.tsx — separar dep_sfs)

### Contextos
- `usePeriodos` → `generar`, `cerrar`, `eliminar`, `actualizarAjustes`, `marcarProcesados`
- `marcarProcesados(periodoId, empleadoIds[])` → agrega IDs a `empleadosProcesados`, auto-avanza a `'procesada'` cuando todos están procesados
- `useEmpleados`, `useEmpresa`, `usePrestamos`

## UI — Componentes y animaciones

```css
/* globals.css */
@keyframes modal-in  { from { opacity:0; transform: scale(0.95) translateY(8px); } }
@keyframes backdrop-in { from { opacity:0; } }
@keyframes toast-in  { from { opacity:0; transform: translateY(12px); } /* spring */ }
@keyframes toast-out { from { opacity:1; } to { opacity:0; transform: translateY(8px); } }
```

- Sidebar: logo SVG wordmark "Cielo Cloud" con isotipo
- StatCards: sin hover shadow (eliminado)
- Empty states: ilustración con icono en `bg-[#eef0fb]` + texto descriptivo

## Principios de diseño (no negociables)

1. **Mínimo color en tablas** — un solo acento (brand navy en S. Neto y nombres), resto zinc-500
2. **No duplicar datos entre Dashboard y Reportería**
3. **No TailAdmin ni CSS externo** — el sistema de diseño es propio y coherente
4. **Tabular nums** en todas las celdas numéricas (`font-variant-numeric: tabular-nums lining-nums`)
5. **Footers brand light** (`bg-[#eef0fb]`), nunca negro/zinc-950

## Backlog de Nómina — Análisis de Guía Pública SPN Software

Fuente: guía pública de documentación (`spn.com.do/guia-spn/`) de SPN Software, un
ERP de nómina/RRHH dominicano maduro. Se analizaron 86 documentos técnicos
enfocados exclusivamente en **nómina** (RRHH queda para una fase posterior).

**Regla ética aplicada**: los parámetros legales (tasas, fórmulas, topes) son de
dominio público y se replican tal cual. Los conceptos de producto/funcionalidad
de SPN se toman solo como referencia de alcance — todo lo listado abajo se debe
diseñar e implementar con arquitectura, UI y redacción propias de Cielo Cloud,
nunca copiando texto, pantallas o formatos de SPN.

### ⚠️ Auditar en el motor actual (posibles imprecisiones, no solo features nuevas)

1. ~~Asistencia Económica (Art. 82)~~ — **revisado y confirmado intencional.**
   El motivo `vencimiento_contrato` en Liquidación usa Asistencia Económica a
   propósito, siguiendo el mismo enfoque práctico documentado por SPN Software,
   aunque el texto estricto del Art. 82 se refiera a incapacidad/muerte/quiebra.
   No requiere cambio.
2. ~~Base de cálculo de Cesantía/Preaviso~~ — **implementado.**
   `calcularSalarioPromedioUltimos12Meses()` en `dominican-labor.ts` promedia
   el `totalBruto` real de los períodos `procesada`/`cerrada` de los últimos 12
   meses (incluye comisiones/horas extra habituales), con piso en `salarioBase`
   (nunca paga menos que el salario contractual). Aplicado a Cesantía, Preaviso
   y Asistencia Económica en `liquidacion/page.tsx`; Vacaciones y Regalía siguen
   usando `salarioBase` actual. La UI muestra una nota de transparencia cuando
   el promedio supera el salario base.
3. ~~Orden de deducción por ausentismo~~ — **revisado, sin bug de cálculo.**
   El mecanismo correcto ya existe (`diasTrabajados` reduce `salarioBruto`
   ANTES del cálculo de ISR). El riesgo real era de uso: cargar una ausencia
   como ajuste `otro_descuento` sí resta del neto después de ISR. Se agregó un
   aviso en el formulario de ajustes de `nomina/page.tsx` que advierte esto
   cuando se selecciona "Otro Desc.".
4. ~~Salario diario en liquidación <1 año~~ — **implementado.** `mesesCicloVac`
   ya no trunca a meses completos (`Math.floor`) — ahora es un valor fraccional
   continuo que prorratea el mes en curso proporcionalmente, consistente con
   cómo ya se calculaba `mesesCalendario` para Regalía.
5. ~~Divisor de días trabajados (23.83 vs 30 vs 26)~~ — **resuelto con
   aclaración del usuario.** El divisor 26 no es un criterio arbitrario en
   conflicto — es específico del **régimen de trabajo intermitente**
   (Resolución 04-93 MdT: porteros, serenos, guardianes, ascensoristas,
   mozos/camareros, barberos/manicuristas, empleados de bombas de gasolina;
   jornada de hasta 10h/día y 60h/semana sin generar horas extras bajo esos
   umbrales). Se agregó `Empleado.regimenIntermitente` (toggle en el
   formulario de empleado, con nota legal) y `getDivisorSalarioDiario()` en
   `dominican-labor.ts`: usa 23.83 para régimen ordinario, 26 para régimen
   intermitente. Aplicado en `calcularNomina` (vacaciones mensuales),
   `liquidacion/page.tsx`, `vacaciones/page.tsx` y también en
   `calcularCesantia`/`calcularPreaviso`/`calcularAsistenciaEconomica`
   (corrección posterior: el salario diario de estas 3 prestaciones también
   debe salir del divisor laboral 23.83/26, NO de 30 días calendario — el ÷30
   inicial era incorrecto, corregido con segunda aclaración del usuario).
   `nomina/page.tsx` avisa cuando se cargan horas extra a un empleado en
   régimen intermitente, recordando que solo cuenta el exceso sobre 10h/día o
   60h/semana, no los umbrales ordinarios.
6. ~~Práctica de ISR quincenal~~ — **revisado y confirmado correcto.** La
   retención de ISR depende del ingreso gravable de TODO el mes, que no se
   conoce completo hasta que el mes cierra — por eso se calcula y retiene en
   la 2ª quincena (con el mes ya cerrado), no prorrateado a ciegas entre
   ambas. En nómina mensual no aplica el dilema porque el pago es único e
   inmediato. Confirmado con el usuario; no requiere cambio.
7. ~~Topes TSS derivados del salario mínimo vigente~~ — **confirmado correcto.**
   `TOPE_COTIZABLE_AFP/SFS/SRL` ya son expresiones derivadas de
   `SALARIO_MINIMO_COTIZABLE_TSS` (no valores fijos independientes) — se
   recalculan automáticamente si ese valor cambia. Sin acción necesaria.

## Saldos Iniciales — empleados con historial previo a Cielo Cloud

Toda empresa que adopta Cielo Cloud llega con empleados que ya tienen antigüedad
real (3, 10 años). La antigüedad (`getAnosServicio`, tramos de cesantía/preaviso,
14 vs 18 días de vacaciones) ya funciona bien porque parte de `fechaIngreso` real,
no de la fecha de alta en el sistema. Lo que sí requería solución (implementado):

- **`Empleado.saldoVacacionesInicial`** (días) — se suma al cálculo de días
  acumulados en `vacaciones/page.tsx` y `liquidacion/page.tsx`, en vez de asumir
  que nunca se ha disfrutado ninguna vacación.
- **`Empleado.regaliaPagadaEsteAnio`** (RD$) — se resta (piso en 0) del acumulado
  de Regalía Pascual en `regalia-pascual/page.tsx` y de la regalía proporcional
  en `liquidacion/page.tsx`, para no sobreestimar lo pendiente ni arriesgar pago
  doble si la empresa migra a mitad de año.
- **`Empleado.salarioHistoricoReferencia`** (RD$) — usado por
  `calcularSalarioPromedioUltimos12Meses()` como sustituto del salario base
  SOLO mientras el empleado no acumule 12 meses reales de nómina procesada en
  Cielo Cloud (después se recalcula con datos reales del propio sistema).
- Formulario de empleado: sección "Saldos Iniciales" con detección automática
  (aviso visual) cuando `fechaIngreso` es de hace más de 45 días — sugiere que
  es una migración, no una contratación nueva.

**Fase 2 (implementado)**: **Asistente Guiado**
(`src/components/carga-inicial/AsistenteGuiado.tsx`) — recorre los empleados
activos con `saldosInicialesRevisado !== true` uno a uno (lista reactiva vía
`useMemo` sobre `empleadosActivos`, con "X de Y" estable gracias a un total
capturado en el primer render de la sesión), pidiendo los 3 datos de saldos
iniciales o permitiendo marcar "empleado nuevo, no aplica". Estados de fin:
"Todo al día" (nada pendiente) y "Completado" (recorrido de la sesión
terminado). También permite **registrar un empleado nuevo desde el propio
asistente** (botón "Agregar empleado nuevo", visible en todos los estados,
no solo cuando no hay ningún empleado en el sistema) — usa el mismo
formulario completo del módulo de Empleados (`EmpleadoFormFields`, ver
"Integración y rediseño" abajo), con los campos obligatorios/opcionales
idénticos, y marca `saldosInicialesRevisado: true` al guardar. Corrige el
callejón sin salida original: una cuenta recién creada sin empleados
mostraba "Todo al día" sin forma de cargar el primer empleado.
**Fase 3 (implementado)**: **Importador de Excel**
(`src/components/carga-inicial/ImportadorExcel.tsx`) para migraciones
masivas, flujo de 3 pasos:
1. Descarga de plantilla `.xlsx` (vía `xlsx`, mismo patrón que
   `src/lib/excel-export.ts`) con las 10 columnas exactas + 2 filas de ejemplo.
2. Carga del archivo lleno (`.xlsx`/`.xls`/`.csv`), parseo con
   `XLSX.read`/`sheet_to_json`, tratado siempre como datos (nunca ejecuta
   fórmulas/macros).
3. Vista previa fila por fila con acción detectada automáticamente por cédula
   (existente → "Actualizar saldos" solo en los 3 campos de saldos iniciales;
   nueva → "Crear empleado nuevo" con validación de los campos obligatorios) y
   estado ✅/❌ con el motivo exacto del error; confirmación aplica solo las
   filas válidas y marca `saldosInicialesRevisado: true` en cada una.

**Integración y rediseño (implementado)** — feedback de producto: Carga
Inicial no debía sentirse como un módulo aislado ni verse repetitivo frente
al resto del sistema. Cambios:
- `src/components/carga-inicial/ConfiguracionInicialFlow.tsx` — componente
  compartido que reemplaza la antigua página standalone `/carga-inicial`
  (eliminada, junto con su entrada en el Sidebar). Contiene el selector de
  modo (Asistente Guiado / Importador Excel) + una franja de estadísticas
  (`divide-x`, tipografía editorial) en vez de 3 `StatCard` repetidas.
- Ahora vive embebido como sección **"Configuración Inicial"** dentro de
  `/configuracion` (mismo patrón de sección que "Perfil de la Empresa"), y
  también se reutiliza en el prompt post-onboarding (ver abajo) — un solo
  componente, dos superficies.
- **Lenguaje visual premium** aplicado a esta feature específicamente (no al
  resto del sistema, que sigue el principio de mínimo color en tablas):
  badges de icono `rounded-2xl` con gradiente `from-[#1B2980] to-[#2f3fa8]` +
  halo (`blur-lg`/`blur-xl` del mismo color detrás), cards con
  `hover:-translate-y-0.5` y sombra tintada de marca, stepper numerado con
  círculos conectados (en vez de texto "1. Paso / 2. Paso") en
  `ImportadorExcel`, y CTAs con gradiente + `shadow-lg shadow-[#1B2980]/25`.
- **Prompt post-onboarding** (`src/components/onboarding/PromptConfiguracionInicial.tsx`):
  pantalla completa (mismo tratamiento visual que `OnboardingWizard`) que se
  muestra una sola vez, justo después de terminar el onboarding, preguntando
  si la empresa ya operaba antes de Cielo Cloud — lleva directo al flujo de
  Configuración Inicial o permite posponerlo. Controlado por el nuevo campo
  `Empresa.configuracionInicialOfrecida` (se marca `true` al resolver, para
  no repetir el prompt en sesiones futuras); cableado en `RouteGuard.tsx`
  justo después del gate de `needsOnboarding`, en ambas ramas
  (`FIREBASE_ENABLED` on/off). La cuenta admin (`esAdmin`) omite este gate,
  igual que omite el onboarding.

**Formulario de empleado extraído a componente compartido (implementado)** —
para que el Asistente Guiado pudiera registrar empleados nuevos con **toda**
la información que pide el módulo de Empleados (no una versión reducida),
se extrajo el formulario completo de `src/app/empleados/page.tsx`
(antes ~700 líneas duplicables) a tres módulos reutilizables:
- `src/lib/empleado-form.ts` — lógica pura: tipo `EmpForm`, `EMPTY_EMP_FORM`,
  `toEmpForm`/`formToEmpleado` (conversión hacia/desde `Empleado`,
  `formToEmpleado` ahora recibe `sectorEmpresa` como parámetro en vez de leer
  `useEmpresa()` internamente), `validateEmpForm` (antes un `validate()`
  interno del modal), catálogos (`BANCOS`, `DOC_TIPOS`, `PAISES`) y helpers
  (`getPais`, `formatDocNumber`, `labelTipoDoc`, `calcularEdad`,
  `downloadBase64`).
- `src/components/empleados/EmpleadoAvatar.tsx` — avatar con foto/iniciales,
  usado en tablas, drawer y selectores de supervisor.
- `src/components/empleados/EmpleadoFormFields.tsx` — el cuerpo del
  formulario en sí (Foto de Perfil, Datos Personales, Documento de
  Identidad, Datos Laborales, Saldos Iniciales, Datos Bancarios, Contrato
  Laboral) sin el chrome de ventana flotante (eso se quedó en
  `EmpleadoFormModal` dentro de `empleados/page.tsx`, que ahora solo
  renderiza `<EmpleadoFormFields wide={isMax} .../>`). Prop `wide` reemplaza
  el antiguo toggle `isMax` para controlar la densidad del grid.
- `AsistenteGuiado.tsx` reutiliza estas mismas piezas para su modo de alta
  ("Registrar empleado nuevo"), garantizando que un empleado creado desde
  el asistente tenga exactamente los mismos campos, validaciones y valor
  por defecto de `categoriaRiesgo` que uno creado desde `/empleados` — un
  único formulario, sin divergencia entre los dos puntos de entrada.

### 🔴 Alta prioridad — brechas reales confirmadas

- ~~Desposteo de nómina~~ — **implementado.** `usePeriodos.reabrir(id, usuarioEmail)`
  (`src/lib/periodos-context.tsx`) devuelve un período `procesada`/`cerrada` a
  `en_proceso`, limpiando `empleadosProcesados` para que se puedan reprocesar
  los empleados. Restringido al período **más reciente** de su mismo
  `tipo`/`quincena` vía `esPeriodoMasReciente()` (compara mes/año contra toda
  la serie, sin importar el estado de cada uno — evita reabrir un período
  intermedio mientras uno posterior ya existe). Cada reapertura queda en
  `PeriodoNomina.bitacoraDesposteos[]` (fecha, `usuarioEmail`, estado
  anterior) — el sistema no tiene roles de acceso multiusuario (`RolUsuario`
  en `Empresa` es solo cosmético) para restringir la acción a nivel de
  permisos, así que la salvaguarda real es la confirmación explícita + este
  rastro auditable. UI en `nomina/page.tsx`: botón "Reabrir" (ícono
  `Unlock`, ámbar) junto a Cerrar/Eliminar en la vista de lista, visible solo
  cuando el período no está `en_proceso` y es el más reciente de su serie;
  ícono de reloj con tooltip cuando ya tiene reaperturas registradas.
- ~~Auditoría pre-cierre~~ — **implementado.** Cuando la acción de "Procesar"
  completaría el período (pasaría de `en_proceso` a `procesada` — se detecta
  comparando los ids a procesar contra `noProcessados`/`pendientes`), se
  intercepta con un modal (`nomina/page.tsx`) en vez de procesar directo:
  compara bruto por empleado contra el período anterior de la misma serie
  (`periodoAnterior()`, recalculado con `calcularConAjustes` sobre los
  ajustes históricos — mismo enfoque que ya usa "Historial Nómina"), marca
  neto negativo, descuentos discrecionales (préstamo/otro_descuento) que
  superan 30% del bruto (regla de negocio interna, rotulada como tal en la
  UI — no es un tope establecido por el Código de Trabajo), empleados nuevos
  este mes (por `fechaIngreso`), y empleados desvinculados recientemente
  (cruzando `RegistroLiquidacion.fechaTerminacion` contra el mes actual/
  anterior). Botón "Continuar y procesar" para confirmar. **No implementado
  todavía**: cambios de cuenta bancaria (requeriría guardar un snapshot
  histórico de banco/cuenta por período, que hoy no existe).
- ~~Trazabilidad de pago post-cierre~~ — **implementado.**
  `usePeriodos.marcarPagada(id, fechaPago)` agrega `PeriodoNomina.pagada` +
  `fechaPago`. Botón "Marcar como pagada" (ícono `Wallet`) en periodos
  `cerrada`, badge verde con fecha una vez confirmado. **No implementado
  todavía**: la validación cruzada contra el archivo ACH generado, porque
  depende del "Validador de archivo de transferencia bancaria (ACH)" (otra
  brecha de este mismo backlog, aún sin construir) — no hay archivo ACH que
  validar todavía.
  **Extensión — envío de comprobantes por correo (implementado):** al marcar
  un período como pagado (o después, vía el enlace "Comprobantes" que queda
  visible) se abre un modal (`nomina/page.tsx`) con una plantilla de
  correo **editable** (asunto + cuerpo, con variables `{nombre}`,
  `{periodo}`, `{concepto}`, `{neto}`, `{fechaPago}`, `{empresa}` que se
  sustituyen por empleado) y la lista de empleados con botones de envío
  **individual y masivo** ("Enviar a Todos"). La app no tiene backend
  (`output: 'export'`, sin servidor de correo propio), así que el "envío" de
  hoy es una implementación intencionalmente aislada en
  `src/lib/comprobante-email.ts` (`enviarComprobante`) que abre el cliente
  de correo del propio usuario vía `mailto:` — el PDF del comprobante se
  descarga aparte (botón junto a cada fila, reutiliza `descargarComprobantePDF`)
  para adjuntarlo a mano, porque los navegadores no permiten adjuntar
  archivos automáticamente por `mailto:`. `enviarComprobante` devuelve si la
  ventana realmente se abrió (los navegadores pueden bloquear ventanas en un
  envío masivo) — el envío masivo solo marca "Abierto" los que sí abrieron y
  avisa cuántos quedaron bloqueados. **Diseñado para ser reemplazado sin
  tocar la UI**: cuando exista backend (o se integre un servicio como
  EmailJS/Resend/SendGrid), solo `enviarComprobante` debe cambiar — a una
  llamada real que además adjunte el PDF — el modal, la plantilla editable y
  los botones individual/masivo quedan igual.
- **Avances de salario** — adelantos sin interés ni cuotas obligatorias
  (distinto de Préstamos): descuento automático en el siguiente período,
  liquidación automática contra prestaciones si el empleado se desvincula con
  saldo pendiente.
- **Empresa asume ISR/TSS del empleado** (grossing-up) — flag configurable por
  empleado/ajuste: % de AFP/SFS/ISR que la empresa absorbe en vez de descontarlo
  al empleado, reflejado como línea separada en Costo Empleador.
- **Aporte voluntario a AFP** — % adicional configurable (solo empleado, o
  empleado+empresa) sobre el 2.87%/7.10% obligatorio. Dato legal citable: una
  carta de la DGII (2022) confirma que el aporte voluntario **no reduce la base
  imponible del ISR** — se calcula después de la retención de ISR, a diferencia
  del aporte obligatorio.
- **Saldo a favor del empleado (ISR retenido de más)** — obligación legal real:
  registro de monto/año/motivo que se reintegra automáticamente descontándose
  del ISR calculado en períodos subsecuentes hasta agotarse, o contra
  prestaciones al desvincularse.
- **Retención consolidada de ISR con otro(s) empleador(es)** — campo de "ingreso
  de otro empleador" que solo afecta la base imponible de ISR mensual, sin
  tocar TSS ni el neto pagado.
- ~~Licencias con subsidio~~ — **implementado.** Extendido `TipoLicencia` (antes
  solo matrimonial/fallecimiento/alumbramiento, días fijos) con 3 tipos nuevos
  de días variables (según certificado médico/legal): `enfermedad_comun`
  (SISALRIL 60% ambulatoria / 40% hospitalaria — nuevo campo
  `modalidadEnfermedad`), `accidente_laboral` (SRL 75%), `maternidad` (12
  semanas / 84 días sugeridos, Art. 236 — el empleador paga 100% y luego
  reembolsa SISALRIL). Campo nuevo `Licencia.montoSubsidioEstimado` —
  puramente informativo, Cielo Cloud no lo desembolsa (lo paga/reembolsa TSS
  directo); `Licencia.montoPagado` es lo que el empleador realmente paga vía
  nómina, que es RD$0 para enfermedad_comun/accidente_laboral salvo que se
  active `disfruteSueldo` (beneficio adicional voluntario, no aplica a
  maternidad porque ahí el empleador siempre paga 100%). UI en
  `licencias/page.tsx`: campos condicionales según tipo (días, modalidad,
  checkbox de disfrute de sueldo), columna "Subsidio TSS" en la tabla, y una
  4ta stat card separando "Pagado por la Empresa" de "Subsidio SISALRIL/ARL".
  De paso se corrigió `licencias-context.tsx`, que tenía el divisor de
  salario diario hardcodeado en 23.83 sin considerar `regimenIntermitente`
  (ahora usa `getDivisorSalarioDiario()`, igual que nómina/vacaciones/liquidación).
- ~~Suspensión de contrato~~ — **implementado.** Campos nuevos en `Empleado`:
  `suspendido?: boolean`, `fechaSuspension?: string`, `motivoSuspension?: string`
  — distinto de `activo: false` (liquidación definitiva): el empleado sigue
  vinculado (conserva antigüedad, sigue en el roster, puede reactivarse) pero
  no cobra nómina ni acumula vacaciones/regalía mientras dura la suspensión.
  `useEmpleados()` ahora expone `empleadosEnNomina` (subconjunto de
  `empleadosActivos` que excluye suspendidos) además de `suspender(id, fecha,
  motivo)`/`reactivar(id)`. `empleadosActivos` se mantiene sin cambios — sigue
  usándose para el roster general, liquidación y saldos iniciales, donde un
  suspendido debe seguir apareciendo. `empleadosEnNomina` reemplazó a
  `empleadosActivos` específicamente en `nomina/page.tsx` (generación y
  procesamiento de períodos), `vacaciones/page.tsx` y `regalia-pascual/page.tsx`
  (acumulación). UI en `empleados/page.tsx`: badge "Suspendido" (ámbar) en
  tabla y drawer, nota con fecha/motivo, botón "Suspender" (mini-formulario
  fecha+motivo) / "Reactivar de Suspensión" en el footer del drawer, junto al
  "Dar de baja" existente (que sigue siendo la liquidación definitiva,
  independiente de esto). **No implementado todavía**: la liquidación
  proporcional de derechos adquiridos al momento de suspender (regalía/
  vacaciones ya devengadas hasta esa fecha se calculan igual que para
  cualquier empleado activo al momento de una eventual liquidación futura,
  no hay un cálculo especial "a la fecha de suspensión").
- **Prorrateo por reajuste salarial a mitad de período + retroactivo por
  ingreso tardío** — mismo problema de fondo (fechas de efectividad dentro de
  un período): detectar automáticamente cambios de `salarioBase` o
  `fechaIngreso` posteriores al cierre del período anterior, y sugerir
  (editable) el prorrateo o el ajuste de retroactivo correspondiente.
- **Reporte de cumplimiento de preaviso en renuncias (Art. 76)** — capturar
  fecha de notificación de renuncia vs. fecha efectiva, calcular automáticamente
  si cumplió los días mínimos según antigüedad (7/14/28), mostrar la diferencia.
- **Conciliación mensual TSS y DGII** — reporte que reproduce los mismos
  conceptos/totales de la factura oficial de TSS (AFP/SFS/SRL/Infotep separados
  empleado/empleador) y un equivalente de retención mensual de ISR acumulada,
  para que contabilidad concilie sin recalcular a mano.
- **Validador de archivo de transferencia bancaria (ACH)** — reglas de
  formato/longitud/caracteres por banco, corre sobre el archivo ya generado y
  señala línea/campo del error antes de enviarlo.
- **Bandas/niveles salariales** — tabla de niveles (mín/medio/máx) por
  posición, reporte de "empleados fuera de banda", dashboard de distribución
  salarial.
- **Topes legales de horas extras** — alertar si se excede 24h semanales al
  35% o 80h trimestrales acumuladas (Art. 155 Código de Trabajo).
- **Checklist/asistente de inicio de año** — actualizar tabla ISR, calendario
  de feriados, calendario de pago anual; recordatorio de IR-13 (declaración
  jurada anual de retenciones DGII).

### 🟡 Media prioridad

- Catálogo configurable de tipos de ingreso/descuento (flags de qué computa
  para prestaciones/ISR/TSS) en vez de lógica hardcodeada.
- Reglas de manejo de insuficiencia de fondos: qué hacer si el neto no alcanza
  para cubrir una cuota/descuento programado (omitir cuota, acumular como
  cuenta por cobrar tras 3 fallos consecutivos).
- Generalizar el prorrateo de descuentos fijos entre períodos (ya lo hacemos
  para Dep. SFS quincenal) como helper reutilizable para futuros descuentos
  recurrentes.
- Modo de interés simple en Préstamos (alterno a la amortización francesa
  actual) + tabla de amortización visual con desglose capital/interés.
- Panel de "Capacidad de Pago" (últimas 4 nóminas + proyección de 4 siguientes
  incluyendo cuotas pendientes) antes de aprobar un préstamo nuevo.
- Retribuciones Complementarias (Impuesto Sustitutivo 27%, guía oficial DGII) —
  para paquetes ejecutivos con beneficios en especie (vehículo, vivienda).
- Calendario anual de feriados administrable que alimente el cálculo de H.E.
  100% automáticamente.
- Importador de horas trabajadas vía CSV/Excel con plantilla y validación previa.
- Nómina en moneda USD — principio de diseño clave: el motor tributario
  siempre calcula en RD$; USD es solo una capa de presentación con tasa
  configurable, nunca la base del cálculo.
- Reporte "empleados activos sin ingresos en el mes completo" — validación de
  integridad pre-cierre (prerequisito también de una futura integración TSS).
- Reporte "Salario vs. Inasistencias" — detalle de días descontados por
  motivo (licencia/permiso/ausencia) con impacto exacto en el salario.
- Ampliar procesamiento individual existente con filtros de selección múltiple
  (departamento, fecha de ingreso, fecha de último cambio salarial).
- Aumento masivo de salario: selección por criterio + importación Excel +
  aprobación de segundo usuario antes de impactar nómina.
- Reporte de antigüedad de plantilla (agrupado por posición/rango de años).
- Crédito de ISR por gastos educativos (Ley 179-09) — registro manual (no
  automatizar el 10%/25%, depende de notificación DGII) que se resta del ISR
  calculado, con su propio renglón en el comprobante.

### 🔵 Baja prioridad / no aplica ahora

- Nóminas semanales o bisemanales — P-SPN-002 confirma que la ley (Art. 198)
  solo exige pago semanal para personal por hora/día; para asalariados fijos
  la quincenal ya es superior (evita meses de 4 vs. 5 semanas). Sin demanda
  específica, no urge.
- Bono Vacacional — confirmado que **no es un concepto legal**, es un
  beneficio discrecional que algunas empresas otorgan por su cuenta.
- Reportes que dependen de arquitectura on-premise con SQL Server/Pentaho
  (conexión ODBC a vistas, tablas dinámicas Excel en vivo) — no aplican a
  Cielo Cloud (app estática sin backend de BD expuesto); nuestra exportación
  CSV/Excel bajo demanda ya cubre la necesidad equivalente.
- Descuentos por consumos de cafetería — requiere integración con hardware
  propio (reloj/POS), fuera de alcance.
- Incentivos por energía renovable (Ley 57-07) — demasiado excepcional
  (crédito de inversión de capital) para justificar una función dedicada.
- Importación de préstamos externos de terceros (solo informativo, no se
  descuenta de nómina) — baja prioridad frente a las funciones centrales de
  préstamos.
- Reportes/campos exclusivamente de RRHH (evaluación de desempeño,
  reclutamiento, control de horas/asistencia biométrica, encuestas, carnet,
  descripciones de puesto, App Mobile, etc.) — quedan para la fase de RRHH.

### ✅ Confirmado correcto / ya implementado

- **SRL 4 categorías (I-IV) y tasas 1.10/1.15/1.20/1.30%** — coincide
  exactamente con la documentación de SPN.
- **Bonificación por Participación en Utilidades (Art. 223)** — ya existe
  como calculadora standalone en `/bonificacion` (10% utilidad neta, tope
  45/60 días según antigüedad). Confirmar que la fórmula es coherente con el
  enfoque de SPN (promedio anual de ingresos computables ÷12 ÷23.83 × días).
- **Categoría de empresa + salario mínimo aplicable + alerta de empleados por
  debajo del mínimo** — enfoque validado por el propio flujo que documenta
  SPN ante un cambio de salario mínimo.
- **Mensual + quincenal como los dos formatos correctos para RD** — confirmado
  por P-SPN-002/P-SPN-004 como la combinación recomendada para el caso de uso
  dominante en pymes dominicanas.

## Branch de trabajo

`claude/accounting-app-sme-design-wqfazv` → remote: `manuel-erasmo-oss/tyui`

## Commits de esta sesión (más recientes primero)

| Hash | Descripción |
|---|---|
| `034a541` | feat: suspensión de contrato — nuevo estado distinto de liquidación |
| `a8b9c52` | feat: envío de comprobantes de pago por correo (individual y masivo) |
| `7e9463a` | feat: auditoría pre-cierre y trazabilidad de pago de nómina |
| `ccb60bc` | feat: desposteo de nómina — reabrir el período más reciente |
| `8ad36bd` | feat: registrar empleados nuevos desde el Asistente Guiado |
| `ffa2740` | refactor: integrar Carga Inicial en Configuración + prompt post-onboarding |
| `c87ae7f` | feat: importador Excel para carga inicial de saldos (Fase 3) |
| `45d5245` | feat: asistente guiado de saldos iniciales (Fase 2) |
| `9595bf4` | feat: contenedor Carga Inicial (Fase 2+3) — base para asistente guiado + importador Excel |
| `9529399` | feat: Saldos Iniciales — empleados con historial previo a Cielo Cloud (Fase 1) |
| `85e6323` | fix: cuota dep SFS monto fijo RD$1,919.78 (Res. 624-02 CNSS) |
| `2844cca` | feat: sfsDependientes como descuento de primera clase en nómina |
| `ae1219d` | feat: auto-calculate SFS quota per Resolución 624-02 CNSS |
| `fb3280a` | fix: parentesco categories exactas Resolución 624-02 CNSS |
| `8c03de9` | feat: Historial Nómina tab en EmpleadoDrawer |
| `8b2a680` | feat: Dependientes Adicionales SFS + drawer con tabs |
| `c2a8bab` | refine: footer brand light-indigo (reemplaza negro) |
| `6bffc4d` | refine: premium table styling — nombres brand navy, tipografía limpia |
| `8de75a9` | refine: reduce color noise en tabla nómina |
| `5bf45b4` | fix: design system audit completo |
| `9ae3389` | feat: micro-animaciones modals/toasts + empty states ilustrativos |
| `8467140` | feat: logo SVG wordmark sidebar + jerarquía tipográfica reportes |
| `2d9ef8d` | feat: períodos únicos, estado en_proceso, procesamiento por empleado |
