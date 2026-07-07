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
- ~~Avances de salario~~ — **implementado.** No se construyó como módulo
  aparte — reutiliza el mismo motor de `Prestamo` (`otorgar`/`registrarPago`/
  `getPrestamosActivos`, ya integrado con nómina y liquidación), con un nuevo
  campo `Prestamo.tipo?: 'prestamo' | 'avance'` (default `'prestamo'` para
  registros previos). En `prestamos/page.tsx`, el botón "Nuevo Avance" abre
  un formulario simplificado (solo empleado, monto y motivo — sin tasa de
  interés, cuotas, fechas ni documento adjunto) que internamente fuerza
  `tasaInteres: 0, cuotas: 1`, es decir, un adelanto que se descuenta
  completo en el siguiente período. La liquidación automática contra
  prestaciones si el empleado se desvincula con saldo pendiente ya existía
  para préstamos y aplica igual a avances sin cambios. Badge "Avance" en la
  tabla y en el detalle para distinguirlo visualmente de un préstamo con
  cuotas; en `nomina/page.tsx` la etiqueta del ajuste pre-cargado también
  distingue "Avance de salario" vs "Préstamo" (aunque el chip compacto de la
  tabla de nómina sigue mostrando la categoría genérica "Préstamo" para
  ambos, consistente con cómo ya funcionan todos los demás chips de
  concepto — la distinción real vive en el módulo de Préstamos).
- ~~Empresa asume ISR/TSS del empleado~~ (grossing-up) — **implementado.**
  Nuevo campo `Empleado.grossingUpPct` (% de AFP+SFS+ISR retenidos al
  empleado que la empresa absorbe como beneficio). Diseño clave en
  `calcularNomina`/`calcularNominaQuincenal` (`dominican-labor.ts`): la
  retención/remesa real a TSS/DGII **no cambia** — `afpEmpleado`,
  `sfsEmpleado`, `isrMensual` se calculan y reportan exactamente igual que
  sin este flag (cumplimiento intacto). Lo que cambia es que
  `grossingUpEmpresa = (afpEmpleado + sfsEmpleado + isrMensual) * pct/100` se
  SUMA al `salarioNeto` (el empleado recibe ese monto de vuelta, como si la
  empresa se lo reembolsara) y también se suma a `totalAportesEmpleador`/
  `totalCostoEmpleador` (la empresa lo financia como costo adicional). En la
  variante quincenal, el reembolso se recalcula por quincena en vez de
  repartir 50/50 el monto mensual completo — el ISR real solo se retiene en
  la 2ª quincena (regla ya existente del motor), así que el grossing-up sobre
  ISR también aplica únicamente ahí. Nueva sección "Empresa Asume ISR/TSS del
  Empleado" en `EmpleadoFormFields.tsx`, campo en `empleado-form.ts`. En
  `nomina/page.tsx`: nota "Incluye reembolso de grossing-up" bajo el Salario
  Neto y línea "Grossing-up (ISR/TSS empleado)" en Aportes Empresa del modal
  `DetalleNomina` y del PDF (de paso se corrigió una omisión de la feature
  anterior: el Aporte Voluntario AFP de la empresa tampoco aparecía
  desglosado en la lista de aportes del PDF, ya corregido). Verificado en
  navegador: empleado con salarioBase RD$88,000, préstamo activo y 50%
  grossing-up → reembolso exacto RD$7,241.77 (= 50% de AFP+SFS+ISR
  combinados), neto sube de RD$66,850 a RD$74,092, Costo Total Empresa
  RD$109,576.97, sin ningún cambio en el monto de ISR retenido.
- ~~Aporte voluntario a AFP~~ — **implementado.** Dos campos nuevos en
  `Empleado`: `aporteVoluntarioAFPEmpleadoPct`/`aporteVoluntarioAFPEmpresaPct`
  (% adicional sobre el salario cotizable AFP, independiente del 2.87%/7.10%
  obligatorio). En `calcularNomina`/`calcularNominaQuincenal`
  (`dominican-labor.ts`): `baseGravableMensual`/`baseGravableAnual` (base del
  ISR) se calculan ANTES y sin depender del aporte voluntario — el aporte del
  empleado se descuenta de `totalDescuentos`/`salarioNeto` DESPUÉS del ISR, tal
  como confirma la carta DGII (2022) citada en este mismo backlog ("el aporte
  voluntario no reduce la base imponible del ISR"). El aporte de la empresa se
  suma a `totalAportesEmpleador`/`totalCostoEmpleador` como beneficio aparte,
  sin tocar el neto del empleado. Nueva sección "Aporte Voluntario a AFP" en
  `EmpleadoFormFields.tsx` (con nota legal inline) y campos correspondientes en
  `empleado-form.ts`. `nomina/page.tsx`: línea "Aporte Voluntario AFP" en
  Descuentos y "Aporte Voluntario AFP (empresa)" en Aportes Empresa del modal
  `DetalleNomina` y del PDF de comprobante, ambas condicionales (ocultas si el
  monto es 0). Verificado en navegador: empleado con salarioBase RD$55,000,
  2% aporte propio y 3% aporte empresa → descuento exacto RD$1,100 y aporte
  empresa exacto RD$1,650, con ISR retenido sin cambios frente al caso base.
- ~~Saldo a favor del empleado (ISR retenido de más)~~ — **implementado.**
  Nuevo tipo `SaldoISRFavor` (monto/saldoPendiente/motivo/año/estado/
  aplicaciones[]) + `saldo-isr-context.tsx` (registrar/aplicar/liquidar/
  consultas, mismo patrón de `prestamos-context.tsx`). Helper puro
  `aplicarSaldoISRFavor(resultado, saldoDisponible)` en `dominican-labor.ts`:
  descuenta `min(isrMensual, saldoDisponible)` del ISR calculado (nunca de
  AFP/SFS) y lo suma de vuelta al `salarioNeto` — no decide cuánto crédito
  hay disponible ni persiste consumo, eso lo maneja el context. En
  `nomina/page.tsx`, helper `conSaldoISR(empleado, resultado, periodo)`:
  si el empleado YA fue procesado en ese período usa el monto histórico
  realmente aplicado (`getMontoAplicadoEnPeriodo`, fijo para siempre,
  independiente de cómo cambie el saldoPendiente después); si aún no se
  procesa, muestra vista previa en vivo contra el saldo disponible ahora
  mismo (FIFO — el crédito más antiguo se consume primero). El monto se
  "congela" recién al procesar (`congelarCreditoISR`, llamado desde
  `handleProcesarEmpleado`/`confirmarAuditoria`/`handleProcesarSeleccionados`
  antes de `marcarProcesados`), consistente con cómo ya funciona la
  auditoría pre-cierre. UI: sección "Saldo ISR a Favor" en el tab
  Información del drawer de `empleados/page.tsx` (mini-formulario inline
  para registrar, mismo patrón visual que Suspensión de Contrato); nota
  "Incluye crédito ISR a favor aplicado" en Descuentos del modal
  `DetalleNomina` y el PDF de comprobante; Historial Nómina reconstruye el
  ISR correcto de cada período pasado sin recalcular contra el saldo actual.
  En `liquidacion/page.tsx`: cualquier saldo pendiente se reembolsa completo
  (se SUMA al total, no se descuenta) y se marca `'liquidado'` al finalizar
  — nuevo campo `RegistroLiquidacion.saldoISRReembolsado`, card y línea
  dedicada en el grid de conceptos, el bloque de Total a Pagar y el CSV.
  Verificado en navegador: Carlos Rodríguez Méndez (ISR base RD$9,283) con
  RD$5,000 registrados → ISR retenido baja a RD$4,283 exacto, neto sube
  RD$5,000; al procesar el período el saldo pasa a "Sin saldo pendiente"
  (agotado) y el Historial de meses previos (ya cerrados antes del
  registro) no se ve afectado. Ana Martínez Santos con RD$2,000 pendientes
  → aparece en la liquidación como reembolso (+RD$2,000), total exacto
  RD$26,750.40 (vacaciones + regalía + saldo ISR).
- ~~Retención consolidada de ISR con otro(s) empleador(es)~~ — **implementado.**
  Nuevo campo `Empleado.ingresoOtroEmpleadorMensual`. Mecanismo (interpretación
  propia de Cielo Cloud — la norma no detalla cómo coordinan dos empleadores
  la retención): en `calcularNomina` (`dominican-labor.ts`) se consolida
  `baseGravableAnual` (de este empleador) + el ingreso anualizado del otro
  empleador SOLO para ubicar el tramo ISR correcto
  (`calcularISRAnual(baseGravableConsolidadaAnual)`), y luego este empleador
  retiene únicamente la porción proporcional a su propia base
  (`isrConsolidadoAnual × baseGravableAnual/baseGravableConsolidadaAnual`).
  Con el campo vacío/0 la fórmula es idéntica a la anterior (proporción = 1),
  100% retrocompatible. TSS y el resto del cálculo no se tocan. Nueva
  sección "Ingreso de Otro Empleador" en `EmpleadoFormFields.tsx`; nota de
  transparencia (`nomina/page.tsx`, modal `DetalleNomina` y PDF) cuando
  aplica. Verificado en navegador: José Hernández Cruz (salario RD$43,000,
  ISR propio RD$866.06 sin el campo) con RD$30,000/mes de otro empleador →
  ISR retenido sube a RD$3,610.45 exacto (empuja la base consolidada al
  tramo del 20%, pero solo se retiene la fracción ~57.4% que corresponde a
  esta empresa) — coincide exactamente con el cálculo manual de verificación.
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
- ~~Reporte de cumplimiento de preaviso en renuncias (Art. 76)~~ — **implementado**
  (vía agente en worktree aislado). Nuevo campo opcional
  `RegistroLiquidacion.fechaNotificacionRenuncia` — solo aplica cuando
  `motivo === 'renuncia'`. `getDiasPreavisoRequeridos()` (nuevo export en
  `dominican-labor.ts`, mismos tramos que `calcularPreaviso` pero en días
  exigidos: 7/14/28) compara contra la anticipación real capturada en
  `liquidacion/page.tsx`, mostrando badge "Cumplió"/"Incumplió por N días" en
  vivo antes de finalizar. Nuevo reporte "Cumplimiento de Preaviso" dentro de
  Reportería (no ruta nueva — se integró como un `ReportId` más siguiendo el
  patrón ya establecido de esa página) que lista el historial de renuncias con
  el dato capturado. Verificado en navegador: empleado con 5 años 7 meses de
  antigüedad, notificación 35 días antes de la fecha de salida → "Cumplió" con
  el detalle exacto "+7 días de más" (mínimo exigido 28).
- ~~Conciliación mensual TSS y DGII~~ — **implementado** (vía agente en
  worktree aislado), extendiendo el reporte "Cumplimiento Fiscal" ya
  existente en Reportería (ese reporte ya calculaba los números correctos
  pero solo como tabla por empleado — le faltaba el formato de "factura"
  para conciliar). Nueva sección "Planilla de Conciliación TSS": desglose
  por concepto (AFP, SFS, SFS Dependientes Adicionales si aplica, SRL
  agrupado por cada categoría de riesgo realmente presente en la plantilla,
  Infotep) con tasa empleado/empleador y monto, más el total general "TSS a
  Remitir (CNSS)". Bloque separado "Retención ISR — DGII" con el total
  agregado de ISR retenido del período (equivalente para IR-13). La tabla de
  detalle por empleado que ya existía se conserva debajo como respaldo de
  auditoría. Exportación PDF (2 páginas: conciliación + detalle) y Excel (2
  hojas) actualizadas en consecuencia. Verificado en navegador con datos
  demo: Total TSS RD$60,395 = TSS Empleado RD$16,075 + TSS Empleador
  RD$44,320 (cuadra exacto), ISR Retenido RD$15,452.86.

**Con esto quedan implementados los 18 gaps confirmados de la sección
🔴 Alta prioridad** (backlog originado del análisis de la guía pública de
SPN Software, ver sección de arriba). Quedan pendientes las secciones
🟡 Media prioridad y 🔵 Baja prioridad, no solicitadas todavía.
- ~~Validador de archivo de transferencia bancaria (ACH)~~ — **implementado**
  (vía agente en worktree aislado) como capa de validación sobre el reporte
  "Planilla Bancaria / ACH" ya existente en Reportería (esa planilla es una
  lista legible para carga manual al banco, no un archivo de formato bancario
  real — no existía ningún generador de archivo ACH propiamente dicho, así
  que la validación se aplicó sobre los datos de esa planilla). Nuevo bloque
  "Validación antes de enviar" con reglas genéricas (documentadas como
  interpretación propia de Cielo Cloud, sin specs oficiales exactas por
  banco): cuenta+banco obligatorios, formato de número de cuenta (solo
  dígitos/guiones, 8-20 caracteres), caracteres inválidos en el nombre,
  cuentas duplicadas (advertencia, no bloqueante), monto debe ser mayor a
  cero, reconciliación de suma total vs. filas. `ReportHeader` (componente
  compartido por todos los reportes) ganó props opcionales
  `disabled`/`disabledReason` — los botones Excel/PDF se deshabilitan
  visualmente (sin ocultarse) mientras existan errores bloqueantes.
  Verificado en navegador con datos demo: 6/6 transferencias "OK", 0 errores.
- ~~Topes legales de horas extras~~ — **implementado** (vía agente en
  worktree aislado), extendiendo el reporte "Horas Extras" ya existente en
  Reportería con una sección "Alertas de Topes Legales (Art. 155)". Tope
  trimestral (80h acumuladas) calculado de forma EXACTA agrupando los
  períodos ya registrados por trimestre calendario — cuenta tanto
  `horas_extras_35` como `horas_extras_100` (el Art. 155 limita el número de
  horas extraordinarias, sin distinguir por tarifa de recargo). Tope
  "semanal" (24h) implementado como una APROXIMACIÓN explícitamente rotulada
  en la UI (nota ámbar siempre visible, no oculta en tooltip) — el sistema
  registra horas extra por período mensual/quincenal, no por semana
  calendario individual, así que el promedio semanal se estima dividiendo
  las horas del período entre semanas del período (mensual÷4.33,
  quincenal÷2.17). Un control exacto del tope semanal requeriría capturar
  horas extra con fecha/semana específica, que hoy no se registra. Alertas
  desde 90% del tope (ámbar) y al superarlo (rojo).
- ~~Bandas/niveles salariales~~ — **implementado** (vía agente en worktree
  aislado). Nuevo tipo `BandaSalarial` (posición + mín/medio/máx) y contexto
  `bandas-salariales-context.tsx` (mismo patrón que `prestamos-context.tsx`).
  Nueva página `/bandas-salariales`: CRUD de bandas (matching de posición
  contra `Empleado.cargo`, case-insensitive), tabla de "Empleados Fuera de
  Banda" (por debajo del mínimo o sobre el máximo, con la diferencia en RD$),
  y una vista de distribución salarial por rangos con barras simples (sin
  librería externa).
- ~~Checklist/asistente de inicio de año~~ — **implementado** (vía agente en
  worktree aislado). Nueva página `/inicio-de-ano` con: tramos ISR y topes
  TSS vigentes como referencia (de solo lectura, ya que viven en
  `dominican-labor.ts` y rara vez cambian), calendario de feriados nacionales
  editable, calendario de pago anual (12 filas mensual / 24 quincenal, según
  `empresa.modalidadNomina`), y recordatorio informativo de IR-13 (sin fecha
  fija — remite a confirmar en dgii.gov.do para no afirmar un dato legal
  impreciso). Nuevo contexto `inicio-de-ano-context.tsx` con estado
  `ChecklistAnualEstado` indexado por año calendario — el checklist se
  "reinicia" automáticamente cada año nuevo sin lógica explícita, porque el
  año en curso simplemente no tiene registro previo todavía.

### 🟡 Media prioridad

- Catálogo configurable de tipos de ingreso/descuento (flags de qué computa
  para prestaciones/ISR/TSS) en vez de lógica hardcodeada. **Deliberadamente
  no implementado esta sesión**: a diferencia de los demás items de este
  backlog, este le da al usuario control directo sobre QUÉ tributa cada
  concepto — un error de configuración (ej. marcar mal si un concepto reduce
  la base del ISR) llevaría a una retención incorrecta y un problema real de
  cumplimiento legal, no solo un bug de UI. El sistema hardcodeado actual ya
  implementa correctamente el tratamiento legal dominicano de cada concepto
  (horas extra, comisión, dependiente SFS, etc.); generalizarlo a un catálogo
  editable por el usuario requiere diseño cuidadoso (¿quién audita los flags?
  ¿se versiona el catálogo por período para no alterar retroactivamente
  nóminas ya procesadas?) que amerita su propia sesión con más contexto, no
  una implementación apurada al final de un backlog largo.
- ~~Reglas de manejo de insuficiencia de fondos~~ — **implementado.** Nueva
  función `manejarInsuficienciaFondos(empId)` en `nomina/page.tsx`, invocada
  justo antes de marcar procesado a un empleado (en los 3 puntos de entrada:
  individual, selección múltiple, y confirmación de auditoría pre-cierre): si
  el neto calculado (con saldo ISR ya aplicado) es negativo, se identifican
  los ajustes `concepto === 'prestamo'` con `prestamoId` de ese empleado en
  el período; si al quitarlos el neto deja de ser negativo, se persisten sin
  ellos (`actualizarAjustes`) y se llama `registrarOmisionCuota(prestamoId)`
  en `prestamos-context.tsx` por cada uno — la cuota se omite ese período en
  vez de dejar un neto negativo (es el único descuento diferible sin
  implicar incumplimiento legal, a diferencia de AFP/SFS/ISR). Si el neto
  sigue negativo incluso sin las cuotas de préstamo, no se toca nada más —
  ese caso ya lo señala la auditoría pre-cierre existente. Nuevos campos
  `Prestamo.cuotasOmitidasConsecutivas`/`requiereGestionCobro` (se resetean a
  0/false en cuanto vuelve a cobrarse una cuota con normalidad vía
  `registrarPago`); al llegar a 3 omisiones seguidas se marca
  `requiereGestionCobro` — es solo una bandera informativa para seguimiento
  manual de RRHH (esta app no tiene un módulo de cuentas por cobrar
  separado), badge "Requiere gestión de cobro" visible en `prestamos/page.tsx`.
  Verificado en navegador: empleado con salario RD$21,500 y cuotas de
  préstamo+avance sumando RD$21,000 → neto calculado -RD$771 → al procesar,
  toast "Cuota de préstamo omitida para Roberto Díaz Vargas — el neto no
  alcanzaba", ajustes de préstamo removidos de su fila, neto final ajustado
  a RD$20,229 (positivo).
- ~~Generalizar el prorrateo de descuentos fijos entre períodos~~ — **implementado.**
  Nuevo helper puro `prorratearMontoFijo(montoMensual, tipo)` en
  `dominican-labor.ts` (divide entre 2 y redondea a centavos solo si
  `tipo === 'quincenal'`, retorna el monto tal cual en mensual) que reemplaza
  la lógica que antes vivía inline únicamente para Dep. SFS en
  `nomina/page.tsx` — mismo comportamiento exacto, ahora reutilizable para
  cualquier futuro descuento/aporte fijo recurrente.
- ~~Modo de interés simple en Préstamos~~ + ~~Panel de "Capacidad de Pago"~~ —
  **implementado** (vía agente en worktree aislado). Nuevo campo
  `Prestamo.modoInteres?: 'francés' | 'simple'` (default `'francés'`
  retrocompatible). Funciones puras nuevas en `prestamos-context.tsx`:
  `calcularAmortizacionFrancesa` (extraída de la lógica que ya existía en
  `VistaDetalle`, sin cambiar su comportamiento) y `calcularAmortizacionSimple`
  (interés fijo calculado una sola vez sobre el capital original —
  `capitalPorCuota = monto/cuotas`, `interesPorCuota = monto × tasa/100`,
  ambos fijos en cada cuota). Selector Francés/Simple en el formulario de
  "Nuevo Préstamo" con tabla de amortización completa en vivo (componente
  compartido `TablaAmortizacion`, reutilizado también en `VistaDetalle`).
  Panel de "Capacidad de Pago": salario base + cuotas activas + nueva cuota
  vs. 30% del salario (regla interna de Cielo Cloud, rotulada explícitamente
  como tal — no es un tope legal, no bloquea el otorgamiento). Verificado en
  navegador: préstamo de RD$60,000/12 cuotas a Carlos Rodríguez Méndez con
  2% de interés simple → cuota fija exacta RD$6,200 (RD$5,000 capital +
  RD$1,200 interés) en las 12 cuotas, capacidad de pago 14.6% del salario.
- ~~Retribuciones Complementarias (Impuesto Sustitutivo 27%)~~ — **implementado**
  (vía agente en worktree aislado). Nueva calculadora standalone
  `/retribuciones-complementarias` (mismo patrón de `bonificacion/page.tsx`):
  líneas editables por concepto (Vehículo de la empresa, Vivienda, Colegios/
  Educación, Otros beneficios en especie) con valor mensual RD$, suma total y
  27% de Impuesto Sustitutivo sobre esa base — impuesto MENSUAL como cálculo
  principal (obligación recurrente, no una declaración anual única), con un
  tercer stat card de "Impuesto Anualizado (referencia)" solo para
  presupuesto. Empleado beneficiario es opcional/informativo (el impuesto lo
  paga la empresa sin importar quién reciba el beneficio). Verificado en
  navegador: línea de RD$20,000 → Impuesto Sustitutivo exacto RD$5,400.
- ~~Calendario anual de feriados administrable que alimente el cálculo de H.E.
  100%~~ — **implementado.** El calendario de feriados ya existía en
  `/inicio-de-ano` (`ChecklistAnualEstado.feriados`, contexto
  `inicio-de-ano-context.tsx`); se conectó a `nomina/page.tsx` — al agregar un
  ajuste `horas_extras_35`/`horas_extras_100` a un empleado, se muestra un
  aviso con los feriados registrados del mes del período abierto, sugiriendo
  clasificar como H.E. 100% (Art. 203) si las horas cargadas corresponden a
  esa fecha. No se automatiza la clasificación en sí (el sistema no captura
  la fecha exacta de las horas trabajadas, solo un total por período), así
  que el aviso es informativo — el usuario sigue eligiendo el concepto
  correcto. Verificado en navegador: feriado registrado "16 ago 2026 — Día de
  la Restauración" → aviso exacto al seleccionar H.E. 35% en un ajuste de
  Agosto 2026.
- ~~Importador de horas trabajadas vía CSV/Excel~~ — **implementado** (vía
  agente en worktree aislado). Nuevo `ImportadorHorasExcel.tsx` (mismo
  esqueleto de 3 pasos que `carga-inicial/ImportadorExcel.tsx`), botón
  "Importar Horas" en `nomina/page.tsx` (solo visible con el período
  `en_proceso`). Plantilla con columnas Cédula/Concepto/Horas/Descripción —
  el concepto acepta etiquetas amigables ("H.E. 35%"/"H.E. 100%"/"Recargo
  Nocturno") mapeadas a los valores exactos de `ConceptoAjuste`. Cada fila
  válida se ANEXA a los ajustes ya existentes del empleado en ese período
  (nunca los reemplaza — preserva préstamos, dependientes SFS, etc.) vía
  `actualizarAjustes`. Corrección aplicada durante la verificación: la
  comparación de cédula ahora tolera pérdida de ceros a la izquierda (ej.
  "00112345678" → "112345678") que ocurre cuando Excel interpreta la columna
  como número en vez de texto — un problema real y común al reingresar
  cédulas dominicanas en una hoja de cálculo. Verificado en navegador: CSV
  con 2 filas válidas → "Se agregaron 2 ajuste(s) de horas a 2 empleado(s)",
  con el préstamo ya existente de otro empleado intacto tras la importación.
- ~~Nómina en moneda USD~~ — **implementado.** Nuevo campo
  `Empresa.tasaCambioUSD` (RD$ por 1 USD, configurable a mano en
  Configuración — sin conexión a ningún servicio de tasas en vivo). Selector
  RD$/USD en el header de `nomina/page.tsx` (visible solo si la tasa está
  configurada) que convierte lo ya mostrado en pantalla vía `formatMoneda()`
  (nuevo helper) — StatCards, tabla de detalle, footer de totales y el modal
  `DetalleNomina`. El motor de cálculo (`dominican-labor.ts`) nunca ve la
  tasa de cambio; el PDF de comprobante, el CSV exportado y la plantilla de
  correo de pago siguen SIEMPRE en RD$ (son el registro legal/financiero
  real, no una vista de conveniencia). Verificado en navegador con tasa
  RD$60/USD: Total Bruto RD$274,750 → exacto $4,579 al activar USD, mismo
  desglose consistente en el modal de comprobante.
- ~~Reporte "empleados activos sin ingresos en el mes completo"~~ — **implementado**
  (vía agente en worktree aislado). Nuevo `ReportId` "Empleados Sin Ingresos"
  en Reportería. "Activo durante el mes" = unión de activos hoy con
  `fechaIngreso ≤ fin de mes` MÁS empleados ya liquidados hoy cuya
  `fechaTerminacion` cae después de ese mes (el mes completo debía pagarse
  por nómina normal); excluye liquidaciones dentro/antes del mes (su pago
  salió de Liquidación, no de Nómina) y cualquier `suspendido` vigente hoy.
  Señal principal: el empleado no aparece en `empleadosProcesados` del
  período; señal secundaria: `totalBruto` calculado en RD$0. Nota siempre
  visible en la UI explicando la metodología exacta.
- ~~Reporte "Salario vs. Inasistencias"~~ — **implementado como "Salario vs.
  Licencias"** (vía agente en worktree aislado), con alcance real ajustado y
  documentado honestamente: el sistema NO captura "días trabajados" ni
  ausencias/permisos informales por período (`calcularNomina` acepta
  `diasTrabajados` pero ninguna pantalla de nómina lo alimenta con un valor
  distinto al default de mes completo) — así que "detalle de días
  descontados por ausencia" no es implementable sobre datos reales. El
  reporte se basa en el único dato real y verificable de ausencias con
  impacto salarial: el módulo de Licencias (matrimonial, fallecimiento,
  alumbramiento, enfermedad común, accidente laboral, maternidad), mostrando
  por licencia el `montoPagado` real y el `montoSubsidioEstimado` TSS/ARL.
  Nota siempre visible en la UI aclarando esta limitación de alcance.
- ~~Ampliar procesamiento individual existente con filtros de selección
  múltiple~~ — **implementado.** Botón "Filtros" en la tabla de detalle de
  `nomina/page.tsx` (solo visible en período `en_proceso`) despliega un panel
  con Departamento + rango de Fecha de Ingreso Desde/Hasta; botón "Seleccionar
  Coincidencias" reemplaza la selección actual por los empleados pendientes
  que coincidan. No se ofrece filtro de "fecha de último cambio salarial"
  porque ese campo no existe en el modelo de datos hoy (nota visible en la
  propia UI explicando esta limitación, en vez de inventar el dato).
  Verificado en navegador: filtro por departamento "Ventas" selecciona
  exactamente al empleado de ese departamento pendiente de procesar.
- ~~Aumento masivo de salario~~ — **implementado** (vía agente en worktree
  aislado). Antes escribía directo en `Empleado.salarioBase` sin ningún
  rastro; ahora cada solicitud (manual por criterio, o importada por Excel)
  queda registrada en un nuevo tipo `RegistroAumento` (contexto
  `aumentos-context.tsx`, mismo patrón que `prestamos-context.tsx`) con
  estado `pendiente_aprobacion → aprobado → aplicado` (o `rechazado`). Solo
  `aplicar()`, y únicamente si el registro ya está `aprobado`, sobreescribe
  el salario real. Selección por criterio: departamento + "ingresados antes
  de" + "sin aumento aplicado desde" (derivado del propio historial, ya que
  no existe un campo de "fecha de último cambio salarial" en el modelo).
  Importador Excel (Cédula, Nuevo Salario o % de Aumento, Motivo) genera
  solicitudes en el mismo estado pendiente, nunca aplica directo. Aprobación
  de "segundo usuario": dado que la app no tiene roles reales (mismo caso ya
  documentado para el desposteo de nómina), la salvaguarda es un campo de
  texto obligatorio "Aprobado por" que se debe llenar a mano antes de que el
  registro pueda pasar a aplicado — no hay enforcement real de que sea una
  persona distinta, pero queda un rastro auditable explícito. Verificado en
  navegador: solicitud de 5% para María González Pérez → RD$55,000 →
  RD$57,750, aprobada con "Gerente RRHH", aplicada — `salarioBase` del
  empleado actualizado exactamente a RD$57,750.
- ~~Reporte de antigüedad de plantilla~~ — **implementado** (vía agente en
  worktree aislado), extendiendo Reportería con un nuevo `ReportId`
  "Antigüedad de Plantilla". Dos agrupaciones en tabs (Por Rango de Años:
  &lt;1/1-3/3-5/5-10/10+ años, con barra visual; Por Posición: antigüedad
  promedio por cargo, mayor a menor) más tabla de detalle por empleado
  buscable. Exportación PDF (2 páginas: resúmenes + detalle) y Excel
  (3 hojas).
- ~~Crédito de ISR por gastos educativos (Ley 179-09)~~ — **implementado.**
  En vez de duplicar toda la máquina de `SaldoISRFavor` (registrar/aplicar/
  liquidar/FIFO por fecha), se generalizó ese mismo mecanismo — ya usado para
  "Saldo a favor del empleado (ISR retenido de más)" — con un nuevo campo
  opcional `SaldoISRFavor.tipo?: TipoCreditoISR` (`'retencion_excesiva'` por
  defecto, retrocompatible con registros previos a este campo, o
  `'gastos_educativos'`). Ambos tipos comparten exactamente la misma
  aplicación contra el ISR calculado (vía `aplicarSaldoISRFavor`, sin tocar
  AFP/SFS) — la app **no automatiza el 10%/25%** que permite la ley (depende
  de una notificación/aprobación de la DGII fuera de su alcance), el usuario
  registra el monto ya autorizado. UI: selector "Tipo de Crédito" en el
  formulario de "Saldo ISR a Favor" (tab Información de `empleados/page.tsx`)
  con nota legal condicional, y badge "Ley 179-09" en las filas de ese tipo.
  Verificado en navegador: registro de RD$3,000 con motivo "Colegio San Judas
  - notificación DGII 2026-05" → aparece con el badge correcto.

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

## QA a fondo — módulo por módulo (completado, 7/7 fases)

Directiva del usuario: revisar todo el sistema módulo por módulo, escenario por
escenario, sin escatimar esfuerzo; corregir lo que no funcione; recomendar quitar
funcionalidad que no convenga; reportar lo que no tenga sentido. Cronograma en
7 fases por orden de dependencia (motor de cálculo primero, reportería al final
porque agrega de todo lo demás). Cada fix se verifica en navegador con Playwright
contra datos demo reales, no solo con tsc/build.

**Fase 0 — Mapeo + datos demo frescos:**
- **[FIXED]** `cargarDatosDemo()` no incluía `configuracionInicialOfrecida` en el
  objeto `Empresa` semilla → cada carga de datos demo dejaba la app entera
  bloqueada detrás del gate "Una cosa más" en la siguiente navegación.
- **[FIXED — crítico]** Dashboard (`src/app/page.tsx`) crasheaba por completo
  (Unhandled Runtime Error) con 2-4 períodos mensuales reales procesados —
  el caso normal de toda empresa en sus primeros meses — por índices
  hardcodeados `BAR_DATA[3]`/`BAR_DATA[4]` que asumían siempre 5 elementos.

**Fase 1 — Motor de cálculo (dominican-labor.ts) + Empleados:**
- **[FIXED]** `aplicarSaldoISRFavor()` no recalculaba `grossingUpEmpresa` al
  aplicar un crédito de ISR a favor, causando que la empresa sobre-reembolsara
  al empleado (vía grossing-up) por ISR que el crédito ya había cubierto —
  bug de interacción entre dos features que solo se habían probado por
  separado. Verificado centavo por centavo con un empleado "kitchen sink"
  (préstamo + grossing-up 50% + aporte voluntario AFP + ingreso de otro
  empleador + saldo ISR a favor, todo simultáneo).
- **[HALLAZGO, sin corregir — requiere decisión de producto]** Suspender a un
  empleado lo saca de inmediato de cualquier período `en_proceso` ya abierto
  (incluyendo el mes en curso), sin prorratear los días ya trabajados —
  contradice el texto de la propia UI, que da a entender que solo afecta
  nóminas futuras. Corregirlo bien requiere fijar la lista de participantes
  de un período al crearlo y diseñar prorrateo — arquitectura, no un bugfix
  de una línea. Detalle completo y pasos de reproducción en el reporte final
  de QA (Fase 7).

**Fase 2 — Procesar Nómina:**
- **[FIXED — crítico, alcance amplio]** `PeriodoNomina.totales` se calculaba
  UNA SOLA VEZ al crear el período y nunca se recalculaba — ni al agregar
  ajustes, ni al procesar, ni al aplicar un crédito de Saldo ISR, ni al
  cerrar. Ese campo congelado lo leen directamente las cards de la lista de
  períodos, el Dashboard y **toda Reportería** (KPIs, YTD, tabla mensual,
  PDF/Excel) — afecta el caso de uso más común (agregar ajustes después de
  crear el período, el flujo normal). Fix: nuevo `actualizarTotales()` en
  `periodos-context.tsx` + `useEffect` en `nomina/page.tsx` que recalcula con
  la misma lógica que ya usa la tabla en vivo, cada vez que cambian ajustes/
  procesados/estado/lista de empleados/saldos ISR. Verificado con deltas
  exactos (−RD$3,000 ISR, −RD$1,500 grossing-up) coincidiendo entre la card
  de lista y la vista de detalle tras el recálculo.

**Fase 3 — Préstamos, Liquidación, Vacaciones, Regalía Pascual, Licencias**
(vía 4 agentes en paralelo, worktrees aislados; cada uno hizo al menos un fix
real antes de cortarse por un límite de sesión de la infraestructura —
diffs inspeccionados, verificados y aplicados manualmente):
- **[FIXED]** Préstamos: un pago manual que excediera el saldo pendiente se
  aceptaba sin más, inflando el historial por encima del monto original.
  Bloqueado. También se clampa cualquier tasa de interés negativa en las
  4 funciones de amortización (rompía la fórmula francesa).
- **[FIXED]** Liquidación: la regalía proporcional contaba los meses desde
  el 1 de enero SIN importar la fecha de ingreso real, sobreestimando la
  regalía de empleados contratados y liquidados en el mismo año calendario.
- **[FIXED]** Vacaciones/Regalía: texto de UI decía "÷26" como regla general
  cuando el motor real usa 23.83 (26 solo en régimen intermitente); footers
  usaban negro en vez del brand light-indigo que exige el sistema de diseño;
  meses de servicio podían salir negativos con fecha de ingreso futura.
- **[FIXED]** Licencias: el campo "Días" de licencias con subsidio no tenía
  tope ni redondeo — un error de tipeo podía distorsionar las stat cards sin
  aviso. Ahora se redondea y se topa en 365 días.

**Fase 5 — Reportería:**
- **[FIXED — regresión propia]** El `useEffect` de recálculo de totales
  (Fase 2) recalculaba con datos EN VIVO cada vez que se ABRÍA un período,
  sin importar si ya estaba `procesada`/`cerrada`. Un período histórico
  cerrado, al reabrirse solo para verlo semanas después, se inflaba
  retroactivamente si el empleado había recibido un aumento salarial
  después. Fix: solo recalcula mientras `estado === 'en_proceso'` — un
  período cerrado es un registro histórico inmutable salvo desposteo
  explícito. Verificado: María (aumento RD$55,000→60,500) ya no infla el
  bruto de julio (se mantiene en RD$321,500 exacto) al reabrir ese período.
- **[HALLAZGO, sin corregir — gap arquitectónico]** El sistema no
  guarda ningún snapshot de salarioBase por período — "Nómina por Período"
  en Reportería, el tab "Historial Nómina" de Empleados, y
  `calcularSalarioPromedioUltimos12Meses` (usado en Liquidación) reconstruyen
  nóminas pasadas con el salarioBase ACTUAL del empleado, no con el que
  realmente aplicaba en ese momento. Confirmado con el mismo caso de
  María: el reporte le atribuye RD$60,500 en julio cuando realmente se le
  pagaron RD$55,000. Requiere un cambio de modelo de datos (snapshot por
  período) — se reporta para decisión del usuario.

**Fase 6 — Transversales:** Dashboard y Auth/Onboarding ya cubiertos en la
Fase 0. Configuración y modo oscuro verificados sin hallazgos nuevos
(Configuración, Procesar Nómina y Reportería en dark mode — buen contraste,
sin errores de consola).

**Cierre — 9 bugs corregidos (2 críticos) y 2 hallazgos reportados sin
corregir** (requieren decisión de producto: prorrateo al suspender un
empleado mid-período, y snapshot histórico de salario por período).
`tsc --noEmit` y `npm run build` limpios en los 6 commits de esta
auditoría; todos fusionados a `main`.

## Branch de trabajo

`claude/accounting-app-sme-design-wqfazv` → remote: `manuel-erasmo-oss/tyui`

## Commits de esta sesión (más recientes primero)

| Hash | Descripción |
|---|---|
| `4a205a4` | feat: avances de salario — adelanto sin interés reutilizando Préstamos |
| `6779672` | feat: licencias con subsidio — enfermedad común, accidente laboral, maternidad |
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
