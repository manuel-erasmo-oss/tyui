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

- ~~Catálogo configurable de tipos de ingreso/descuento~~ — **implementado**,
  a petición explícita del usuario (revocando la decisión previa de diferirlo
  documentada abajo). Nueva sección **"Ingresos y Deducciones"** en
  Configuración (`src/app/configuracion/page.tsx`, vista `'conceptos'`) con
  dos tablas: (1) `CONCEPTOS_LEY` — catálogo de los 9 conceptos legales
  existentes (horas extra, comisión, bono, dependiente SFS, préstamo, etc.),
  de solo lectura, mostrando si cada uno afecta ISR/TSS y su base legal; (2)
  catálogo editable de `ConceptoPersonalizado` (nuevo tipo en `types/index.ts`)
  — el usuario crea ingresos o deducciones nuevos con nombre propio, y para
  ingresos, dos checkboxes independientes "Afecta ISR" / "Afecta TSS".
  Contexto nuevo `conceptos-personalizados-context.tsx` (mismo patrón que
  `prestamos-context.tsx`), con **soft-delete** (`activo: false`, nunca se
  borra el registro) para que ajustes históricos que ya referencian un
  concepto sigan siendo válidos aunque se "elimine" del catálogo después.
  Sin restricción de quién puede editarlo (confirmado explícitamente por el
  usuario — no hay roles reales en la app, mismo caso ya documentado para
  desposteo/aumentos).
  **Diseño de la salvaguarda legal** (la razón original para diferir esto):
  - **Las deducciones personalizadas NUNCA afectan ISR ni TSS** — decisión
    explícita del usuario ("Las deducciones no deben afectar los pasivos de
    TSS e Infotep ni el ISR"), forzada a nivel de datos (no solo de UI): el
    contexto pone `afectaISR`/`afectaTSS` en `false` automáticamente para
    `tipo === 'deduccion'` tanto al crear como al editar, así que ni un bug
    de UI futuro podría violar esta regla. Todas las deducciones (de ley o
    personalizadas) siguen cayendo en el mismo bucket `otrosDescuentos`,
    post-impuesto.
  - **Snapshot en el momento de uso, nunca referencia viva**: cuando se
    agrega un ajuste personalizado a un empleado en Nómina, `AjusteLinea`
    graba `conceptoPersonalizadoNombre`/`afectaISR`/`afectaTSS` en ese
    instante (mismo patrón ya usado para congelar créditos de ISR) — editar
    o desactivar el concepto en el catálogo después nunca altera
    retroactivamente nóminas ya calculadas o cerradas.
  - **Aislamiento de la base TSS**: para que un ingreso personalizado exento
    de TSS no infle igual los topes de AFP/SFS/SRL, el motor
    (`dominican-labor.ts`) separa `totalBrutoLegado` (todo lo de ley, siempre
    grava/cotiza) de `totalBruto` (legado + TODO ingreso personalizado, para
    display/prestaciones) — las bases topadas de TSS/ISR se calculan sumando
    a `totalBrutoLegado` solo el subconjunto de ingresos personalizados cuyo
    flag realmente aplica (`ingresosPersonalizadosCotizablesTSS`/
    `ingresosPersonalizadosGravablesISR`), nunca el total sin filtrar.
  - Nueva función compartida `ajustesToParams()` en `dominican-labor.ts` —
    única fuente de verdad para convertir `AjusteLinea[]` en
    `ParametrosNomina`, usada ahora por `nomina/page.tsx` y
    `empleados/page.tsx` (antes cada uno tenía su propia lógica duplicada de
    bucketing; el duplicado de `empleados/page.tsx` tenía un bug preexistente
    — no manejaba `recargo_nocturno` — corregido como efecto colateral de la
    unificación). `reportes/page.tsx` ya importaba `ajustesToParams`
    directamente, así que no necesitó cambios.
  Verificado en navegador con matemática exacta: concepto "Bono Especial"
  (ingreso, afectaISR=true, afectaTSS=false) de RD$10,000 aplicado a María
  González Pérez (salarioBase RD$55,000) → AFP Empleado y SFS Empleado
  **sin cambio** (RD$1,578.50 / RD$1,672.00, confirmando la exención de
  TSS), ISR Retención sube exacto a RD$4,545.75 (cruza al tramo 20%), Salario
  Neto RD$57,204 — coincide centavo por centavo con el cálculo manual de
  verificación, incluyendo los aportes patronales (AFP/SFS Empleador
  calculados sobre RD$55,000, no RD$65,000, confirmando que la base TSS
  patronal tampoco se infla). Concepto "Descuento de Comedor" (deducción) de
  RD$2,000 aplicado a José Hernández Cruz → AFP/SFS/ISR **sin ningún cambio**,
  Salario Neto baja exacto en RD$2,000 (RD$39,593 → RD$37,593), confirmando
  que las deducciones personalizadas son 100% post-impuesto como exige la
  regla de negocio.

  (Contexto histórico — decisión original de diferir esto, ya superada por
  la implementación de arriba a petición explícita del usuario:) *Catálogo
  configurable de tipos de ingreso/descuento (flags de qué computa para
  prestaciones/ISR/TSS) en vez de lógica hardcodeada. Deliberadamente no
  implementado en su momento: a diferencia de los demás items de este
  backlog, este le da al usuario control directo sobre QUÉ tributa cada
  concepto — un error de configuración llevaría a una retención incorrecta y
  un problema real de cumplimiento legal, no solo un bug de UI. Generalizarlo
  requería diseño cuidadoso (¿quién audita los flags? ¿se versiona el
  catálogo por período para no alterar retroactivamente nóminas ya
  procesadas?) — ambas preguntas quedaron resueltas arriba (sin restricción
  de acceso confirmado por el usuario; snapshot-at-creation-time resuelve el
  versionado retroactivo).*
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
- **[FIXED tras decisión del usuario]** Suspender a un empleado lo sacaba de
  inmediato de cualquier período `en_proceso` ya abierto, sin prorratear los
  días ya trabajados. Ver "Prorrateo por suspensión + histórico fidedigno"
  más abajo — corregido con `empleadosDelPeriodo`/`diasSuspensionEnPeriodo`.

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
- **[FIXED tras decisión del usuario]** El sistema no guardaba ningún
  snapshot de salarioBase por período — "Nómina por Período" en Reportería,
  el tab "Historial Nómina" de Empleados, y
  `calcularSalarioPromedioUltimos12Meses` reconstruían nóminas pasadas con
  el salarioBase ACTUAL del empleado. Ver "Prorrateo por suspensión +
  histórico fidedigno" más abajo — corregido con
  `PeriodoNomina.resultadosPorEmpleado`.

**Fase 6 — Transversales:** Dashboard y Auth/Onboarding ya cubiertos en la
Fase 0. Configuración y modo oscuro verificados sin hallazgos nuevos
(Configuración, Procesar Nómina y Reportería en dark mode — buen contraste,
sin errores de consola).

**Cierre inicial — 9 bugs corregidos (2 críticos) y 2 hallazgos reportados
sin corregir** (requerían decisión de producto). `tsc --noEmit` y
`npm run build` limpios en los 6 commits de esta auditoría.

### Prorrateo por suspensión + histórico fidedigno (decisión del usuario, post-QA)

El usuario decidió explícitamente corregir los 2 hallazgos que la Fase 7
había dejado pendientes, en vez de solo documentarlos:

1. **Prorrateo al suspender un empleado a mitad de período.** Antes,
   suspender excluía al empleado por completo de cualquier período
   `en_proceso` ya abierto, sin pagar los días que sí trabajó. Ahora:
   - `empleadosDelPeriodo()` (`nomina/page.tsx`) incluye, además de los
     empleados normales, a cualquier suspendido cuya `fechaSuspension` caiga
     DENTRO del rango de fechas de ESE período específico (mes completo para
     mensual, mitad correspondiente 1-15/16-fin para quincenal) — un
     suspendido desde ANTES de que el período empezara sigue excluido del
     todo (0 días, comportamiento correcto).
   - `diasSuspensionEnPeriodo()` calcula la razón de días calendario
     trabajados sobre el total de días del período y la pasa como
     `diasTrabajados`/`diasLaborablesMes` a `calcularNomina` (mecanismo que
     ya existía en el motor pero ningún flujo lo alimentaba hasta ahora) —
     prorratea el salario proporcionalmente, sin tocar ningún otro cálculo.
   - Se actualizó el texto de advertencia del formulario de suspensión en
     `empleados/page.tsx`, que antes dejaba entender (incorrectamente) que
     la suspensión solo afecta nóminas futuras.
   - Verificado en navegador: José Hernández Cruz (salarioBase RD$43,000)
     suspendido el 15 de agosto (mes de 31 días) → S. Bruto exacto
     RD$20,806 (=43,000×15/31) en el período de Agosto 2026, con el resto
     de la planilla sin ningún cambio.

2. **Snapshot histórico fidedigno — `PeriodoNomina.resultadosPorEmpleado`.**
   Nuevo campo (`Record<string, ResultadoNomina>`) que guarda el resultado
   REAL calculado para cada empleado en el momento exacto de procesarlo
   (`marcarProcesados` en `periodos-context.tsx`, poblado desde
   `congelarYCalcular()` en `nomina/page.tsx`) — un registro inmutable de lo
   que realmente se pagó, que nunca cambia aunque el `Empleado` cambie
   después (aumento salarial, cambio de categoría de riesgo, etc.). Se
   limpia (`{}`) al reabrir un período vía desposteo, ya que ese snapshot
   quedaría obsoleto hasta que se vuelva a procesar.
   Toda pantalla que reconstruye una nómina PASADA ahora prefiere este
   snapshot sobre recalcular con el Empleado en vivo (con fallback al
   cálculo en vivo solo para períodos anteriores a este campo, sin
   snapshot): `resultadoDePeriodo()`/tabla principal y auditoría pre-cierre
   en `nomina/page.tsx`; `resultadoHistorico()` en `reportes/page.tsx`
   (Nómina por Período, Costo por Departamento, Cumplimiento Fiscal,
   Planilla Bancaria, Horas Extras, Proyección Anual, Empleados Sin
   Ingresos); el tab Historial Nómina en `empleados/page.tsx`; y
   `calcularSalarioPromedioUltimos12Meses()` en `dominican-labor.ts` (usado
   por Cesantía/Preaviso/Asistencia Económica en Liquidación).
   Verificado en navegador: tras darle a José un aumento a RD$60,000
   (tres veces su salario prorrateado real), el reporte "Nómina por
   Período" de Agosto 2026 sigue mostrando exactamente RD$20,806 — el
   monto real y prorrateado que se le pagó, no el salario nuevo ni el
   salario base completo.

`tsc --noEmit` y `npm run build` limpios. Todo fusionado a `main`.

### QA Fase 5 — revisión exhaustiva de Reportería (sesión posterior)

Otra sesión de QA revisó los 13 reportes de `reportes/page.tsx` línea por
línea (más allá del fix puntual de la Fase 5 original arriba) y encontró 4
bugs adicionales, todos siguiendo el mismo patrón raíz — usar
`empleados.filter(e => e.activo)` o `Object.entries(ajustesPorEmpleado)`
como proxy de "quién participó en este período histórico", en vez de la
membresía real (`resultadosPorEmpleado`):

- **[FIXED]** Desglose "Costo por Departamento" del Resumen Gerencial,
  el reporte standalone "Costo por Departamento", y **Cumplimiento
  Fiscal** (conciliación TSS/DGII — el más grave, por ser un reporte de
  cumplimiento contra la factura oficial CNSS) excluían por completo a
  cualquier empleado desvinculado después de un período ya cerrado.
- **[FIXED]** "Proyección Anual" — el costo YTD real usaba las claves de
  `ajustesPorEmpleado` (solo empleados con AL MENOS un ajuste ese período)
  en vez de la membresía real, excluyendo a cualquier empleado con nómina
  plana (sin ajustes, el caso más común) del acumulado ejecutado.
- **[FIXED]** El footer negro (`bg-zinc-950`) ya corregido en
  Vacaciones/Regalía aparecía sin corregir en 8 tablas más dentro de
  Reportería — corregido sistemáticamente en las 8.
- **[HALLAZGO, limitación inherente sin fix]** Períodos anteriores a la
  existencia del snapshot histórico no pueden reconstruir con exactitud lo
  que se pagó si el salario del empleado cambió después — el fallback
  recalcula con el salario ACTUAL. Verificado en vivo (Junio 2026 muestra
  el salario post-aumento de María en vez del histórico). No es una falla
  de diseño corregible, es un límite honesto de cualquier sistema que
  empieza a trackear historial en un punto del tiempo.

`tsc --noEmit` y `npm run build` limpios.

### QA — Fase 6 y cierre final

Fase 6 (Dashboard, Auth/Onboarding, Configuración, dark mode, responsive):
Dashboard y Auth/Onboarding ya cubiertos en Fase 0. Configuración revisada
directamente (perfil de empresa, resize de logo, tasaCambioUSD) sin
hallazgos. Modo oscuro verificado en Dashboard/Nómina/Reportería (incluye
el footer corregido en Fase 5, legible en ambos modos) y vista móvil
(390×844) en Dashboard — sin errores de consola, sin ruptura de layout.

**Cierre — 14 bugs corregidos (3 críticos) y 1 limitación inherente
documentada** (sin fix — no hay forma honesta de reconstruir salario
histórico para períodos anteriores a la existencia del snapshot). Los 2
hallazgos que la primera pasada había dejado pendientes (prorrateo por
suspensión, snapshot histórico) fueron corregidos en la sesión intermedia
por decisión explícita del usuario — ver sección arriba. `tsc --noEmit` y
`npm run build` limpios en todos los commits de la auditoría. Todo
fusionado a `main`.

## Rediseño de Configuración — hub por categorías (post-QA)

`src/app/configuracion/page.tsx` era un único formulario largo (perfil de
empresa, clasificación legal, rol del usuario, modalidad de nómina y tasa
USD, todo en una sola card) seguido de secciones sin jerarquía (Configuración
Inicial, Datos Demo, 3 tablas legales de solo lectura) — el usuario lo
describió como "un conjunto de cosas metidas en una ventana". Referencia dada
por el usuario: capturas de Alegra (hub de tarjetas por categoría, cada una
con descripción + lista de accesos). Instrucción explícita: replicar el
*patrón* (organización, propósito claro por sección), no el estilo visual
literal de Alegra — mantener la identidad navy de Cielo Cloud.

**Estructura nueva**: pantalla principal con 4→5 tarjetas de categoría
(ícono con degradado navy + halo, mismo lenguaje visual ya usado en
Configuración Inicial), cada una con un badge de "razón de ser" en 3
palabras y una vista dedicada con botón "← Configuración":

- **Empresa** ("Quién eres") — perfil, logo, contacto, categoría/sector,
  zona franca, rol del usuario.
- **Nómina** ("Cómo pagas") — modalidad de pago, tasa de cambio USD.
- **Reglas de Negocio** ("Cómo decides tú") — ver abajo, nueva.
- **Datos y Migración** ("De dónde vienes") — Configuración Inicial + Datos
  Demo.
- **Cumplimiento Legal** ("Qué exige la ley") — las 3 tablas de referencia
  (TSS, ISR, salarios mínimos), solo lectura.

**Nueva categoría "Reglas de Negocio"** — a pedido del usuario ("verifica el
sistema y agrega a Configuración lo que cada empresa deba poder adaptar"),
se auditó el código en busca de umbrales de negocio hardcodeados y se
migraron a `Empresa` (con default idéntico al valor anterior si no se
personalizan, 100% retrocompatible):
- `umbralEndeudamientoPct` (default 30) — antes `UMBRAL_CAPACIDAD_PAGO` en
  `prestamos/page.tsx` y `UMBRAL_DESCUENTO` en la auditoría pre-cierre de
  `nomina/page.tsx` eran DOS constantes hardcodeadas independientes para el
  mismo concepto (% de descuentos discrecionales sobre el salario) —
  unificadas en un solo umbral configurable que alimenta ambos módulos.
- `umbralVariacionBrutoPct` (default 20) — antes `UMBRAL_VARIACION` hardcodeado
  en la auditoría pre-cierre de Nómina (alerta cuando el bruto de un
  empleado varía más de X% vs. el período anterior).
- `plantillaComprobanteAsunto`/`plantillaComprobanteCuerpo` — la plantilla de
  correo de comprobantes de pago (`nomina/page.tsx`) NUNCA se persistía: era
  un `useState` inicializado con `plantillaComprobanteDefault()` que se
  reiniciaba al texto de fábrica cada vez que se abría la pantalla o se
  recargaba la página, sin ninguna forma de guardar una personalización.
  Nuevo helper `plantillaComprobanteDeEmpresa()` en `comprobante-email.ts`
  que prioriza lo guardado en `Empresa`, con fallback al default de fábrica.

Verificado en navegador: se cambió el umbral de endeudamiento a 25% en
Configuración → Reglas de Negocio, se guardó, y el panel de Capacidad de
Pago en Préstamos mostró exactamente "umbral configurable, 25%" — el mismo
valor, confirmando la propagación end-to-end. `tsc --noEmit` y
`npm run build` limpios.

## Retiro del módulo "Inicio de Año" (post-QA)

El usuario preguntó honestamente cuál era la razón de ser del módulo — no
lograba entender su función. Auditoría de sus 5 piezas antes de responder:

| Pieza | Veredicto |
|---|---|
| Tramos ISR / topes TSS (solo lectura) | Duplicado exacto de Configuración → Cumplimiento Legal |
| Calendario de pago anual (12/24 filas) | Decorativo — no se leía desde ningún otro módulo |
| Recordatorio IR-13 | Texto fijo sin fecha (evitaba afirmar un dato legal impreciso), sin ninguna lógica detrás |
| Feriados nacionales | **Único con valor real** — alimentaba el aviso de H.E. 100% en Procesar Nómina |
| Salarios mínimos (solo lectura) | Duplicado exacto de Configuración → Cumplimiento Legal |

Con el usuario de acuerdo ("Procede"), se retiró el módulo completo y se
reubicó únicamente la pieza con valor real:

- Eliminados: `src/app/inicio-de-ano/` (ruta completa), `src/lib/inicio-de-
  ano-context.tsx`, tipos `PagoPlanificado`/`ChecklistAnualEstado`, entrada
  del Sidebar.
- Nuevo `src/lib/feriados-context.tsx` (reemplaza `ChecklistAnualProvider`
  en `layout.tsx`) — contexto minimalista (`getFeriados`/`agregarFeriado`/
  `eliminarFeriado`), guardado por año calendario en una clave localStorage
  nueva (`cielo-feriados`, sin migración — el usuario confirmó que no existe
  ningún dato real de usuario en el sistema todavía).
- Card "Feriados Nacionales — {año}" reubicada en Configuración → Nómina
  (razón de ser: "Cómo pagas" — tiene sentido ahí porque afecta directamente
  el cálculo de horas extra). `nomina/page.tsx` actualizado para leer de
  `useFeriados()` en vez de `useChecklistAnual()`.

Verificado en navegador (Playwright, sesión demo con período Julio 2026 en
proceso): (1) se agregó un feriado de prueba en Configuración → Nómina, se
confirmó su persistencia en `localStorage['cielo-feriados']` y que sobrevive
un reload de página; (2) se creó un período mensual Agosto 2026, se abrió el
formulario de ajuste de un empleado, se seleccionó concepto "H.E. 35%" y el
aviso "Feriados de Agosto (calendario de Configuración → Nómina): 16 ago de
2026 (nombre del feriado)... regístralas como H.E. 100% en vez de H.E. 35%"
apareció correctamente — confirma el wiring end-to-end desde la nueva
ubicación. Sidebar ya no muestra "Inicio de Año" y `/inicio-de-ano` devuelve
404. `tsc --noEmit` y `npm run build` limpios (19 rutas, antes 20).

## Recreación premium de Configuración (post-QA)

Pedido explícito del usuario: convertir Configuración en "el mejor módulo de
configuración visualmente hablando que hayas visto en un ERP" — no un ajuste
menor, una recreación completa. El hub de tarjetas (click → navegación de
página completa con botón "← Configuración") del rediseño anterior se
reemplazó por el patrón de **rail persistente + panel de contenido continuo**
que usan las mejores herramientas de configuración de SaaS (Stripe, Vercel,
Linear) — sin salir nunca de una sola pantalla.

**Arquitectura nueva de `src/app/configuracion/page.tsx`:**
- **Rail izquierdo persistente** (`w-72`, oculto en móvil → franja de pills
  horizontal scrolleable en su lugar): buscador en vivo ("Buscar en
  configuración…", filtra por título/descripción/keywords de cada sección),
  ítem fijo "Resumen" arriba, luego dos grupos con encabezado ("Tu Negocio":
  Empresa/Nómina/Reglas de Negocio, "Sistema": Datos y Migración/Cumplimiento
  Legal). Cada `NavItem` usa el mismo lenguaje visual de estado activo que
  el `Sidebar` global (fondo `#eef0fb`, texto navy, indicador).
- **"Resumen"** — nueva pantalla de aterrizaje (antes no existía, la vista
  por defecto era un formulario). Card "hero" con logo/nombre/RNC de la
  empresa + botón "Editar perfil", seguida de 5 `ResumenCard` (una por
  sección) mostrando un stat en vivo calculado desde `empresa` real: "7/7
  campos completos", "Mensual · Solo RD$ · 3 feriados", "Endeudamiento 25% ·
  Variación 20%", etc. — cada card es clickeable y navega a esa sección.
- **Un solo punto de guardado**: se eliminaron los 3 botones "Guardar
  cambios" independientes (uno por formulario en Empresa/Nómina/Reglas, que
  ya secretamente compartían el mismo `form`/`guardar()`). Ahora una
  **barra flotante de cambios sin guardar** (`isDirty = JSON.stringify(form)
  !== JSON.stringify(empresa)`, calculado con `useMemo`) aparece con
  animación en la esquina inferior del panel de contenido — "Cambios sin
  guardar" + botones "Descartar" (revierte `form` a `empresa`) / "Guardar
  cambios" — visible en cualquiera de las 3 secciones tipo formulario. Hace
  explícito lo que antes era implícito (las 3 secciones comparten el mismo
  registro `Empresa`) y es un patrón más honesto que 3 botones idénticos.
- **Contenido agrupado en `SettingsCard`** (icono + título + descripción +
  cuerpo) en vez de un único formulario largo por sección — Empresa se
  dividió en 4 cards (Identidad, Ubicación y Contacto, Clasificación para
  Nómina, Tu Rol); Nómina en 2 (Modalidad y Moneda, Feriados Nacionales);
  Reglas de Negocio en 2 (Umbrales de Alerta, Plantilla de Correo);
  Cumplimiento Legal en 3 (una por tabla, con íconos distintos: Landmark
  para TSS, Percent para ISR, Coins para Salarios Mínimos).
- **`ThresholdSlider`** — los inputs numéricos planos de "Reglas de Negocio"
  (endeudamiento, variación) se convirtieron en sliders con badge de valor
  en vivo (`25%`) y track/thumb estilizados con `accent-color` +
  `[&::-webkit-slider-thumb]`/`[&::-moz-range-thumb]` — el tipo de detalle
  visual que distingue un ERP premium de un formulario genérico.
- **`FieldInput`** — inputs con ícono prefijo (Building2/MapPin/Phone/Mail/
  UserCircle2/Coins/CalendarDays) para los campos donde el ícono aporta
  reconocimiento visual instantáneo (nombre, ciudad, teléfono, email,
  representante legal, tasa USD, fecha de feriado).
- **Transición de contenido**: nuevo keyframe `content-in` (`globals.css`) —
  fade + `translateY(6px)` de 0.25s, aplicado vía `key={vista}` en el
  wrapper de contenido para que se re-dispare en cada cambio de sección.
- Se conserva el 100% de la lógica de negocio previa sin cambios: logo
  (resize a canvas 320px), validación de tamaño, `handleAgregarFeriado`,
  `handleCargarDemo`, el modal de confirmación de datos demo, y las 3 tablas
  legales de solo lectura — la recreación es de shell/visual, no de
  funcionalidad.

Verificado en navegador (Playwright, escritorio 1440×900 + móvil 390×844,
claro y oscuro): Resumen muestra los 5 stats correctos calculados desde
datos demo reales; el buscador filtra en vivo (query "feriado" → solo
"Nómina" en resultados); editar el nombre de la empresa dispara la barra
flotante ("Cambios sin guardar": true), Guardar la hace desaparecer y
muestra el toast "Datos guardados"; Descartar revierte sin persistir. Sin
errores de consola en ninguna combinación de viewport/tema. `tsc --noEmit`
y `npm run build` limpios (19 rutas, sin cambios de conteo — la recreación
es interna a una sola ruta).

## Segunda pasada de Configuración — feedback directo del usuario

El usuario probó el rediseño anterior y dio dos críticas concretas: *"siento
que falta algo para que le dé ese toque especial que tienen sistemas como
QuickBooks o SAP"* y *"en resumen me estás repitiendo la misma información
que está en la barra lateral"* — el panel "Resumen" mostraba 5 tarjetas con
el mismo título/descripción que ya aparecían en el rail de navegación, sin
aportar nada nuevo.

**Fix del Resumen — de directorio duplicado a panel de estado real:**
- Ya no repite las 5 secciones como tarjetas. En su lugar calcula un
  **checklist de 4 señales reales** (`ChecklistItem[]`, tipo movido a nivel
  de módulo — ver nota de SWC abajo): perfil de empresa completo (7 campos),
  logo subido, feriados del año registrados, y empleados con saldos
  iniciales sin revisar (`empleadosActivos.filter(e =>
  e.saldosInicialesRevisado !== true)`, mismo dato real que ya usa
  `ConfiguracionInicialFlow`, ahora también en `useEmpleados()` aquí).
- **Anillo de completitud** (`conic-gradient` de 2 capas — track con clases
  Tailwind `bg-zinc-200 dark:bg-[#252840]` debajo, arco de progreso
  `#1B2980` con `transparent` para el resto encima, así el track sí es
  theme-aware en vez de un hex fijo) mostrando el % de items del checklist
  completados.
- **Lista de pendientes accionables**: cada item incompleto aparece como fila
  clickeable (ícono + label + sublabel con el dato real, ej. "6 empleados
  sin revisar") que navega directo a la sección correspondiente. Si no hay
  pendientes, un estado positivo verde "Todo en orden" en vez de una lista
  vacía.
- **"Última actualización"**: nuevo campo `Empresa.actualizadoEn` (ISO
  timestamp), estampado automáticamente dentro de `guardar()` en
  `empresa-context.tsx` — cualquier guardado futuro lo actualiza sin que
  ninguna pantalla tenga que acordarse de hacerlo. Nuevo helper
  `formatRelativeTime()` en `utils.ts` ("hace 3 días" / "hace unos
  segundos", cae a `formatDate()` después de 30 días).

**Fix del "toque especial" — patrones reales de QuickBooks/SAP, no solo
más color:**
- **`CollapsibleCard`** — nuevo componente que reemplaza el formulario
  siempre-abierto por el patrón real de QuickBooks Settings: resumen de
  solo lectura + botón "Editar" (ícono `Pencil`) que expande el formulario
  in situ, con "Cerrar" (ícono `X`) para volver a colapsar. El resumen lee
  de `form` (no de `empresa`), así que un cambio sin guardar sigue visible
  al colapsar la tarjeta. `isEmpty` fuerza el estado abierto la primera vez
  (empresa recién creada, nada que resumir todavía). Aplicado a las 4
  tarjetas que son formularios largos y se benefician de estar colapsadas
  por defecto: Identidad, Ubicación y Contacto (Empresa), Modalidad y
  Moneda (Nómina), Plantilla de Correo (Reglas de Negocio). Las tarjetas de
  selección por botones (Clasificación, Tu Rol) y las de sliders/listas
  (Umbrales, Feriados) se quedan como `SettingsCard` siempre-abierta, porque
  ya muestran su estado actual sin necesitar modo edición.
- **`ToggleSwitch`** — reemplaza el checkbox nativo de "zona franca" por un
  interruptor animado real (pill + thumb con `translate-x`), el tipo de
  control que un checkbox de HTML no transmite por sí solo en un ERP.
- **Validación de formato de RNC en vivo** — `rncEsValido()` (9 dígitos RNC
  empresa u 11 cédula persona física), badge verde/ámbar bajo el campo,
  puramente informativo (nunca bloquea guardar, mismo principio que los
  umbrales de Reglas de Negocio).

**Bug de compilación encontrado y corregido durante la verificación:** una
`interface ChecklistItem` declarada dentro del cuerpo de la función del
componente compilaba limpio con `tsc --noEmit` pero rompía el parser TSX de
SWC (`next dev`) con "Unexpected token `div`. Expected jsx identifier" justo
en el `return (` siguiente — un choque conocido entre declaraciones de tipo
locales y JSX en archivos `.tsx` que tsc no detecta pero SWC sí. Fix: mover
la interfaz a nivel de módulo, junto a `ParamRow`/`Seccion` (mismo patrón ya
usado para los demás tipos de este archivo). Lección para el futuro: cuando
`tsc --noEmit` pasa pero `next dev` muestra una pantalla de carga sin
avanzar, revisar el log del dev server (no solo tsc) — puede ser un error de
parseo de SWC invisible para TypeScript.

Verificado en navegador (Playwright, escritorio 1440×900, claro y oscuro):
el Resumen ahora muestra "25% configuración completa" con anillo real y 3
pendientes con datos reales (incluyendo "6 empleados sin revisar", que
coincide exactamente con el contador de `ConfiguracionInicialFlow`); las
tarjetas de Empresa/Nómina/Reglas cargan colapsadas mostrando el resumen
correcto; "Editar" expande el formulario, "Cerrar" lo colapsa de nuevo sin
perder cambios pendientes; el RNC "12345" muestra la advertencia ámbar y
"101528473" el check verde; el toggle de zona franca cambia de estado y
dispara la barra de cambios sin guardar. `tsc --noEmit` y `npm run build`
limpios (19 rutas).

## Multiempresa — una cuenta, varias empresas

Pedido del usuario, retomando la conversación sobre "Opción A" de varias
sesiones atrás (contador que maneja 3 empresas, cada una con su propio ID,
facturable independientemente del contador — la parte de facturación queda
para cuando exista backend, pero el mecanismo de "varias empresas por
cuenta" no depende de tener backend y se construyó ahora, 100% client-side).

**Backup de seguridad antes de empezar** (pedido explícito del usuario dado
el alcance del cambio): rama `backup/pre-multiempresa-3a6da56` creada y
pusheada a origin, apuntando exactamente al commit anterior a este trabajo
— punto de rollback si algo sale mal.

**Arquitectura — antes vs. después:**
- Antes: una cuenta (uid de Firebase Auth) = una `Empresa`. Cada uno de los
  10 contextos de negocio (`empleados`, `periodos`, `prestamos`, `aumentos`,
  `licencias`, `bandas-salariales`, `liquidaciones`, `saldo-isr`,
  `feriados`, más `cielo-agenda-custom`/`cielo-agenda-done` en
  `AgendaNomina.tsx`) guardaba su localStorage con la key `base::{uid}` vía
  `useUserScopedKey`.
- Ahora: una cuenta puede tener **N empresas**, cada una con su propio `id`
  (`Empresa.id`, nuevo campo requerido en el tipo). Los mismos 10+1
  contextos ahora usan `useEmpresaScopedKey` (nuevo hook,
  `src/lib/empresa-scoped-key.ts`) que compone la key como
  `base::{uid}::{empresaId}` — cambiar de empresa activa cambia
  automáticamente TODO lo que el sistema muestra, sin lógica de "reset"
  manual en ningún contexto: cada uno ya recalculaba su estado en un
  `useEffect` sobre `[key, ready]`, así que un cambio de `empresaId` que
  cambia `key` dispara la recarga solo. Migración mecánica de los 9
  contextos de `src/lib/*-context.tsx` vía `sed` (mismo patrón exacto en
  los 9 archivos: import + una línea de uso).
- **Nuevo `src/lib/empresas-context.tsx`** (`EmpresasProvider`/
  `useEmpresas()`) — la lista de empresas de la cuenta + cuál está activa.
  Scopeado solo por `uid` (`useUserScopedKey`, el hook original, sin tocar)
  porque esto ES la lista de empresas, no datos de una empresa en
  particular. Garantiza que toda cuenta tenga siempre ≥1 empresa (la crea
  en silencio en el primer login, sin pantalla dedicada — el Asistente de
  Onboarding ya cumple el rol de "configura tu primera empresa" porque
  `needsOnboarding` en `RouteGuard` sigue evaluando `!empresa.onboardingCompleto`
  de la empresa activa, que para una empresa recién creada es `false`).
  Expone `crearEmpresa`/`cambiarEmpresa`/`eliminarEmpresa`/
  `actualizarResumen`.
- **`src/lib/empresa-scoped-bases.ts`** — módulo sin dependencias de React
  (evita un import circular entre `empresas-context.tsx` y
  `empresa-scoped-key.ts`, que si dependiera de `useEmpresas()` no podría
  ser importado de vuelta por `empresas-context.tsx`). Contiene
  `EMPRESA_SCOPED_BASES` (las 11 bases de localStorage propias de una
  empresa) y `buildEmpresaScopedKey()` (compositor de key puro, reutilizado
  tanto por el hook de React como por `seed-data.ts`, que corre fuera de
  React).
- **`empresa-context.tsx`** (el perfil de UNA empresa) ahora depende de
  `useEmpresas()` para saber cuál es la empresa activa — su `guardar()`
  también sincroniza `nombre`/`logo` de vuelta a `EmpresasCtx` vía
  `actualizarResumen()`, así el selector del Sidebar siempre refleja el
  nombre real sin que el usuario lo escriba dos veces.
- **`eliminarEmpresa()`** limpia las 11 bases de localStorage scopeadas a
  esa empresa (evita datos huérfanos) y garantiza que la cuenta nunca se
  quede sin ninguna empresa (crea una vacía si se elimina la última).
- **`seed-data.ts`** (`cargarDatosDemo`) ahora requiere `empresaId` además
  de `uid`, usa `buildEmpresaScopedKey()`, estampa `empresa.id`, y
  sincroniza el nombre resultante en la lista de empresas (sin esto el
  selector seguiría mostrando "Empresa sin nombre" tras cargar la demo).
- **`layout.tsx`**: `EmpresasProvider` envuelve TODO lo demás (incluido
  `EmpresaProvider`), porque todos los demás providers ahora dependen
  transitivamente de saber cuál es la empresa activa.
- **`RouteGuard.tsx`**: el efecto que precarga datos demo para la cuenta
  admin ahora también espera a `empresaActivaId` antes de llamar
  `cargarDatosDemo`.

**Selector de empresas — `EmpresaSwitcher` en `Sidebar.tsx`:** nuevo
componente insertado justo debajo del logo/wordmark, con el mismo
tratamiento visual que el resto de la barra lateral. Botón principal
muestra logo/inicial + nombre + "N empresas"; despliega un dropdown con la
lista completa (marca la activa con un check), un ícono de papelera por
fila (visible solo si hay más de una empresa — nunca se puede eliminar la
última desde aquí sin dejar la cuenta en cero, ese caso lo cubre
`eliminarEmpresa` internamente creando una vacía) con confirmación
destructiva (mismo patrón de modal que "Cargar Datos Demo"), y "+ Nueva
empresa" al fondo. Colapsa a un ícono compacto cuando el Sidebar está
colapsado, con `title` para accesibilidad.

**Verificado en navegador (Playwright, flujo completo):** onboarding de
Empresa Uno → cargar datos demo → crear Empresa Dos desde el switcher (usa
`OnboardingWizard` sin ningún cambio, porque una empresa nueva vacía
dispara `needsOnboarding` igual que una cuenta nueva) → confirmado que
Empresa Dos NO tiene ningún empleado de la demo de Empresa Uno (aislamiento
real) → cambiar de vuelta a Empresa Uno → confirmado que sus datos siguen
intactos (María González, empleado demo, reaparece exacto). Eliminar una
empresa desde el dropdown: diálogo de confirmación nombra la empresa
correcta dinámicamente, tras confirmar el contador baja a "1 empresa" y la
empresa eliminada desaparece de la lista. Verificado también en sidebar
colapsado y modo oscuro — sin errores de consola en ningún caso. `tsc
--noEmit` y `npm run build` limpios (19 rutas, sin cambios de conteo).

**No implementado en esta sesión** (fuera de alcance, depende de backend
real — ver conversación previa sobre "Opción A"): facturación por empresa
individual, roles/permisos multiusuario sobre una misma empresa, e
invitar a otro usuario a colaborar en una empresa. El mecanismo de hoy es
100% local (una sola cuenta, varias empresas en su propio navegador) — la
API/backend (pendiente, tema aparte discutido con el usuario) sería lo que
habilitaría compartir una empresa entre múltiples cuentas/usuarios.

## Corrección de arquitectura — multiempresa con cuentas reales separadas

El usuario probó el mecanismo anterior ("empresas como perfiles dentro de
una misma cuenta") y señaló que no era lo que pidió: al agregar una
empresa, el sistema debía ofrecer **iniciar sesión en una cuenta ya
creada** o **crear una cuenta nueva con su propio correo y verificación**
— es decir, cada empresa debía ser una **cuenta de Firebase Auth real e
independiente**, no un perfil compartiendo el mismo login. Esto es, de
hecho, la interpretación correcta de la "Opción A" ya discutida antes en
esta sesión ("cada empresa paga su cuota independiente... con un ID X") —
el uid real de Firebase de cada cuenta ES ese ID.

Se le presentó al usuario la disyuntiva explícitamente (cuentas reales
separadas vs. mantener el modelo de perfiles internos) antes de tocar
código, porque implicaba reconstruir lo recién hecho — confirmó cuentas
reales.

**Reversión de la capa de scoping por `empresaId`:** dado que ahora cada
empresa = su propio uid real de Firebase, la composición `base::{uid}::{empresaId}`
introducida en el intento anterior ya no tenía sentido — `useUserScopedKey`
(`base::{uid}`) vuelve a ser exactamente correcto, porque el uid YA
distingue una empresa de otra. Se restauraron desde la rama de respaldo
`backup/pre-multiempresa-3a6da56` los 10 contextos de negocio,
`empresa-context.tsx`, `seed-data.ts`, `types/index.ts`, `layout.tsx` y
`RouteGuard.tsx` a su estado previo a la primera implementación, y se
eliminaron `empresas-context.tsx`/`empresa-scoped-key.ts`/`empresa-scoped-bases.ts`
(el concepto de "lista de empresas dentro de una cuenta" ya no aplica).

**Arquitectura real — multicuenta vía Firebase Auth:**
- **`src/lib/firebase.ts`** — nuevo `getFirebaseAuthNamed(appName)`: cada
  empresa vinculada en el dispositivo vive en su propia instancia de
  Firebase App identificada por nombre (mismo proyecto/config). Firebase
  persiste el estado de sesión por separado para cada nombre de app
  (confirmado con pruebas reales, no solo documentación) — esto permite
  tener más de una cuenta autenticada simultáneamente en la misma pestaña,
  y cambiar entre cuentas YA vinculadas es prácticamente instantáneo
  (~1s en la prueba real, sin volver a pedir contraseña). `DEFAULT_APP_NAME`
  mantiene la cuenta "de siempre" funcionando exactamente igual que antes
  de este cambio, sin ninguna migración — cero riesgo de regresión para
  cuentas ya existentes.
- **`src/lib/auth-context.tsx`** — reescrito para gestionar un registro de
  `CuentaVinculada[]` (appName, uid, email, displayName, photoURL) +
  `cuentaActivaAppName`, persistido en `cielo-cuentas-vinculadas`
  (localStorage plano, sin scope de cuenta — es lo que hace posible saber
  a cuál cambiar). Nuevas acciones: `cambiarCuenta`, `agregarCuentaLogin`,
  `agregarCuentaRegistro`, `quitarCuenta`. `signIn`/`signUp`/`signInGoogle`/
  `logout` existentes se mantienen con la MISMA firma (cero cambios en
  `/login`, `/registro`, `Header.tsx`, `EmailVerificationGate.tsx`) — ahora
  operan sobre la cuenta activa en vez de siempre la app default.
- **`src/lib/firebase-errors.ts`** (nuevo) — mensajes de error en español
  reutilizados entre `/login`, `/registro` y el nuevo selector, combinando
  los dos mapeos que antes vivían duplicados por separado en cada página.
- **`CuentaSwitcher` en `Sidebar.tsx`** (reemplaza el `EmpresaSwitcher`
  anterior) — mismo lugar/tratamiento visual bajo el logo. Lista las
  cuentas vinculadas (con nombre de empresa resuelto best-effort leyendo
  `cielo-empresa::{uid}` directo de localStorage — sin necesidad de
  "cambiar" de verdad solo para mostrar el nombre en la lista) y un botón
  "Agregar empresa" que abre `AgregarCuentaModal` (ver abajo). "Quitar" una
  cuenta del dispositivo ya NO requiere confirmación destructiva (a
  diferencia del intento anterior) porque no borra ningún dato — el dato
  sigue seguro en la cuenta real de Firebase, solo se cierra sesión
  localmente y se quita de la lista rápida.

**Corrección — "Agregar empresa" a pantalla completa, no un formulario
compacto en el dropdown:** la primera versión de "Agregar empresa" abría un
mini-formulario de login/registro embebido dentro del propio menú
desplegable del sidebar. El usuario lo rechazó explícitamente ("no estamos
haciendo una baratija es algo premium") — el resto de la app (`/login`,
`/registro`, `OnboardingWizard`) usa transiciones a pantalla completa, y
este flujo, siendo la puerta de entrada a una segunda empresa/cliente
completa, merecía el mismo tratamiento.
- **`src/components/auth/AgregarCuentaModal.tsx`** (nuevo) — overlay
  `fixed inset-0` a pantalla completa (`animate-backdrop-in`) que replica
  exactamente el layout de dos paneles de `/login`/`/registro`: panel de
  marca navy con círculos decorativos + 4 bullets ("Cada empresa con su
  propio correo y datos", "Aislamiento completo entre empresas", "Cambia
  entre empresas vinculadas en segundos", "Ideal para contadores con varios
  clientes") a la izquierda, formulario a la derecha con botón de cierre (X).
  Tres pasos internos (`'elegir' | 'login' | 'registro'`): tarjetas grandes
  "Ya tengo una cuenta" / "Es una empresa nueva" → formulario de login o de
  registro completo (con `PasswordStrength`, confirmación de contraseña,
  estado de éxito con auto-cierre). Reemplaza el formulario compacto que
  vivía inline en `CuentaSwitcher`.
- **`src/lib/auth-context.tsx`** — nueva acción `agregarCuentaGoogle()`
  (`signInWithPopup` sobre una instancia de Firebase App nueva, mismo
  patrón que `agregarCuentaLogin`/`agregarCuentaRegistro`) para que el botón
  "Continuar con Google" del modal también pueda vincular una segunda
  cuenta, no solo correo/contraseña.
- **`src/components/auth/GoogleIcon.tsx`** (nuevo) — ícono "G" de Google
  extraído como componente compartido (antes duplicado inline en `/login`
  y `/registro`), usado también por el nuevo modal.

Verificado en navegador con cuentas reales de Firebase: desde el switcher,
"Agregar empresa" abre el modal de pantalla completa con el panel de marca;
"Es una empresa nueva" → formulario de registro completo → cuenta real
creada → estado de éxito → auto-cierre hacia el `OnboardingWizard` de la
cuenta nueva, cero errores de consola. Paso "login" y modo oscuro
verificados visualmente por separado (mismo panel de marca, campos legibles
en fondo oscuro). `tsc --noEmit` y `npm run build` limpios.

**Lección de infraestructura de esta sesión — proxy de red para pruebas
con servicios reales:** verificar este cambio requirió que el navegador de
Playwright alcanzara Firebase real (`identitytoolkit.googleapis.com`), lo
que reveló que el navegador no puede salir a internet directo en este
sandbox (`ERR_CONNECTION_RESET`) y que la lista de bypass de proxy de
Chromium no exceptuaba `localhost` como se esperaba (seguía dando
`405 Method Not Allowed` en el propio servidor de desarrollo). Solución:
en vez de proxyar el navegador completo, se interceptó específicamente el
tráfico hacia `identitytoolkit.googleapis.com`/`securetoken.googleapis.com`
vía `context.route()` de Playwright y se reenvió desde Node usando su
propio `fetch` con `NODE_USE_ENV_PROXY=1` (Node ≥22.21, sí respeta
`HTTPS_PROXY` correctamente) — el resto del tráfico (`localhost:3000`)
sigue sin proxy, sin conflicto. Este puente (`proxy-bridge.js`, solo en el
scratchpad de la sesión, nunca en el repo) es la forma correcta de probar
en este entorno cualquier funcionalidad futura que dependa de un servicio
externo real desde el navegador.

Verificado en navegador con **cuentas reales de Firebase** (no simuladas):
registro de Cuenta A vía `/registro` → onboarding → "Empresa A Real SRL";
desde el selector, "Agregar empresa" → "Crear cuenta nueva" → segunda
cuenta real vinculada → onboarding → "Empresa B Real EIRL"; el selector
lista ambas cuentas con su correo real; cambiar de Empresa B de vuelta a
Empresa A restaura su dashboard exacto (confirmando aislamiento real entre
dos uids de Firebase distintos) en ~1 segundo, sin pedir contraseña de
nuevo. Cero errores de consola. `tsc --noEmit` y `npm run build` limpios
(19 rutas).

## Rediseño premium de Login y Registro

Pedido explícito del usuario: "la mejor pantalla de login y sign in que
visualmente hayas visto para un ERP" — moderna, premium, y con imágenes
reales sin copyright si se usaban.

- **Fotografía real** — fachada de vidrio de un edificio de oficinas al
  atardecer, descargada de Unsplash (`unsplash.com/photos/em1BsVhLIGQ` no
  usado por 404; imagen final: `photo-1745015446589-7ee6f702d8c1`, Unsplash
  License — libre de uso comercial, sin atribución requerida) y optimizada
  con Pillow a 1400px de ancho / ~550KB (`public/images/auth/glass-facade.jpg`).
  Se descartaron candidatos con logos de bancos reales visibles (Union
  Bank) o ubicación no verificable (no se afirma que sea Santo Domingo,
  para no inventar un dato). El sitio de Unsplash bloquea scraping directo
  (Anubis) pero el endpoint `unsplash.com/photos/<id>/download` sí
  redirige (302) a la URL real de `images.unsplash.com` sin bloqueo —
  patrón reutilizable para descargar fotos reales curadas por búsqueda en
  este entorno.
- **`src/components/auth/AuthBrandPanel.tsx`** (nuevo, compartido entre
  `/login` y `/registro`) — la fotografía con animación Ken Burns lenta
  (`animate-ken-burns`, 26s), velo de gradiente navy para legibilidad,
  grano SVG sutil (`mix-blend-overlay`), y dos tarjetas flotantes de
  vidrio (`animate-float-slow`/`animate-float-slower`) que muestran el
  producto real en vez de cifras de clientes inventadas (la app está
  pre-lanzamiento, sin usuarios reales que reportar): un mini-comprobante
  "Nómina de julio — RD$284,750.00 — 24 empleados" y un badge "TSS, ISR y
  Ley 16-92 al día".
- **Panel derecho** — tarjeta blanca/oscura elevada (`shadow-xl`, borde
  sutil) con entrada animada (`animate-auth-card-in`, nuevo keyframe en
  `globals.css` — renombrado desde un `content-in` que hubiera chocado con
  el ya existente de Configuración), fondo con gradiente radial muy sutil
  en vez de plano. Campos con ícono líder (`Mail`/`Lock`/`User` de
  lucide-react) y botón primario con gradiente de marca
  (`from-[#1B2980] to-[#2f3fa8]`) + elevación al hover, mismo lenguaje
  visual que `AgregarCuentaModal`.
- Ambas páginas reutilizan `firebaseAuthMsg` y `GoogleIcon` ya compartidos
  (eliminando la última duplicación de esas funciones que quedaba en
  `/login` y `/registro`).
- **Video de transición** — el usuario preguntó si convenía usar video
  corto. Se optó por NO usarlo: en un sitio estático sin backend
  (`output: 'export'`, GitHub Pages) un video añade peso y riesgo de
  licencia sin aportar más que la animación CSS (Ken Burns + tarjetas
  flotantes), que ya logra la sensación de "vivo" sin el costo de carga.
- Verificado en navegador (dev con Firebase real): light y dark mode,
  vista móvil (420px), build de producción limpio y el bundle JS contiene
  la ruta `/tyui/images/auth/glass-facade.jpg` con el `basePath` correcto.
  `AgregarCuentaModal` se dejó con su panel de marca plano original (fuera
  de alcance de este pedido) — queda como posible extensión futura para
  unificar el lenguaje visual en las 3 superficies de auth.

## Paletazo de comandos (Cmd+K) + skeletons con forma en el Dashboard

Segunda ronda de pulido visual (post-login), tras pregunta directa del
usuario sobre cuánto margen quedaba para seguir mejorando visualmente —
se auditó el resto de la app (agente de solo lectura) y se identificaron,
con evidencia concreta, cinco brechas frente al nuevo estándar del login:
loading states solo con spinner (cero skeletons en toda la app), estados
vacíos genéricos, sin paletazo de comandos, PDF de comprobante plano, y
micro-interacciones mínimas fuera de auth. Se priorizaron las dos de
mayor impacto por esfuerzo: Cmd+K y skeletons con forma real.

- **`src/lib/nav-items.ts`** (nuevo) — lista canónica `NAV_ITEMS` +
  `CONFIGURACION_ITEM` (href/icon/label/keywords), única fuente de verdad
  para la navegación. `Sidebar.tsx` se refactorizó para importarla en vez
  de declarar su propio array local (cero cambio visual/funcional en el
  sidebar, solo elimina duplicación).
- **`src/components/command-palette/CommandPalette.tsx`** + **`src/lib/command-palette-context.tsx`**
  (nuevos) — paletazo estilo Linear/Raycast: overlay centrado arriba
  (`pt-[12vh]`) con backdrop blur, campo de búsqueda con normalización de
  acentos (`normalize('NFD')`), navegación con flechas/Enter/Escape,
  agrupado en dos secciones — **Navegación** (los mismos `NAV_ITEMS`) y
  **Acciones** (cambiar tema claro/oscuro vía `useTheme`, cerrar sesión
  vía `useAuth`). `CommandPaletteProvider` registra el atajo global
  `Cmd+K`/`Ctrl+K` (ambos, sin detectar plataforma) y monta el modal una
  sola vez; se envolvió en ambas ramas de `RouteGuard.tsx` (con y sin
  Firebase habilitado) alrededor de `Sidebar`/`BottomNav`/`children`, así
  que solo está disponible para páginas ya autenticadas, nunca en
  `/login`/`/registro`. Botón visible "Buscar… ⌘K" agregado a `Header.tsx`
  (aparece en todas las páginas, ese componente ya es compartido).
- **`src/components/charts/ChartSkeleton.tsx`** (nuevo) — placeholders con
  la FORMA real de cada tipo de gráfico (barras de alturas variables,
  anillo SVG para el donut, curva SVG para la línea de tendencia) en vez
  del rectángulo gris plano (`animate-pulse rounded bg-zinc-50`) que
  compartían las 3 gráficas del Dashboard. Reemplazado en los 3 lugares
  donde vivía ese placeholder: el `loading` de cada `dynamic()` en
  `src/app/page.tsx` Y el fallback interno `if (!mounted)` de
  `PayrollBarChart`/`CostDonutChart`/`TrendLineChart` (evita el flash de
  hidratación de Recharts). Nota de alcance: esta app no tiene backend
  (`output: 'export'`, todo el estado sale de localStorage de forma
  síncrona) — el único "loading" real es la carga del chunk JS
  code-splitteado, así que el efecto es sutil/transitorio a propósito, no
  se justificaba construir un sistema de skeletons más grande sin latencia
  real que ocultar.
- Verificado en navegador con cuenta real: Cmd+K abre y cierra con teclado
  y con el botón del header, filtra en vivo ("presta" → solo "Préstamos"),
  Enter navega y cierra el modal, la acción "Cambiar a modo oscuro" alterna
  el tema real de la app al ejecutarse desde la paleta, y todo se ve
  correcto en dark mode (blur, colores, texto). `tsc --noEmit` y
  `npm run build` limpios (19 rutas).

## Tercera ronda de pulido visual — estados vacíos, PDF y botones primarios

Cierre de las 5 brechas identificadas en la auditoría post-login (las 2
primeras — Cmd+K y skeletons — quedaron en la ronda anterior). El usuario
pidió explícitamente continuar hasta terminar las 3 restantes.

- **`src/components/ui/EmptyState.tsx`** (nuevo) — estado vacío compartido:
  badge de ícono `h-14 w-14 rounded-2xl bg-[#eef0fb]` con halo `blur-lg`
  detrás (mismo lenguaje que las tarjetas flotantes del login), título
  opcional, mensaje, y acción opcional. Reemplaza 5 implementaciones
  distintas que habían divergido con el tiempo: el `EmptyState` local de
  `reportes/page.tsx` (icono gris genérico + caja punteada, usado en 15+
  reportes — ahora importa el compartido sin tocar los call sites, porque
  la prop `message` se mantuvo compatible), el ícono SVG a mano de
  `empleados/page.tsx` ("sin resultados" filtrados), el de
  `prestamos/page.tsx` ("sin préstamos en esta categoría"), el texto plano
  sin ícono de `bandas-salariales/page.tsx` (distribución salarial vacía),
  y una fila de tabla sin ícono en `aumentos/page.tsx` ("sin solicitudes
  pendientes" — la auditoría inicial había atribuido este caso por error a
  `prestamos/page.tsx`; se verificó el archivo real antes de tocar código).
- **`BTN_PRIMARY`** (nuevo, `src/lib/utils.ts`) — clase compartida para el
  CTA principal de cada página (gradiente `from-[#1B2980] to-[#2f3fa8]` +
  `hover:-translate-y-0.5` + `hover:shadow-lg shadow-[#1B2980]/25`, el
  mismo tratamiento que ya tenían las pantallas de auth). La auditoría
  encontró el mismo string de clase literal duplicado en `empleados/page.tsx`
  y `prestamos/page.tsx` ("Nuevo Empleado"/"Nuevo Préstamo") — ahora es una
  sola fuente de verdad, aplicada a los CTAs principales de: Empleados,
  Préstamos (crear + formularios de otorgar/registrar pago), Bandas
  Salariales, Licencias, Liquidación, Nómina (crear período, descargar PDF,
  confirmar auditoría pre-cierre, cerrar modal de envío) y Reportería
  (constante `primaryBtn` local reasignada a `BTN_PRIMARY`, actualiza los
  botones de exportar Excel/PDF de los 15+ reportes de una sola vez).
  **Alcance deliberado**: NO se aplicó a botones compactos dentro de tablas
  (chips de acción por fila) — serían ruido visual frente al principio ya
  establecido de "mínimo color en tablas". Tampoco se tocó `StatCard`
  (su falta de hover-shadow es una decisión de diseño ya documentada y
  deliberada, no un descuido).
- **PDF del comprobante de nómina** (`descargarComprobantePDF` en
  `nomina/page.tsx`) — mismo jsPDF/Helvetica de siempre (sin fuentes
  custom, por confiabilidad), pero con tratamiento visual real: header con
  filo navy más claro para dar profundidad, bloque de datos del empleado
  envuelto en una tarjeta gris muy tenue en vez de texto suelto, chips de
  color (cuadro navy chico) antes de "DEVENGOS"/"DESCUENTOS" en vez de solo
  texto, sombreado alterno por fila (zebra striping) para legibilidad, la
  caja navy de "SALARIO NETO A PAGAR" con un filo superior más claro, el
  bloque "APORTES EMPRESA (TSS)" ahora envuelto en su propia tarjeta con
  fondo tintado, y un pie de página FIJO al fondo real de la página
  (`doc.internal.pageSize.getHeight()`, no donde termine el contenido
  dinámico) con "Cielo Cloud · Nómina" + fecha de generación — como en un
  membrete real, consistente sin importar cuánto contenido tenga el
  comprobante. Verificado descargando un PDF real desde el navegador
  (cuenta con datos demo, período cerrado) y leyendo el PDF resultante.
- Verificado: `tsc --noEmit` y `npm run build` limpios (19 rutas).

## Cuarta ronda — filas de tabla clickeables (affordance de hover)

Última de las micro-interacciones pedidas explícitamente por el usuario
("dale con las micro interacciones"). Se auditó el hover de filas en las
~12 tablas principales de la app antes de tocar código — el hallazgo real
no era "falta hover", era un desajuste de affordance: varias filas ya
tenían hover navy/indigo (sugiriendo "esto es clickeable") pero el único
click real vivía en un botón chico anidado al final de la fila.

- **`nomina/page.tsx`** (tabla principal de Detalle por Empleado) y
  **`prestamos/page.tsx`** (tabla de préstamos) — se movió el `onClick`
  al `<tr>` completo (abre el mismo modal/detalle que ya abría el botón
  "Ver comprobante"/"Ver detalle"), con `cursor-pointer` agregado. Los
  controles anidados de esas filas (checkbox de selección, quitar ajuste,
  agregar ajuste, botón "Procesar", botón "Cancelar" en préstamos) ahora
  llaman `e.stopPropagation()` para no disparar también la apertura del
  modal al hacer click en ellos — la fila de nómina tiene 5 controles
  anidados distintos, así que se revisó cada uno individualmente en vez
  de asumir que un solo `stopPropagation` genérico bastaba.
- **`aumentos/page.tsx`** — las 3 tablas que no tenían NINGÚN hover
  (pendientes de aprobación, aprobados por aplicar, historial/rechazados)
  ahora usan el mismo `hover:bg-zinc-50 dark:hover:bg-[#1a1d2e]
  transition-colors` que ya comparten 40+ filas en `reportes/page.tsx` —
  aquí es intencionalmente solo un scanning aid (sin `cursor-pointer`, sin
  onClick en el `<tr>`) porque cada fila tiene múltiples acciones
  independientes (aprobar/rechazar/aplicar), no una sola acción "ver más".
- **Alcance deliberado — lo que NO se tocó**: las tablas de solo lectura
  (`licencias`, `bandas-salariales`, `liquidacion`, `vacaciones`,
  `regalia-pascual`, y las 14+ tablas de `reportes/page.tsx`) ya tenían
  hover sin `cursor-pointer` ni onClick — se confirmó que es el patrón
  correcto para filas genuinamente no-interactivas (scanning aid, no falsa
  promesa de click) y se dejaron intactas. Tampoco se unificaron los dos
  colores de hover que coexisten en la app (zinc neutral vs. navy/indigo
  tintado) — ambos son válidos, cambiarlo sería una decisión de estilo sin
  evidencia de que esté roto, no una corrección de affordance.
- Verificado en navegador con datos demo reales: click en una celda
  intermedia de la fila (no en el botón) abre el modal de comprobante en
  Nómina y el detalle en Préstamos; `tsc --noEmit` y `npm run build`
  limpios (19 rutas).

## Sidebar colapsado con flyout al hover

Pedido explícito del usuario: el botón de colapsar debe seguir existiendo
tal cual, pero además, estando colapsado, posicionar el mouse sobre el
riel debe expandirlo temporalmente, y al sacar el mouse debe volver a
colapsarse — patrón "hover-to-peek" (VS Code, Notion).

- **`src/components/layout/Sidebar.tsx`** — nuevo estado `hovering` +
  `flyout = c && hovering` (`c` = colapsado real y montado) +
  `wide = !c || flyout`. `wide` reemplazó todos los `!c` que controlaban
  qué se renderiza (wordmark, labels de nav, texto de usuario, etc.); `c`
  se conservó tal cual solo donde de verdad debe reflejar el estado
  persistido (ícono/título del botón de colapsar, atajo de teclado
  irrelevante aquí, `localStorage`).
- **Sin desplazar el contenido de la página**: en vez de simplemente
  ensanchar el `<aside>` en flujo normal (lo que empujaría `<main>` cada
  vez que el mouse pasa por encima — reflow indeseado), el flyout cambia
  el propio `<aside>` a `fixed left-0 top-0 z-40 w-60 shadow-2xl` y se
  agrega un `<div>` espaciador de `w-[68px]` en su lugar dentro del flujo
  flex, para que `<main>` nunca note la diferencia. El resultado es que el
  riel expandido *flota* encima del contenido con sombra, como una capa,
  no como un cambio de layout.
- Los controles internos que ya recibían `collapsed` como prop
  (`CuentaSwitcher`) ahora reciben `collapsed={!wide}` — su dropdown se
  posiciona correctamente dentro del riel ancho durante el flyout en vez
  de intentar salir fuera del `overflow-hidden` del `<aside>`.
- Pequeño margen anti-parpadeo: `onMouseLeave` no colapsa de inmediato,
  espera 150ms (cancelable si el mouse vuelve a entrar) antes de disparar
  `setHovering(false)` — evita que un roce accidental del cursor cierre el
  flyout de golpe.
- El botón de colapsar/expandir persistente (`localStorage cielo-sidebar`)
  sigue funcionando exactamente igual que antes — el flyout es puramente
  una capa visual temporal encima del estado colapsado, nunca lo modifica.
- Verificado en navegador con cuenta real: colapsado = 68px estático;
  posicionar el mouse sobre el riel lo expande a 240px SIN mover
  `<main>` (medido con `boundingBox()`, `main.x` idéntico antes/durante el
  hover); sacar el mouse lo vuelve a colapsar a 68px; hacer click en un
  ítem de navegación durante el flyout navega correctamente (confirmado
  con `waitForURL`). `tsc --noEmit` y `npm run build` limpios (19 rutas).

## Fix — jank al pasar el mouse por la sidebar

Reporte directo del usuario: "al mover el mouse hasta la sidebar y luego
sacarlo se glitchea, hay un laggeo, el movimiento no se ve natural". Dos
causas distintas encontradas y corregidas, verificadas por separado contra
el build de producción real (`next build` con export estático):

1. **Prefetch de `next/link` disparando descargas masivas al pasar el
   mouse.** Cada uno de los ~14 links de la sidebar (más los 5 de
   `BottomNav`) prefetchea por defecto — tanto al montar (viewport) como al
   hacer hover — el JS + RSC payload completo de esa ruta. Con páginas
   pesadas (`/nomina` 435 kB, `/reportes` 451 kB), barrer el mouse por la
   sidebar disparaba una ráfaga de ~20 descargas/compilaciones JS
   concurrentes. Instrumentando la red contra el build real: antes del fix,
   el barrido disparaba ~10 pares `index.txt` + bundle JS; después, cero
   requests durante todo el barrido. Fix: `prefetch={false}` en todos los
   `<Link>` de `Sidebar.tsx` y `BottomNav.tsx` — no hay beneficio real de
   precarga en una app 100% client-side con `output: 'export'`.
2. **La causa real del "salto":** el flyout (ver sección anterior) cambiaba
   `position` de `relative` a `fixed` en el mismo render que el cambio de
   ancho (`w-[68px]` → `w-60`), tanto al entrar como al salir con el mouse.
   Un cambio de `position` no es animable — rompe la interpolación continua
   de `transition-[width]`, así que en vez de crecer/encogerse suavemente
   el riel "saltaba" de golpe entre los dos anchos. Fix: el `<aside>` se
   mantiene `fixed` todo el tiempo que está colapsado (`c`), sin importar
   si `hovering` es true o false — solo el ancho (`w-60` ↔ `w-[68px]`)
   cambia con el hover, nunca `position`. El div espaciador de 68px sigue
   el mismo criterio (montado mientras `c` es true, no solo durante el
   flyout) para que el contenido de la página nunca se desplace. Verificado
   midiendo `getBoundingClientRect().width` cada ~15ms durante la
   transición: antes hubiera saltado directo entre 68 y 240; después
   interpola de forma continua (68→71→146→179→216→...→240 al entrar,
   240→237→226→200→...→68 al salir) con `position: fixed` constante en
   todo momento.

**Ronda 2 — residual reportado por el usuario tras el fix anterior**: "salta
un poco, casi no se nota porque es un salto rápido" al acercar el mouse.
Causa: aunque el ANCHO del riel ya no saltaba, el LAYOUT interno sí —
`wide` (que decide si el logo se muestra en fila u apilado, si los ítems de
nav tienen `justify-center` o `gap-3 px-4`, etc.) cambiaba en el mismo
render que empezaba `flyout`, y `justify-content`/`flex-direction` no son
animables por CSS, así que el ícono del logo y los íconos de nav saltaban a
su posición final de un solo golpe. Primer intento (retrasar `wide` con un
`setTimeout` para que el cambio de layout ocurriera con el riel ya más
ancho) resultó CONTRAPRODUCENTE — medido con `boundingBox()` cuadro a
cuadro: cuanto más ancho está el riel cuando el ícono pasa de "centrado" a
"alineado a la izquierda", más lejos tiene que saltar (el centrado se aleja
del borde a medida que crece el contenedor) — con 150ms de retraso el salto
del ícono de un ítem de nav medía ~103px; sin retraso, ~26px. Fix real: se
revirtió el retraso (`wide` vuelve a seguir a `flyout` de inmediato, salto
temprano y pequeño) y en su lugar se agregó `transition-[padding,gap]` /
`transition-[width,height]` / `transition-all` a cada elemento cuyo layout
depende de `wide` (contenedor del logo, ícono SVG del logo, botón de
colapsar, `CuentaSwitcher`, ítems de nav, link de Configuración, bloque de
usuario del footer) — antes NINGUNO de ellos tenía una clase `transition-*`
declarada, así que su padding/gap/tamaño (propiedades sí animables)
saltaban en seco por pura omisión, no por limitación de CSS. Con la
transición agregada, tras el salto inicial (pequeño, con el riel recién
empezando a crecer) el resto de la posición del ícono interpola suave hasta
su lugar final. Verificado midiendo la posición del ícono "Empleados"
cuadro a cuadro: sin saltos grandes, solo un pequeño desplazamiento inicial
seguido de una interpolación continua (x: 3→3→4→4→7→10→13→...→19).

**Ronda 3 — el usuario seguía viendo el salto tras la ronda 2.** Las
mediciones numéricas (`getBoundingClientRect()`) de la ronda 2 no mentían,
pero no capturaban el problema real: se grabó un video real de la
interacción (cursor sintético inyectado + `page.mouse.move` lento,
extraído cuadro a cuadro a 25fps nativos, NO resampleado — un resampleo a
15fps escondía por completo la transición real) y ahí se vio con claridad
el verdadero bug: los labels de los ítems de nav (`item.label`,
"Configuración", el subtítulo del `CuentaSwitcher` — "Cambiar de empresa" /
"X empresas") no tenían `truncate`/`whitespace-nowrap`. Mientras el riel
crecía por los anchos intermedios (ej. ~85px), textos largos como
"Retribuciones Complementarias" o "Bonificación Utilidades" se ENVOLVÍAN a
2 líneas porque todavía no cabían en una — eso engordaba esas filas de
alto temporalmente y empujaba todo lo de abajo, un reflow feo y visible
durante los ~150-200ms de la transición (visualmente mucho peor que
cualquier salto de posición de ícono). Fix: `truncate` (+ `min-w-0` en el
`<span className="flex-1">` padre, requerido para que `truncate` funcione
dentro de un flex item) en los 3 labels afectados — ahora, mientras el
riel todavía es angosto, el texto se corta con "…" en una sola línea en
vez de envolverse, igual que ya hacía el nombre de la cuenta activa (que sí
tenía `truncate` desde el principio). De paso se corrigió que la sombra
(`shadow-2xl`) solo aparecía durante el flyout (`flyout &&`) — apareciendo
de golpe sin transición justo al empezar el hover — ahora vive con `c`
(colapsado, sin importar si hay hover) ya que el riel está `fixed`/
flotando sobre el contenido en ambos casos, así que la sombra está
presente desde el reposo sin aparición súbita. Verificado con el mismo
método de video cuadro a cuadro: ya no hay envoltura de texto ni reflow
visible en ningún punto de la transición, en ninguna de las dos
direcciones (entrada y salida).

## QA de consistencia numérica — decimales y bordes de tabla

Auditoría dirigida por el usuario: varias tablas del sistema mostraban montos
como números enteros (`formatRD(x, 0)`, override puntual sobre el default de
2 decimales) en vez de los centavos reales, inconsistente entre módulos —
222+ call-sites afectados en 16 archivos. Se eliminaron todos los overrides a
0 decimales, dejando el default de `formatRD`/`formatNum` (2 decimales,
`tabular-nums`) como única fuente de verdad salvo casos genuinamente enteros
(días, meses, conteos). De paso, los bordes entre filas de tabla
(`divide-zinc-50`, casi invisibles en la práctica) se oscurecieron a
`divide-zinc-200 dark:divide-[#252840]` de forma sistemática en todas las
tablas de negocio, mejorando la legibilidad de escaneo horizontal sin tocar
la regla de mínimo color. `tsc --noEmit`/`npm run build` limpios.

## Salida pendiente de empleados + pago de días trabajados al terminar

Hallazgo del usuario: "Dar de baja" en Empleados desactivaba (`activo:
false`) al empleado de inmediato, ANTES de calcular sus prestaciones en
Liquidación — un empleado dado de baja por error de flujo quedaba huérfano,
imposible de liquidar correctamente porque ya no aparecía como candidato
activo. Fix arquitectónico: nuevo estado intermedio `Empleado.salidaPendiente`
(`fechaSalidaPendiente`, `motivoSalidaPendiente`) — "Dar de baja" ahora solo
marca esta bandera; `activo` se mantiene `true` hasta que Liquidación
finalice el cálculo real. Mientras `salidaPendiente` es `true`, el empleado
sigue en `empleadosActivos` (visible/seleccionable en Liquidación, conserva
roster e historial) pero sale de `empleadosEnNomina` (ya no acumula nómina
nueva).

Como la mayoría de las salidas ocurren a mitad de período (no justo al
cierre de una quincena/mes), se agregó `Empleado.pagoDiasTrabajadosPendiente:
'nomina' | 'liquidacion'` — capturado al marcar la baja, decide cómo se paga
el tramo de días ya trabajados que ningún período cerrado cubre todavía:
`'nomina'` los prorratea en el próximo período de Nómina que cubra la fecha
de salida (mismo mecanismo de prorrateo ya usado para suspensiones);
`'liquidacion'` los agrega como línea aparte en Liquidación, **con AFP/SFS/
ISR calculados** (confirmado explícitamente por el usuario: "debe de tener
las deducciones de lugar esos días trabajados") vía el motor real de
`calcularNomina`, a diferencia de las indemnizaciones exentas. `Empleados`
gana `cancelarSalidaPendiente` para deshacer una baja marcada por error antes
de liquidar.

## Exportación a Excel con estilo real (exceljs) en todos los módulos

Pedido explícito del usuario: "es muy importante que el contenido que llegue
a excel tenga todo el detalle de las transacciones... y deben de contener
los encabezados con su nombre correcto", con exigencia adicional de que se
vea "moderno y entendible y fidedigno". El sistema exportaba CSV plano
(`xlsx`/SheetJS, sin estilos reales) — se migró `src/lib/excel-export.ts` a
`exceljs`, con encabezados en negrita/fondo de marca, anchos de columna por
hoja, fila de totales resaltada, y formato numérico real (no texto) para que
Excel reconozca los montos como números. API pública sin cambios
(`exportarExcel(opciones)`), así que la migración fue transparente para los
12 módulos de negocio + Reportería que ya la consumían — cada uno se
revisó individualmente para asegurar que el detalle transaccional completo
(no solo totales agregados) llegara a una hoja separada donde aplicara (ej.
"Detalle de Ajustes" en Nómina, separado del "Resumen por Empleado").

## Rediseño de Liquidación — asistente de 3 pasos, cálculo transparente

Feedback directo del usuario sobre el módulo de Liquidación (desvinculación
de empleados): "lo primero es que ciertamente uno a simple vista ve lo que
hay que pagar de liquidación al empleado pero no se puede ver el proceso del
calculo... tampoco se ve el desgloce de donde vino el calculo de los días
trabajados... es necesario que exista la posibilidad que sea editable...
seria bueno agregar el medio de pago antes de disparar el documento... esa
barra negra está horrible". Reescritura completa como asistente de 3 pasos
(Datos de Terminación → Cálculo de Prestaciones → Confirmación y Pago):

- **Paso 2** — una `ConceptoLiquidacionCard` por concepto (Cesantía,
  Preaviso, Asistencia Económica, Vacaciones, Regalía, Días Trabajados
  Pendientes), cada una mostrando la fórmula exacta aplicada (tramo legal,
  días × tarifa) y un ícono de lápiz que permite **editar manualmente el
  monto final** con motivo obligatorio — el cálculo automático
  (`montoAuto`) nunca se pierde, queda como referencia junto al ajuste.
- **Paso 3** — captura de método de pago (cheque/efectivo/transferencia) +
  referencia, antes de finalizar — impreso luego en el documento formal.
- **Planilla en PDF** (`descargarPlanillaLiquidacionPDF`) — el "Recibo de
  Descargo" que empleado y empleador firman, con el desglose completo por
  concepto y línea de firma, generado a partir de
  `RegistroLiquidacion.desgloseCalculo` (snapshot inmutable al finalizar,
  nunca recalculado después — mismo principio que
  `PeriodoNomina.resultadosPorEmpleado`).
- Nuevos tipos: `ConceptoLiquidacion`, `DesgloseConceptoLiquidacion`,
  `RegistroLiquidacion.metodoPago/referenciaPago/desgloseCalculo`.

Bug encontrado y corregido durante la construcción: el `useEffect` de reseteo
de formulario (atado a `[empleadoId]`) pisaba `setPaso('exito')` porque
`handleFinalizarLiquidacion` limpiaba `empleadoId` en el mismo ciclo — se
resolvió separando el reseteo a una función `handleRegistrarOtra()` explícita,
invocada solo desde el botón correspondiente de la pantalla de éxito.

## Identidad visual propia para Liquidación

El usuario probó el rediseño anterior y pidió más: "El estilo visual de las
tarjetas no se siente premium, se siente como un formulario cualquiera...
puedes hacer el mejor entorno de salidas de empleados y cálculo de
prestaciones más hermoso que exista" — explícitamente sin imitar Préstamos
ni Reportería, que ya le gustaban visualmente pero no quería replicados.
Segunda pasada centrada en las `ConceptoLiquidacionCard`: gradiente de marca
propio por concepto (rosa/cesantía, ámbar/preaviso, violeta/asistencia,
cielo/vacaciones, esmeralda/regalía, índigo/días trabajados) con halo
`blur-md` detrás del ícono, `hover:-translate-y-0.5` + sombra tintada del
color del concepto, y transiciones de paso con el mismo lenguaje ya
establecido en el resto de la app. Usuario confirmó satisfacción: "Wao
realmente se ve mucho mejor ahora".

## Regalía Pascual — liquidación vía período especial en Nómina

Pedido del usuario: que Regalía Pascual deje de ser solo un visor de
acumulación y permita "solicitar liquidación de regalía", viajando el
acumulado a un período especial en Nómina para el pago, con reinicio a cero
tras procesarlo y acumulación continua hacia el siguiente diciembre —
planteado explícitamente como pregunta de factibilidad ("¿Consideras que es
factible? ¿Tiene sentido?"), confirmada antes de implementar.

**Arquitectura:**
- Nuevo valor `TipoPeriodo = 'regalia'` (además de `'mensual'`/`'quincenal'`) y
  `PeriodoNomina.montosRegalia`/`motivosAjusteRegalia` — el período nace con
  el monto de cada empleado ya congelado, no con `ajustesPorEmpleado` ni el
  motor normal de `calcularNomina`.
- **Tratamiento fiscal — decisión propia justificada**: el pago de Regalía
  Pascual vía este período es **bruto, sin AFP/SFS/ISR**, replicando el
  precedente ya existente para Vacaciones/Regalía dentro de Liquidación (no
  es salario cotizable). `resultadoRegalia()` en `nomina/page.tsx` construye
  un `ResultadoNomina` sintético con todo en cero salvo lo pagado, para
  reutilizar tal cual el modal de comprobante, el PDF y el envío por correo
  ya existentes.
- **Reset del acumulado**: `Empleado.regaliaPagadaAnio` (nuevo) ancla
  `regaliaPagadaEsteAnio` a un año fiscal específico —
  `regaliaPagadaVigente(empleado, año)` en `dominican-labor.ts` solo lo
  aplica si el año coincide; sin este campo (registros previos) se asume
  vigente solo para el año calendario actual, así el descuento deja de
  aplicar por sí solo al año siguiente sin necesidad de migrar datos. Esto
  corrige de paso un bug latente: el offset de migración se restaba
  indefinidamente en vez de solo el año en que se capturó. Al procesar cada
  empleado en el período de regalía (`handleProcesarRegalia`), se estampan
  `regaliaPagadaEsteAnio`/`regaliaPagadaAnio`, "reiniciando" su acumulado.
- **`regalia-pascual/page.tsx`** — botón "Solicitar Liquidación de Regalía"
  abre un modal con el acumulado de cada empleado, editable manualmente
  (lápiz + motivo obligatorio) antes de confirmar — cubre el pedido de
  "editar la acumulación... por si hay que hacer un ajuste manual". Guard
  contra floating-point: el acumulado se redondea a centavos antes de
  compararlo contra 0, sin esto un empleado recién liquidado en su totalidad
  arrastraba un residuo de fracciones de centavo que lo colaba de vuelta a
  la siguiente solicitud.
- **`nomina/page.tsx`** — vista de detalle dedicada y más simple para
  períodos tipo `'regalia'` (sin ajustes editables, préstamos, filtros ni
  auditoría pre-cierre), reutilizando `Cerrar`/`Reabrir`/`Marcar Pagada`/
  `Comprobantes` genéricos de la lista de períodos sin cambios.

Verificado en navegador con Playwright: solicitud con ajuste manual → período
"Regalía Pascual 2026" creado en Nómina con 4 empleados por RD$101,500.00 →
procesado → acumulado exacto en RD$0.00 tras el pago para los 4 empleados,
botón de solicitud correctamente deshabilitado hasta que vuelva a acumularse.

## Vacaciones no gozadas llevan AFP/SFS/ISR — no son indemnización exenta

Corrección de ley señalada por el usuario, quien inicialmente había
confirmado el tratamiento contrario y luego se corrigió explícitamente:
"las vacaciones pagadas tanto en la liquidación como en nómina están
sujetas a TSS e ISR, y deben de ser deducidas... si hay que pagarle 40,000
pesos a un empleado por concepto de vacaciones, hay que retener tanto TSS
como ISR porque el salario excedía la exención del ISR". A diferencia de
cesantía/preaviso/asistencia económica (indemnizaciones exentas por Ley
16-92) y de la Regalía Pascual (100% exenta, confirmado explícitamente),
las vacaciones son salario ordinario continuado (Art. 178, Código de
Trabajo) — llevan retención normal cuando el monto, evaluado como si fuera
el salario del mes, supera la exención del ISR al anualizarlo.

Implementación: reutiliza exactamente el mecanismo ya validado para "días
trabajados pendientes" en Liquidación — `calcularNomina({ ...empleado,
salarioBase: montoVacaciones })` trata el bruto como si fuera el salario
del mes, topando AFP/SFS en sus respectivos topes cotizables y evaluando
ISR contra los tramos anuales normales sobre el monto anualizado ×12.

- **Liquidación**: "Vacaciones No Gozadas" pasa de pagar el bruto a pagar
  el neto (bruto − AFP − SFS − ISR), con el desglose visible en la tarjeta
  (mismo patrón que "Días Trabajados Pendientes"), el PDF y el Excel.
  Nuevos campos `RegistroLiquidacion.vacacionesBruto/afpVacaciones/
  sfsVacaciones/isrVacaciones` (auditoría; `vacaciones` sigue siendo el
  neto que entra a `totalPagado`).
- **Vacaciones** (provisión, sin pago real todavía en el sistema): nueva
  columna/stat "Neto Estimado" junto al "Valor Bruto", para que la
  provisión muestre honestamente lo que el empleado recibiría si se pagara
  hoy — usa el mismo `calcularNomina({...empleado, salarioBase: valor})`.
- Reportería (Proyección Anual) y el comprobante de Nómina se revisaron y
  se dejaron sin cambios — solo muestran provisión/días informativos (el
  costo proyectado de la empresa sí debe seguir siendo el bruto, ya que la
  porción retenida igual la desembolsa el empleador, solo que a TSS/DGII en
  vez de al empleado).

Verificado en navegador: María González (bruto RD$13,734.35 en vacaciones)
→ neto exacto RD$12,922.65 (AFP RD$394.18, SFS RD$417.52, ISR RD$0.00 por no
cruzar el tramo anualizado); Regalía Proporcional en la misma liquidación
sin cambios, confirmando que su exención total no se tocó.

## Regalía Pascual — banner de ciclo pendiente no distinguía período cerrado

Reporte del usuario tras probar el flujo completo: pagó el período de
Regalía Pascual 2026 en Nómina, pero el módulo de Regalía Pascual seguía
mostrando "ya se solicitó la liquidación, continúa el pago desde Nómina"
como si nada hubiera cambiado — además pidió un indicador explícito de
sobre qué año/ciclo está trabajando el módulo, filtros por nombre/cédula/
departamento, y una ficha de empleado de solo lectura al hacer clic en su
nombre.

**Investigación**: se reprodujo el flujo completo con Playwright (navegación
por sidebar, procesar empleados uno a uno, cerrar el período, volver a
Regalía Pascual) — el acumulado sí volvía a RD$0.00 correctamente en todos
los casos. El bug real: `periodoRegaliaExistente = periodos.find(p => p.tipo
=== 'regalia' && p.anio === anioActual)` no distinguía un período todavía
`en_proceso`/`procesada` de uno ya `cerrada` (pagado) — el banner y el botón
"Liquidación {año} en Nómina" se quedaban visibles todo el año aunque el
acumulado ya estuviera en cero por debajo, dando la falsa impresión de que
nada había cambiado.

- **Fix**: el banner/botón de "pendiente" ahora solo se muestra mientras el
  período del año en curso NO está `cerrada`. Una vez cerrado, se reemplaza
  por una sección "Ciclos Liquidados y Pagados" (`historialRegalia` —
  períodos `regalia` con `estado === 'cerrada'`, más recientes primero) que
  deja constancia de qué años ya se pagaron.
- **Indicador de ciclo**: el subtítulo del header ahora dice explícitamente
  "Ciclo en acumulación: {año}" — como `anioActual` se deriva de la fecha
  real, apenas empiece 2027 el módulo lo reflejará solo, sin código nuevo.
- **Filtros**: buscador por nombre/cédula + `<select>` de departamento sobre
  la tabla de empleados, con botón "Ver todos" para limpiar ambos y un
  contador "X de Y empleado(s)"; el TOTAL del pie de tabla refleja el
  subconjunto filtrado (rotulado "TOTAL (filtrado)"), mientras las stat
  cards del encabezado se mantienen a nivel de toda la empresa.
- **Ficha de solo lectura** — nuevo componente compartido
  `src/components/empleados/EmpleadoInfoReadOnly.tsx`: mismas secciones
  informativas que el tab "Información" del drawer de Empleados (Datos
  Personales, Documentos, Datos Laborales, Derechos estimados), pero sin
  ninguna de las acciones que mutan datos (suspender, dar de baja, saldo
  ISR, dependientes) — se construyó como componente nuevo en vez de
  parametrizar el drawer existente, que mezcla visualización con mutación
  en el mismo árbol de JSX. Se abre al hacer clic en el nombre de cualquier
  empleado en la tabla de Regalía Pascual.

Verificado en navegador con Playwright: tras cerrar el período 2026, el
banner desaparece y el historial muestra "2026 · 7 empleado(s) · pagada ·
RD$187,541.66"; filtro por departamento "Administración" reduce la tabla a
1 fila con el total recalculado; búsqueda "María" aísla correctamente a
María González Pérez; clic en su nombre abre la ficha de solo lectura con
sus datos reales y ningún control de edición visible.

## Bug hunt de Regalía Pascual (3 años simulados) + rediseño con prepantalla

El usuario reportó, con capturas de pantalla, que los "Ciclos Liquidados y
Pagados" no se veían premium en la parte de arriba de Regalía Pascual y que
"esos acumulados abajo no me cuadran" — pidiendo explícitamente simular 3
años de Regalía Pascual + Nómina en busca de bugs, y una prepantalla al
estilo Alegra (captura de referencia: pantalla "Calcular nómina" con un
período sugerido y una tabla de períodos históricos) que pregunte si se
quiere ver un período histórico o la acumulación actual.

**Investigación**: se inyectaron 2 períodos `regalia` sintéticos (2024 y
2025, `cerrada`, con `resultadosPorEmpleado` reales) directo en
`localStorage` vía Playwright para simular 3 ciclos completos sin depender
de que pasara tiempo real. Se encontraron 3 bugs reales de contaminación
cruzada — el tipo `'regalia'` (agregado en la sesión anterior) nunca se
excluyó de código que asumía implícitamente solo `'mensual'`/`'quincenal'`:

1. **`calcularSalarioPromedioUltimos12Meses`** (dominican-labor.ts) — el
   más grave: sumaba el pago de Regalía Pascual como si fuera salario
   ordinario de ese mes al promediar los últimos 12 meses, usado por
   Liquidación para Cesantía/Preaviso/Asistencia Económica. Un empleado
   despedido dentro de los 12 meses posteriores a cobrar su regalía veía su
   indemnización inflada artificialmente. Fix: excluir `tipo === 'regalia'`
   del filtro `relevantes` — la Regalía Pascual nunca es "salario
   ordinario".
2. **Los 6 selectores de "Período" en Reportería** (Resumen Gerencial,
   Nómina por Período, Cumplimiento Fiscal, Costo por Departamento,
   Planilla ACH, Empleados Sin Ingresos) no excluían `tipo === 'regalia'` —
   aparecía en el dropdown como **"Diciembre {año}"** (`periodoLabel` no
   tenía rama para ese tipo), indistinguible de un mes real. Si se
   seleccionaba, `calcularConPeriodo` caía al motor normal de nómina y
   fabricaba un salario mensual completo inexistente bajo esa etiqueta.
   Fix: excluido de los 6 selectores; `calcularConPeriodo`/`periodoLabel`
   también reciben manejo explícito de `'regalia'` como defensa adicional
   (`calcularConPeriodo` devuelve un `ResultadoNomina` en cero en vez de
   recalcular).
3. **Historial Nómina del empleado** (`empleados/page.tsx`) tenía el mismo
   patrón: un período de regalía sin snapshot para un empleado (nunca
   formó parte de ese pago) fabricaba un salario mensual bajo esa etiqueta.
   Fix: se filtra antes de construir el historial; `labelPeriodoHist`
   etiqueta "Regalía Pascual {año}" en vez de "Diciembre {año}".

Verificado en navegador: tras inyectar los 2 ciclos sintéticos, la
acumulación 2026 en vivo se mantuvo exacta (RD$187,541.66, idéntica a
antes de inyectar — sin fuga entre años); el dropdown de "Nómina por
Período" dejó de listar los ciclos de regalía; el Historial Nómina de
Carlos Rodríguez muestra "Regalía Pascual 2025"/"2024" correctamente
etiquetados (RD$88,000 bruto=neto, sin AFP/SFS/ISR); y su Cesantía
(con una regalía de diciembre 2025 dentro de los últimos 12 meses)
calculó exacto sobre su salario base real — RD$594,544.69 = 23 días ×
7 años × RD$3,692.82/día — sin ningún rastro de inflación.

**Rediseño — prepantalla "¿Qué quieres ver?"**: con historial existente,
el módulo ya no amontona la tabla de ciclos cerrados sobre la acumulación
en vivo. Ahora abre en una pantalla de elección (patrón "Calcular Nómina"
de Alegra) con dos tarjetas grandes — "Acumulación Actual" (ciclo en curso
+ cifra acumulada) y "Historial de Liquidaciones" (conteo de ciclos +
cifra del más reciente) — cada una con degradado navy/esmeralda, halo y
hover lift, mismo lenguaje visual ya usado en Configuración Inicial. El
Historial pasa a su propia pantalla con una tabla densa (Ciclo, Empleados,
Total Pagado, Fecha de Pago, Estado, "Ver en Nómina"), sin mezclarse con
la acumulación. Un botón "Cambiar de vista" en el header de cualquiera de
las dos pantallas regresa al selector sin recargar el módulo. Sin
historial (primer año de la empresa), se salta la prepantalla y va directo
a la acumulación — no hay nada que elegir todavía.

## Nómina dividida en Cálculo de Nómina y Gestión de Envíos

Pedido del usuario, con Alegra como referencia visual explícita pero "no es
hacerlo imitando a Alegra haciendo un copy paste, es tener una referencia":
en Alegra, el historial de nóminas procesadas no vive en la misma pantalla
que el período actual (tabla densa con período sugerido arriba), y "Nómina"
se compone de "Cálculo de nómina" y "Gestión de envíos" (donde se marca el
pago y se envían los comprobantes) como dos secciones separadas.

Antes de implementar se acordaron 3 decisiones con el usuario: (1) dos
accesos independientes en el sidebar, no un grupo desplegable; (2) reparto
de funciones = Cálculo (crear/procesar/cerrar) vs. Envíos (marcar pagada +
enviar comprobantes); (3) reemplazar las tarjetas de período por la tabla
densa.

- **`/nomina` → "Cálculo de Nómina"** — las tarjetas de período se
  reemplazan por un banner de "Período sugerido" (calculado con
  `sugerirProximoPeriodo()`, que continúa la serie existente de ese
  tipo/quincena o usa el mes actual si es el primero) + una tabla con
  buscador, filtro de estado y de año (columnas Período/S. Bruto/Total
  Neto/Costo Total/Estado/acciones). Ya no tiene ninguna acción de pago o
  envío de comprobantes.
- **`/nomina/envios` → "Gestión de Envíos"** (ruta nueva) — lista solo los
  períodos `cerrada`, con badge de estado de pago (Pendiente/Pagada) y la
  acción correspondiente: "Marcar como Pagada" abre automáticamente el
  modal de comprobantes; si ya está pagada, un botón "Comprobantes" lo
  reabre para reenviar.

**Infraestructura para soportar la separación:**
- `src/lib/nomina-shared.ts` (nuevo) — `labelPeriodo`/`resultadoRegalia`/
  `descargarComprobantePDF` se movieron aquí desde `nomina/page.tsx`.
  Motivo: Next.js prohíbe exports adicionales en un archivo `page.tsx`
  ("X is not a valid Page export field") — error que solo aparece en
  `next build`, no en `tsc --noEmit` — y ahora tres archivos distintos
  (Cálculo, Envíos, el modal) necesitan estas funciones.
- `src/components/nomina/EnvioComprobantesModal.tsx` (nuevo) — el modal de
  envío de comprobantes (plantilla editable + envío individual/masivo) se
  extrajo del bloque que antes vivía inline en `nomina/page.tsx`, para
  poder reutilizarlo desde Gestión de Envíos. Bug encontrado y corregido
  durante la extracción: la primera versión solo confiaba en
  `resultadosPorEmpleado` (el snapshot congelado al procesar); para
  períodos que no lo tienen (datos demo sembrados directo en localStorage,
  o períodos anteriores a la existencia de ese campo) la tabla de
  empleados salía completamente vacía. Fix: fallback que recalcula en vivo
  con `calcularConPeriodo` (dominican-labor.ts), usando
  `empleadosProcesados` como membresía si existe o `empleadosEnNomina`
  como respaldo — mismo criterio ya usado en
  `calcularSalarioPromedioUltimos12Meses`.
- `src/components/layout/Sidebar.tsx` — `isActive()` ahora elige el href
  MÁS ESPECÍFICO (más largo) que hace match con la ruta actual, en vez de
  simplemente `pathname.startsWith(href)`. Sin este fix, "Cálculo de
  Nómina" (`/nomina`) quedaba resaltado también estando en
  `/nomina/envios`, por compartir el mismo prefijo de ruta.
- `src/lib/nav-items.ts` — "Procesar Nómina" se divide en "Cálculo de
  Nómina" y "Gestión de Envíos" como dos entradas planas del mismo array
  (no un grupo anidado) — se propaga solo con este cambio a Sidebar,
  BottomNav (que tiene su propia lista curada y no se vio afectado) y
  CommandPalette (Cmd+K), sin tocar esos archivos.

Verificado en navegador con Playwright: cada ítem del sidebar resalta
únicamente su propia página (antes ambos se resaltaban a la vez estando en
Envíos); crear un período desde "Período sugerido" sigue abriendo
directo el detalle con los 7 empleados y las cuotas de préstamos
pre-cargadas; Gestión de Envíos lista los 4 períodos cerrados de la demo,
"Marcar como Pagada" mueve el badge a "Pagada" y abre el modal con los 7
empleados y sus montos netos reales (RD$49,189.83 para María González,
etc.) — confirmando que el fix del fallback funciona con datos demo
sembrados sin `resultadosPorEmpleado`.

## Fix — Cálculo de Nómina necesitaba selección manual de período

El rediseño anterior había reemplazado los selects de Mes/Año/Quincena por
un badge de "Período sugerido" de solo lectura — el usuario señaló
explícitamente que no quería una sugerencia fija, sino poder **seleccionar**
el período a calcular. Se restauraron los selects editables (Mes/Año/
Quincena), pre-llenados con `sugerirProximoPeriodo()` como punto de partida
cómodo pero totalmente editables.

De paso se corrigió un bug relacionado: el `useEffect` que aplica la
sugerencia dependía de `periodos` — cualquier actualización de fondo a la
lista de períodos (ej. otro efecto recalculando totales) le pisaba la
selección manual del usuario a mitad de edición. Ahora solo se recalcula al
cambiar la frecuencia (Mensual/Quincenal), nunca mientras el usuario ya está
eligiendo un período.

Verificado en navegador: cambiar a Quincenal muestra el selector de
Quincena; seleccionar manualmente "Diciembre" se mantiene sin que ningún
efecto en segundo plano lo revierta.

## Ningún historial se oculta por antigüedad + creación retroactiva de períodos

El usuario preguntó cuántos "períodos fiscales" quedarían habilitados,
preocupado por si una empresa con varios años usando Cielo Cloud perdería
acceso a su historial más antiguo. Se auditaron todos los selectores de año
del sistema (Cálculo de Nómina, Gestión de Envíos, y los reportes de
Reportería con filtro de año — Horas Extras, Salario vs. Licencias) — todos
ya se arman dinámicamente a partir de `Array.from(new Set(periodos.map(p =>
p.anio)))` (o el equivalente para licencias), sin ningún tope: si hay datos
de 2025, aparecerán en el filtro sin importar cuántos años pasen. Los datos
en `localStorage` tampoco tienen expiración — un período solo desaparece si
se elimina manualmente.

La única excepción real (no afecta historial, solo creación) era el
selector de "Año" al crear un período nuevo en Cálculo de Nómina, limitado a
año actual ±1 — sin forma de registrar retroactivamente un período de una
empresa con historial previo a Cielo Cloud. Ampliado a 10 años atrás hasta 1
año adelante del año calendario real (fijo — no se mueve si el usuario
cambia el año seleccionado en el propio formulario, para evitar que el
rango de opciones "se corra" cada vez que se elige un año distinto).

## Favicon

Pedido explícito del usuario: "hazle el Favicon al sistema". Nuevo
`src/app/icon.svg` — usa la convención de archivo estático de Next.js App
Router (`icon.svg` en `src/app/` se detecta automáticamente y genera el
`<link rel="icon">` correcto con el `basePath` ya aplicado, sin tocar
`metadata` en `layout.tsx`). Diseño: mismo isotipo del wordmark del Sidebar
(arco de 300° + punto interior) pero con la paleta invertida — trazo/punto
blancos sobre un cuadrado redondeado `#1B2980` (brand navy) en vez de trazo
navy sobre fondo transparente — para que se lea bien como ícono pequeño de
pestaña de navegador sin depender de si el fondo del navegador es claro u
oscuro (el trazo transparente del sidebar original solo funciona porque ahí
vive sobre el fondo blanco/oscuro ya controlado de la propia app).
Verificado: `next build` incluye `/icon.svg` como ruta estática (0 B, sin
JS), el HTML servido en dev trae
`<link rel="icon" href="/tyui/icon.svg?..." type="image/svg+xml" sizes="any"/>`
con el `basePath` correcto, y `out/icon.svg` existe en el export estático
con el markup esperado. `tsc --noEmit` y `npm run build` limpios (19 rutas,
sin cambio de conteo — `/icon.svg` es una ruta de asset estático, no una
página).

## Disfrute de Vacaciones — registro de toma de vacaciones + puente a Nómina

Pedido explícito del usuario: hasta ahora `/vacaciones` solo proyectaba la
acumulación (14/18 días laborables/año) sin ninguna forma de registrar que un
empleado REALMENTE tomó un tramo de sus vacaciones ya acumuladas, restarlo del
disponible, y que el período de Nómina que se solape con esas fechas pague
esos días como vacaciones (con AFP/SFS/ISR, Art. 178) en vez de como sueldo
normal. El usuario planteó el ejemplo concreto de un empleado que sale el 20
de julio y regresa el 27 (trabajó 16–19, vacacionó 20–26 dentro de la misma
quincena) — confirmó dos decisiones antes de implementar: (1) los días se
cuentan en **días laborables** (excluye domingo, consistente con cómo ya se
acumulan los 14/18 días anuales), y (2) el período de Nómina **pre-carga
automático** el prorrateo, sin requerir un ajuste manual.

**Arquitectura:**
- Nuevo tipo `DisfruteVacaciones` (empleadoId, fechaInicio/fechaFin,
  `diasLaborables` congelado al registrar, notas) — un empleado puede
  fraccionar sus vacaciones en varios tramos a lo largo del año, así que es
  una lista, no un campo único. Nuevo `src/lib/vacaciones-context.tsx`
  (mismo patrón que `licencias-context.tsx`): `registrarDisfrute`/
  `eliminarDisfrute`/`diasTomados(empId)` (suma de días laborables de todos
  los tramos, lo que se resta del acumulado disponible)/`estaDeVacaciones`.
- `contarDiasLaborables(inicio, fin)` (nuevo helper en `dominican-labor.ts`)
  — excluye domingos, reutilizado tanto para restar del acumulado como para
  valorar el goce a pagar.
- **Nuevo campo `ParametrosNomina.vacacionesGoce`** — se suma a
  `totalBrutoLegado` en `calcularNomina` exactamente igual que
  bonificaciones/comisiones (cotizable TSS, gravable ISR — salario
  ordinario, Art. 178), con el mismo "halving" automático en
  `calcularNominaQuincenal`.
- **`diasVacacionEnPeriodo()`** (nuevo, `nomina/page.tsx`, junto a
  `diasSuspensionEnPeriodo`) — calcula, para el rango de fechas de UN
  período específico: (a) los días CALENDARIO de vacación que caen dentro
  del período, para reducir `diasTrabajados` (mismo mecanismo ya usado para
  prorratear por suspensión) y (b) los días LABORABLES tomados en ese mismo
  rango, valorados a tarifa diaria (salario ÷ 23.83/26) para el monto de
  goce — la misma convención que ya usa `/vacaciones` y Liquidación para
  "Vacaciones No Gozadas", no la fracción calendario. **Detalle clave de
  precisión**: si el período es quincenal, el monto de goce se PRE-DOBLA
  antes de pasarlo a `calcularNomina` — el sistema ya divide TODO el bruto
  (incluidas bonificaciones/comisiones) entre 2 en `calcularNominaQuincenal`
  (ver sección "Quincenal" arriba), así que duplicarlo aquí hace que, tras
  esa división automática, el resultado sea el monto real correspondiente a
  esa quincena específica — mismo truco implícito que ya "sobrevive" el
  prorrateo de días vía `diasCorteEnPeriodo`. `calcularParaPeriodo` (único
  choke point, ya usado por suspensión/salida) ahora también recibe la
  lista de disfrutes y aplica automáticamente esta lógica en sus 6 call
  sites — sin necesidad de un `AjusteLinea` manual, es 100% automático como
  suspensión/salida pendiente.
- **UI Nómina**: línea "Vacaciones (Goce)" en Devengos del modal
  `DetalleNomina` y del PDF de comprobante, con nota "Incluye días de
  disfrute de vacaciones — salario ordinario, con AFP/SFS/ISR normales
  (Art. 178)". El toast al crear un período menciona cuántos empleados
  tienen vacaciones dentro de ese período.
- **`/vacaciones`**: nueva columna "Días Disponibles" (acumulados − ya
  tomados), botón "Registrar Disfrute" (modal con preview en vivo de días
  laborables y aviso no bloqueante si supera lo disponible), badge "De
  Vacaciones" cuando la fecha de hoy cae dentro de un tramo registrado, y
  tabla "Disfrutes Registrados" (todos los tramos, con acción eliminar).
  Nueva stat card "De Vacaciones Ahora".
- **Liquidación**: `diasVacAcum` ahora resta `diasTomados(emp.id)` antes de
  calcular "Vacaciones No Gozadas" — evita pagar dos veces los días que el
  empleado ya disfrutó (una vez en Nómina al gozarlos, otra al liquidar). El
  detalle de la tarjeta muestra "− N días ya disfrutados" cuando aplica.

Verificado en navegador con Playwright, datos demo reales: registro de un
disfrute de 6 días calendario (incluye 1 domingo → 5 días laborables) para
María González Pérez (salarioBase RD$55,000) → Días Disponibles baja exacto
de 6.10 a 1.10, badge "De Vacaciones" visible. Período mensual Julio 2026 →
toast "1 empleado(s) con vacaciones en este período" → comprobante de María
muestra Salario Básico RD$44,354.84 (=55,000×25/31 días trabajados) +
Vacaciones (Goce) RD$11,540.08 (=5 días × RD$2,308.02/día), con AFP/SFS/ISR
calculados sobre el total combinado. 2ª Quincena de Julio 2026 (16–31, el
disfrute solapa 16–20 → 4 días laborables) → Salario Básico RD$18,906.25
(=55,000×11/16/2, matemática exacta tras el halving quincenal) + Vacaciones
(Goce) RD$9,232.06 — ambos números exactos confirmando que el pre-doblado
sobrevive la división quincenal automática sin desajustes. Liquidación de
María (Mutuo Acuerdo) → tarjeta "Vacaciones No Gozadas" muestra "− 5 días ya
disfrutados" en la fórmula, confirmando que no se paga doble. Sin errores de
consola en ningún paso. `tsc --noEmit` y `npm run build` limpios (19 rutas).

## Vacaciones — acumulación multi-año compuesta + venta de vacaciones

El usuario describió dos escenarios reales de su experiencia laboral: (1)
empleados con 1-3 períodos de vacaciones pendientes acumulados (nunca
disfrutadas, la empresa nunca los obliga a tomarlas) y una liquidación con
saldo pendiente de 2 años distintos (ej. 9 días de 2023 + 7 de 2024); (2)
"venta de vacaciones" — el empleado sigue trabajando en su período de
vacaciones y prefiere que el valor de esos días se le añada como pago extra
en la nómina, en vez de disfrutarlos.

**Bug real encontrado en el escenario 1 — confirmado, no solo hipotético.**
La fórmula de acumulación que ya existía (antes de esta sesión) en
`/vacaciones` y Liquidación usaba `(años % 1) × 12` para los meses del
"ciclo actual" — el residuo de la división, que **descarta por completo
cualquier año COMPLETO ya transcurrido sin disfrutar**. Un empleado con 1
año 5 meses sin tomar vacaciones acumulaba ~5.8 días en vez de los ~19.8
reales (14 del primer año + la fracción del segundo). Fix: nueva función
`calcularDiasVacacionesAcumulados(añosServicio, saldoInicial)` en
`dominican-labor.ts` que COMPONE cada año completo (a la tasa vigente EN
ESE año — 14 los primeros 5 años, 18 después) + la fracción del año en
curso, sin resetear nunca — reemplaza la fórmula duplicada y buggy en
`vacaciones/page.tsx` y `liquidacion/page.tsx`. Con `diasTomados` (ya
existente) restando lo realmente disfrutado/vendido, el escenario de "9
días de 2023 + 7 de 2024" ahora sale correcto automáticamente sin necesidad
de trackear "por año calendario" — el acumulado compuesto total menos lo
tomado ya refleja el saldo real, sin importar cuántos años lleve.

**Venta de vacaciones — nuevo `tipo?: 'disfrute' | 'venta'` en
`DisfruteVacaciones`** (default `'disfrute'`, retrocompatible). A
diferencia de un disfrute (el empleado deja de trabajar esos días, se
prorratea el salario normal), una venta:
- **No reduce días trabajados** — el empleado sigue cobrando el salario
  completo del período, `diasVacacionEnPeriodo()` (`nomina/page.tsx`) separa
  internamente los registros por `tipo`: solo los de `'disfrute'` restan de
  `diasVacCalendario`/`diasTrabajados`, los de `'venta'` nunca.
- **Se paga aparte, no en lugar de** — nuevo campo `vacacionesVendidas` en
  `ParametrosNomina`/`ResultadoNomina` (paralelo a `vacacionesGoce`, mismo
  tratamiento fiscal: cotizable TSS, gravable ISR, mismo "halving"
  quincenal), para no confundir "goce" (sustituye el salario) con "venta"
  (pago extra sobre el salario completo) en el comprobante.
- **Se registra con una fecha efectiva** (`fechaInicio === fechaFin`,
  reutilizando el mismo mecanismo de solape por fecha ya usado para
  disfrute) — el período de Nómina que la cubra la aplica automáticamente,
  sin necesidad de elegir el período a mano.
- `diasTomados`/`Días Disponibles` en `/vacaciones` no distinguen tipo —
  una venta resta del acumulado exactamente igual que un disfrute (ambas
  formas consumen el derecho). `disfruteActivo`/`estaDeVacaciones` SÍ
  filtran tipo `'venta'` — nunca debe verse el badge "De Vacaciones" para
  alguien que sigue trabajando.

**UI**: botón "Vender Vacaciones" en `/vacaciones` (modal: empleado, días a
vender, fecha efectiva, notas, preview en vivo del monto con aviso no
bloqueante si excede lo disponible). La tabla de registros se renombra
"Disfrutes y Ventas Registradas" con columna "Tipo" (badge Disfrute/Venta).
Línea "Vacaciones Vendidas" en Devengos del modal `DetalleNomina` y del PDF
de comprobante, con nota "pago extra sobre el salario normal completo".

Verificado en navegador con Playwright, datos demo reales: José Hernández
Cruz (3 años 9 meses) pasó de ~11.51 días acumulados (fórmula buggy, sesión
anterior) a 53.51 días (fórmula compuesta) — confirma que ya no se descartan
años completos. Venta de 14 días para Carlos Rodríguez Méndez (fecha
efectiva dentro de un período ya abierto) → Días Disponibles baja exacto de
110.80 a 96.80, sin badge "De Vacaciones" (sigue "Puede gozar", confirmando
que no se le marca como ausente). En el comprobante de esa quincena: Salario
Básico RD$44,000.00 (completo, SIN prorratear — a diferencia de un
disfrute) + Vacaciones Vendidas RD$51,699.54 (14 días × tarifa diaria,
matemática exacta tras el pre-doblado/halving quincenal) + nota "Incluye
venta de vacaciones — pago extra sobre el salario normal completo, con
AFP/SFS/ISR". Sin errores de consola en ningún paso. `tsc --noEmit` y
`npm run build` limpios (19 rutas).

## Saldo ISR a Favor migrado — Carga Inicial deja de ser decorativa

El usuario pidió explícitamente que los datos de Carga Inicial "pasen por
el flujo del sistema y no sean decorativos", usando el Saldo ISR a Favor
como ejemplo. Antes de tocar código se auditó el estado real (vía agente,
no solo CLAUDE.md): el mecanismo de Saldo ISR a Favor YA estaba 100%
conectado a Nómina (reduce el ISR calculado, sube el neto, nunca cuenta
como base cotizable de TSS ni gravable de ISR — confirmado rastreando
`aplicarSaldoISRFavor` línea por línea) — el hueco real era que solo se
podía **registrar** desde el drawer de Empleados, uno por uno, nunca desde
el Asistente Guiado ni el Importador Excel de Carga Inicial.

**Fix — ambos flujos de Carga Inicial ahora crean un `SaldoISRFavor` real:**
- `AsistenteGuiado.tsx`: nuevo campo "Saldo ISR a Favor migrado (RD$)" en el
  paso por-empleado (separado visualmente de los 3 campos de `Empleado` con
  un `border-t`, porque esto NO es un campo de `Empleado` — crea un registro
  aparte). Al "Guardar y Continuar", si el monto es > 0, llama
  `registrarSaldoISR()` del mismo `saldo-isr-context.tsx` que ya usa el
  drawer — mismo motivo por defecto ("Saldo migrado en Carga Inicial"),
  tipo `'retencion_excesiva'`, año fiscal actual.
- `ImportadorExcel.tsx`: nueva 11ª columna "Saldo ISR a Favor (RD$)" en la
  plantilla/`ENCABEZADOS`/`FilaImportacion`, con su propia validación
  (número ≥ 0) y columna en la tabla de vista previa. Funciona tanto para
  filas que actualizan un empleado existente como para filas que crean uno
  nuevo — este segundo caso requirió un cambio de contrato: `add()` en
  `empleados-context.tsx` antes devolvía `void`, ahora devuelve el
  `Empleado` recién creado (con su `id` generado) para poder asociarle el
  `SaldoISRFavor` en el mismo `confirmarImportacion()`. Cambio aditivo — los
  demás call sites de `add()` que ignoraban el valor de retorno no se ven
  afectados.
- Deliberadamente NO se agregó al sub-flujo "Registrar empleado nuevo desde
  el asistente" (`modoAlta`, que reutiliza `EmpleadoFormFields`) ni al
  formulario "Nuevo Empleado" de `/empleados` — ambos son para contrataciones
  genuinamente nuevas, sin retención previa que reembolsar; el pedido del
  usuario aplicaba específicamente a empleados con historial migrando desde
  otro sistema.

Verificado en navegador con Playwright: Asistente Guiado con María González
Pérez → RD$4,200 en el nuevo campo → Guardar y Continuar → su drawer en
Empleados muestra la sección "Saldo ISR a Favor" con "Saldo migrado en Carga
Inicial · Año 2026 · original RD$4,200.00" — mismo componente visual que
usa el registro manual. Importador Excel con un CSV de un empleado nuevo
("Roberto Testigo", cédula no existente) y RD$2,500 en la columna 11 → vista
previa muestra "RD$2,500" en la columna "Saldo ISR" con acción "Crear
empleado nuevo" → tras confirmar, su drawer real (verificado con el
`id` generado, no un placeholder) muestra el saldo con motivo "Saldo
migrado en Carga Inicial (Importador Excel)". Sin errores de consola en
ningún paso. `tsc --noEmit` y `npm run build` limpios (19 rutas).

## Plantilla de Carga Inicial ampliada — identidad, contacto y datos bancarios

Pedido explícito del usuario: "actualizar la plantilla de carga inicial con
todos los datos que entiendas que son necesarios, tomando en consideración
todo lo que se ha hecho porque después de esa plantilla vamos lejos". Antes
de tocar código se auditó (vía agente) el tipo `Empleado` completo y las
entidades relacionadas (`Prestamo`, `Dependiente`, `DisfruteVacaciones`,
`BandaSalarial`) para armar una propuesta de alcance, confirmada con el
usuario: **excluir préstamos activos** (es una entidad completa con su
propia lógica de amortización, no un campo — queda como tarea aparte) y
**excluir categoría de riesgo SRL** (se define a nivel de empresa al crear
la cuenta, vía sector, no por empleado). Se agregaron exactamente 9 campos:
`tipoDocumento`, `nacionalidad`, `fechaNacimiento`, `tipoContrato`, `email`,
`telefono`, `banco`, `numeroCuenta`, `regimenIntermitente`.

- **`empleado-form.ts`** — nueva constante compartida `TIPO_CONTRATO_OPTIONS`
  (antes las 7 opciones vivían duplicadas inline 2 veces dentro de
  `EmpleadoFormFields.tsx`), reutilizada junto con los catálogos ya
  existentes `DOC_TIPOS`/`PAISES`/`BANCOS` en los dos flujos de Carga
  Inicial — una sola fuente de verdad para las etiquetas exactas.
- **Asistente Guiado** — nueva sección "Identidad y Contacto" con los 9
  campos, mismo patrón no-destructivo que ya usan los saldos: en blanco
  significa "no tocar" (nunca sobreescribe un dato bueno ya cargado con
  vacío), no "borrar" — coherente porque este paso es para empleados que
  YA existen en el sistema.
- **Importador Excel** — 9 columnas nuevas insertadas entre los datos base
  (Cédula...Salario Base) y los de migración (Vacaciones...Saldo ISR), con
  parsers tolerantes: aceptan tanto el valor exacto en inglés (`cedula`)
  como la etiqueta en español que ve el usuario en el Excel (`Cédula`),
  comparando normalizado (sin acentos, sin mayúsculas) contra los mismos
  catálogos compartidos — igual para país (nombre o código ISO, ej. "DO"),
  banco, tipo de contrato. Mensajes de error específicos en español cuando
  el valor no se reconoce. Para filas que actualizan un empleado existente,
  mismo criterio no-destructivo del Asistente; para filas que crean uno
  nuevo, valores por defecto sensatos (`tipoDocumento: 'cedula'`,
  `tipoContrato: 'fijo'`) si la columna viene vacía.
- **Bug real encontrado durante la verificación (no relacionado con la
  lógica de parseo en sí)**: los archivos `.csv` se leían con
  `reader.readAsBinaryString()` + `XLSX.read(..., {type: 'binary'})` —
  correcto para `.xlsx`/`.xls` (formato binario ZIP), pero corrompe
  cualquier acento en un `.csv` de texto plano UTF-8 (cada byte multi-byte
  se lee como un carácter latin1 aparte, ej. "Cédula" → "CÃ©dula"). Nunca se
  había notado porque ningún campo anterior necesitaba coincidencia EXACTA
  contra un catálogo (nombres/cédulas no se comparan por igualdad, solo se
  guardan tal cual). Fix: `.csv` ahora se lee con `readAsText(file, 'UTF-8')`
  + `XLSX.read(texto, {type: 'string'})`; `.xlsx`/`.xls` siguen usando
  `readAsArrayBuffer()` + `{type: 'array'}` (más robusto que `'binary'`
  para archivos realmente binarios). Verificado con un CSV real conteniendo
  "Cédula" en una celda de datos (no solo en el encabezado) — antes del fix
  fallaba con "Tipo de Documento no reconocido" para TODAS las filas
  (incluidas las válidas); después del fix, exacto.

Verificado en navegador con Playwright, datos demo reales: Asistente Guiado
con Carlos Rodríguez Méndez → llenar Tipo de Documento/Nacionalidad/Tipo de
Contrato/Banco/Email/Teléfono/Cuenta/Régimen Intermitente → Guardar y
Continuar → su drawer en Empleados muestra los 9 valores exactos guardados.
Importador Excel con un CSV de 2 filas nuevas: Laura Campos (todos los
catálogos válidos, incluido "Cédula" con acento) → "OK", importada con
Nacionalidad/Banco/Email correctos en su drawer; Pedro Nunez (banco
inventado "BancoInventado") → error "Banco no reconocido — usa Banco
Popular/BanReservas/Scotiabank/BHD León/Banistmo/Otro", NO se creó su
registro. Sin errores de consola en ningún paso. `tsc --noEmit` y
`npm run build` limpios (19 rutas).

## Bonificación por Utilidades — liquidación vía período especial en Nómina

Pedido del usuario: "una vez toque liquidar la bonificación debe de crearse
un periodo de cálculo de nomina especial, es algo muy parecido a lo que
hicimos en regalía pascual". Antes de construirlo se confirmó con el
usuario la decisión legal que más cambia el cálculo: a diferencia de la
Regalía Pascual (100% exenta), la Bonificación por Participación en
Utilidades (Art. 223) **sí lleva AFP/SFS/ISR** — igual tratamiento que
Vacaciones.

**Arquitectura — mismo patrón que Regalía Pascual, con la retención real:**
- Nuevo valor `TipoPeriodo = 'bonificacion'` y `PeriodoNomina.montosBonificacion`/
  `motivosAjusteBonificacion` (monto BRUTO por empleado, con el tope de
  45/60 días de Art. 223 ya aplicado desde `/bonificacion`).
- **`resultadoBonificacion(empleado, montoBruto)`** (nuevo, `nomina-shared.ts`)
  — a diferencia de `resultadoRegalia()` (objeto sintético en cero), este
  reutiliza el motor real: `calcularNomina({ ...empleado, salarioBase:
  montoBruto })`, el mismo mecanismo ya usado para "Vacaciones No Gozadas"
  en Liquidación y "Vacaciones (Goce)/Vendidas" en Nómina — trata el monto
  como si fuera el salario del mes para calcular AFP/SFS/ISR normales.
- **Excluido de los mismos lugares donde ya se excluye `'regalia'`** (mismo
  bug class ya cazado en la sesión de Regalía Pascual, evitado desde el
  inicio esta vez): `calcularSalarioPromedioUltimos12Meses` (no infla el
  promedio de Cesantía/Preaviso), `calcularConPeriodo` (fallback en cero),
  los 6 selectores de período de Reportería, y el filtro de snapshot en
  Historial Nómina de Empleados.
- **`nomina/page.tsx`**: vista de detalle dedicada para `tipo ===
  'bonificacion'` (sin ajustes, préstamos, filtros ni auditoría pre-cierre,
  igual que Regalía) — pero a diferencia de esa, la tabla muestra "Monto
  Bruto" y "Neto a Pagar" por separado, y cada fila abre el mismo modal
  `DetalleNomina` con el desglose completo de AFP/SFS/ISR/aportes, en vez
  de un monto plano. `handleProcesarBonificacion()` no tiene ningún efecto
  de "reinicio de acumulado" (a diferencia de Regalía) — la Bonificación no
  se acumula mes a mes, se calcula una sola vez al año desde la utilidad
  neta capturada en `/bonificacion`.
- **`/bonificacion`**: nuevo selector de "Año Fiscal" (10 años atrás a 1
  adelante), botón "Solicitar Liquidación" que abre un modal con ajuste
  manual por empleado (motivo obligatorio, mismo patrón que Regalía),
  bloqueo de una segunda solicitud mientras el período del año elegido siga
  `en_proceso`/`procesada` (mismo guard que Regalía — banner "ya se
  solicitó" + link a Nómina), y una tabla "Bonificaciones Liquidadas" con
  el historial de años ya cerrados.

Verificado en navegador con Playwright, datos demo reales: utilidad neta
RD$5,000,000 → 10% distribuible RD$500,000 → "Solicitar Liquidación" (año
fiscal 2026, sin ajustes manuales) → período "Bonificación Utilidades 2026"
creado en Nómina con 8 empleados. Detalle de Ana Martínez Santos: bruto
RD$37,303.66 → AFP RD$1,070.62 (2.87%) + SFS RD$1,134.03 (3.04%) + ISR
RD$62.10 (sobre base anualizada tras exceder el tramo exento) = descuentos
RD$2,266.75 → neto RD$35,036.91, matemática exacta. Total del período:
RD$500,000.00 bruto → RD$435,602.78 neto. Procesado y cerrado sin
problema — no aparece en el selector "Nómina por Período" de Reportería
(mismo comportamiento ya confirmado para Regalía Pascual). De vuelta en
`/bonificacion`, el banner "ya se solicitó" desaparece, "Solicitar
Liquidación" vuelve a estar disponible, y aparece en "Bonificaciones
Liquidadas" con el total bruto/neto correctos y link "Ver en Nómina". Sin
errores de consola en ningún paso. `tsc --noEmit` y `npm run build`
limpios (19 rutas).

## Bonificación por Utilidades — cierre fiscal configurable + prorrateo de empleados liquidados (Art. 223-227)

El usuario señaló un hueco legal real en la liquidación de Bonificación
recién construida: un empleado liquidado a mitad de año (ej. entra en enero,
lo despiden en julio) sigue teniendo derecho a su bonificación proporcional
— pagadera junto con la del resto de la plantilla una vez cierra el
ejercicio económico de la empresa, no antes. El módulo anterior solo
consideraba `empleadosActivos`, excluyendo por completo a cualquier
liquidado. Se pidió explícitamente leer los Arts. 223-227, Título VIII del
Código de Trabajo antes de implementar — confirmado vía fetch del texto
literal:
- **Art. 223**: reparto del 10% de utilidades netas, tope 45/60 días según
  antigüedad; "cuando el trabajador no preste servicios durante todo el año...
  la participación individual será proporcional al salario del tiempo
  trabajado" — la ley no fija la fórmula exacta de esa proporción.
- **Art. 224**: pago obligatorio **entre 90 y 120 días después del cierre
  del ejercicio económico** — se usa el límite superior (120 días) como
  fecha de vencimiento para la alerta.
- **Art. 226**: exenciones (agrícolas/industriales/mineras en sus primeros 3
  años, agrícolas pequeñas ≤RD$1,000,000 de capital, zona franca) — citadas
  en la nota legal de la UI, no automatizadas (demasiado riesgo de
  determinar mal una exención automáticamente).

**Cierre de ejercicio fiscal configurable** — nuevo campo
`Empresa.cierreFiscal?: CierreFiscal` (`'diciembre' | 'marzo' | 'junio' |
'septiembre'`, los 4 cierres reconocidos por la DGII en RD), sin configurar
se asume `'diciembre'` (año calendario, comportamiento idéntico al que ya
existía, cero migración necesaria). Selector de 4 opciones (mismo patrón
visual de tarjetas que `CATEGORIAS_EMPRESA`) agregado en dos superficies:
`OnboardingWizard.tsx` (Paso 1, junto a zona franca) para que quede definido
desde la creación de la cuenta, y Configuración → Empresa → Clasificación
para Nómina (editable después).

**Motor — 3 funciones puras nuevas en `dominican-labor.ts`**:
- `rangoEjercicioFiscal(anioFiscal, cierreFiscal)` — el "año fiscal" se
  nombra por su año de CIERRE (ej. con `cierreFiscal='junio'`, el año fiscal
  2026 es el ejercicio del 01-jul-2025 al 30-jun-2026). Con `'diciembre'`
  (default), año fiscal N = año calendario N exacto.
- `fechaLimitePagoBonificacion(finEjercicio)` — fin + 120 días (Art. 224).
- `mesesEnEjercicioFiscal(fechaIngreso, fechaSalida, inicioEjercicio,
  finEjercicio)` — meses fraccionales (sin truncar) que un empleado trabajó
  DENTRO de un ejercicio específico; cubre tanto ingreso a mitad de ejercicio
  como salida a mitad de ejercicio (`fechaSalida = null` para un empleado
  que sigue activo, tratado como si trabajara hasta el cierre).

**`bonificacion/page.tsx` — reescritura de la elegibilidad**: en vez de
`empleadosActivos.filter(tipoContrato==='fijo')`, ahora parte de `empleados`
(roster completo, incluye inactivos — un liquidado nunca se borra) +
`useLiquidaciones()` para obtener la `fechaTerminacion` real de cada
inactivo. Un empleado liquidado sin registro de liquidación (dato
inconsistente) se excluye por seguridad. Diseño de la fórmula (interpretación
propia de Cielo Cloud, ya que el Art. 223 no la especifica):
- **Peso proporcional = salario × (mesesTrabajados/12)** — un empleado con
  solo 7 de 12 meses pesa 7/12 de su salario en el reparto total, en vez de
  competir con el mismo peso que uno de año completo. Con `meses=12` para
  todos (caso de siempre), la fórmula es matemáticamente idéntica a la
  anterior — sin regresión para el caso ya verificado en la sesión previa.
- **Tope individual también prorrateado**: `45/60 días × salarioDiario ×
  (mesesTrabajados/12)` — un empleado de medio año no puede alcanzar el tope
  completo.
- **Antigüedad evaluada a la fecha de salida** (o al cierre del ejercicio
  para un activo), no "a hoy" — irrelevante para un ejercicio ya pasado.
- Nueva columna "Meses Trabaj." + badge "Liquidado" junto al nombre, tanto en
  la tabla en pantalla como en el modal de Solicitar Liquidación y la
  exportación a Excel (columnas "Estado"/"Meses Trabajados" nuevas).

**Alerta 🔔 de vencimiento (Art. 224)** — `pendientesPago`: ejercicios
fiscales ya cerrados (`fin <= hoy`) sin un período `tipo:'bonificacion'
estado:'cerrada'` para ese año, ordenados por urgencia (más vencido primero).
**Acotado a ejercicios que se solapan con la antigüedad del empleado más
antiguo conocido** (`primerIngresoConocido`) — sin este límite, una empresa
recién migrada a Cielo Cloud sin historial cargado vería "vencido hace miles
de días" para ejercicios anteriores a que la empresa tuviera empleados, un
falso positivo absurdo. Banner rojo/ámbar (🔔, con botón "Calcular ahora" que
salta directo al año fiscal en cuestión) visible solo si `diasRestantes <=
45` — evita alarmar antes de que el vencimiento se acerque de verdad; fuera
de esa ventana, una StatCard "Próximo Vencimiento" siempre visible (verde
"Al día" si no hay pendientes, ámbar/rojo/celeste según urgencia) mantiene
la información disponible sin alarmar.

**Redesign — prepantalla "¿Qué quieres ver?"**, mismo patrón exacto ya
construido para Regalía Pascual (`pantalla: 'elegir'|'actual'|'historial'`,
se salta la elección si no hay historial): 2 tarjetas grandes ("Cálculo de
Bonificación" navy, "Historial de Liquidaciones" esmeralda) con degradado +
halo + hover-lift; el historial de liquidaciones pasa a su propia pantalla
con tabla dedicada (Ejercicio/Empleados/Total Bruto/Total Neto/Fecha de
Pago/Estado/"Ver en Nómina"), separado de la calculadora.

**Verificado con 3 escenarios simulados vía Playwright** (localStorage
sembrado directo, empresa+4 empleados+2 liquidaciones+9 períodos de
bonificación ya pagados 2016-2024, dejando 2025 deliberadamente sin pagar):
1. **FY2026 (cierre diciembre, ejercicio en curso)**: Ana (activa todo el
   año) → 12.0/12; Beto (entró 2026-01-01, liquidado 2026-07-15 — el
   ejemplo exacto planteado por el usuario) → aparece con badge "Liquidado"
   y 6.4/12 meses, RD$30,049.83 (vs. RD$69,950.17 de Ana); Cathy (se fue en
   2025) correctamente ausente; banner 🔔 rojo "venció hace 79 día(s)" para
   el ejercicio 2025 pendiente. Click "Calcular ahora" salta a FY2025 →
   Cathy reaparece prorrateada (~2.0/12, se fue el 2025-03-01), Beto
   ausente (aún no existía).
2. **FY2027 (año siguiente a la salida de Beto)**: Beto ya NO reaparece
   (su prorrateo fue exclusivo del ejercicio en que trabajó) — confirma que
   la ventana de 12 meses no arrastra empleados de ejercicios ya cerrados.
3. **Cambio de cierre fiscal a 'junio' vía Configuración (UI real, no
   localStorage)**: persistencia confirmada; `/bonificacion` recalcula el
   rango a "01 jul de 2025 – 30 jun de 2026"; Beto (mismo empleado) ahora
   prorratea distinto (6.0/12, porque el ejercicio junio cierra ANTES de su
   fecha de salida real) — confirma que el mismo empleado da un resultado
   distinto según el cierre fiscal configurado; Cathy ausente en FY2026-junio
   pero SÍ aparece en FY2025-junio (jul24-jun25, su salida de marzo 2025 cae
   dentro de esa ventana) — confirma el desplazamiento correcto de la
   ventana fiscal; el banner de vencimiento recalculó automáticamente contra
   las nuevas fechas de cierre sin ninguna acción adicional.

Sin errores de consola en ningún escenario. `tsc --noEmit` y `npm run build`
limpios (19 rutas, sin cambio de conteo).

## Dashboard — Centro de Alertas consolidado + gráficos con historial real

Feedback directo del usuario: las alertas de vencimiento/cumplimiento que
hoy viven dispersas módulo por módulo deberían "pasar por el Dashboard, en
otro orden" (priorizadas, no solo la única alerta de salario mínimo que ya
existía ahí); y los gráficos del Dashboard "solo se muestra el mes actual y
anterior" — pidió hacerlos más funcionales.

**Investigación del segundo punto — dos causas reales, no una sola:**
1. `periodosReales` filtraba únicamente `tipo === 'mensual'`. Una empresa en
   `modalidadNomina: 'quincenal'` (`Empresa`) nunca genera períodos de ese
   tipo, así que sus gráficos SIEMPRE caían al relleno sintético sin importar
   cuántas quincenas reales tuviera procesadas — un bug real, no solo
   percepción.
2. El botón "Este mes ⋯" en cada chart card no tenía `onClick` — era
   puramente decorativo, sin ninguna forma real de ver más historial. El cap
   de `.slice(-5)` tampoco era ajustable.

**Fix de gráficos (`src/app/page.tsx`):**
- `periodosPorMes` (nuevo `useMemo`) agrega tipo `'mensual'` Y `'quincenal'`
  (sumando ambas quincenas de un mismo mes en un solo total), reemplazando
  el filtro que solo consideraba mensual.
- `RangoSelector` (3M/6M/12M) — nuevo control real y funcional, compartido
  entre las 3 chart cards, reemplaza el botón decorativo sin `onClick`
  (también removido el ícono `MoreHorizontal` sin acción de la card
  "Retenciones" — mismo principio ya aplicado en la sesión de "affordance de
  hover": ningún control debe aparentar ser clickeable sin serlo).
- Umbral de datos reales bajado de `>= 2` a `>= 1` — antes, con solo 1
  período real procesado, se descartaba por completo en favor de 5 meses
  100% inventados; ahora se muestra ese único período real (honesto, aunque
  disperso) en vez de fabricar datos.
- Relleno sintético (solo cuando NO hay ningún período real) ahora se genera
  dinámicamente según `rangoMeses` en vez de un array fijo de 5, y una nota
  visible ("Datos ilustrativos — aún no hay períodos procesados" vs. "N
  período(s) real(es) procesado(s)") aclara honestamente cuál es cuál — antes
  no había forma de distinguir un gráfico con datos reales de uno inventado.
- Etiquetas de mes incluyen el año ("Ene 25") solo cuando el rango visible
  cruza más de un año calendario — evita ambigüedad en rangos de 12 meses
  sin ensuciar la etiqueta en el caso común.

**Centro de Alertas (`src/components/dashboard/CentroAlertas.tsx`, nuevo):**
reemplaza el banner de salario mínimo (única alerta que existía en el
Dashboard) por una lista consolidada y **ordenada por severidad**
(danger → warning → info, no por orden de llegada) de 5 fuentes reales del
sistema, cada una reutilizando la lógica de negocio ya existente en su
módulo (sin duplicar reglas):
- **Salario mínimo bajo** (`getSalarioMinimoAplicable`) — danger.
- **Bonificación por Utilidades vencida/por vencer** (Art. 224) — reutiliza
  `getBonificacionesPendientes()`, recién extraído de `/bonificacion` a
  `dominican-labor.ts` para que ambas superficies (el módulo y el Dashboard)
  compartan exactamente la misma regla de ventana fiscal — danger si ya
  venció, warning si vence en ≤45 días.
- **Regalía Pascual próxima a vencer** (20 de diciembre, Art. 219) — mismo
  umbral de 30 días ya usado en `/regalia-pascual` — danger/warning.
- **Préstamos que requieren gestión de cobro** (`Prestamo.requiereGestionCobro`,
  3+ cuotas omitidas consecutivas) — warning.
- **Empleados fuera de banda salarial** (`useBandasSalariales` +
  `normalizarPosicion`) — info.
Cada fila es un `Link` que navega directo al módulo correspondiente (el
detalle completo vive ahí, el Centro de Alertas es un resumen priorizado,
no un duplicado) — las dos alertas con más valor a simple vista (salario
mínimo, préstamos) muestran además hasta 3 nombres de empleados afectados
inline. Colapsable (`ChevronDown`), con badge de conteo total. Sin ninguna
alerta aplicable, un estado positivo verde "Todo en orden" reemplaza la
lista — mismo patrón ya establecido en el Resumen de Configuración.

**Verificado en navegador con Playwright, 3 escenarios sembrados directo en
localStorage:**
1. Empresa con empleado bajo el mínimo, préstamo con gestión de cobro,
   empleado fuera de banda, y 5 períodos mensuales reales → las 4 alertas
   aparecen en el orden correcto (2 danger primero, luego warning, luego
   info), cada click navega al módulo correcto; selector 3M/6M/12M cambia
   la nota de "5 períodos reales" a "3 períodos reales" y viceversa sin
   inventar los que faltan.
2. Misma empresa en `modalidadNomina: 'quincenal'` con 3 meses × 2 quincenas
   cada uno → nota confirma "3 períodos reales procesados" (agregados
   correctamente), donde antes del fix habría caído sin remedio al relleno
   sintético.
3. Cuenta nueva sin ningún período ni préstamo ni banda, empleado con
   antigüedad reciente (sin ejercicios fiscales pasados que reclamar) →
   "Todo en orden" y "Datos ilustrativos — aún no hay períodos procesados",
   confirmando que el estado vacío no fabrica una falsa sensación de alerta
   ni de historial real.
Verificado también en modo oscuro y viewport móvil (390×844) sin errores de
consola. `tsc --noEmit` y `npm run build` limpios (19 rutas, sin cambio de
conteo).

## Centro de Alertas — pulido visual premium

Feedback directo del usuario tras ver el Centro de Alertas recién agregado:
"me gustaría que el centro de alerta se ve más profesional". Rediseño del
componente (`src/components/dashboard/CentroAlertas.tsx`), mismo contenido y
lógica, tratamiento visual acorde al resto del sistema:
- Ícono de cada fila en badge `rounded-xl` con degradado por severidad
  (rose/amber/sky) + halo `blur-md` detrás — mismo lenguaje ya usado en
  Configuración Inicial y las tarjetas de Regalía Pascual/Bonificación,
  aplicado aquí por primera vez a una lista de alertas en vez de tarjetas
  grandes.
- Franja izquierda de color (`border-l-2`) por severidad — patrón estándar
  de listas de alertas en dashboards profesionales (Linear, Vercel), permite
  escanear la urgencia sin leer el texto.
- Etiqueta de severidad explícita ("URGENTE"/"ADVERTENCIA"/"INFORMATIVO") en
  mayúsculas junto al título — antes la severidad solo se comunicaba por
  color, ahora también por texto (accesibilidad, no depender solo del color).
- Header con ícono navy degradado + resumen de conteos por severidad con
  puntos de color inline ("2 urgentes · 1 advertencia · 1 informativo") en
  vez de solo el badge de conteo total — comunica la composición de un
  vistazo antes de expandir.
- Detalle de empleados/préstamos afectados como chips `rounded-full` en vez
  de líneas de texto plano, con "+N más" cuando hay más de 3.
- Estado positivo "Todo en orden" también recibe el mismo tratamiento de
  ícono degradado (esmeralda) + halo, en vez del banner plano anterior.
- Micro-interacción: el ícono de cada fila escala levemente (`scale-105`) y
  su halo aparece al hover, junto con la flecha del CTA desplazándose — ya
  no es una fila estática.

Verificado en navegador con Playwright, mismo dataset multi-alerta de la
sesión anterior, en modo claro y oscuro — contraste correcto en ambos,
franjas de severidad y chips de detalle legibles, sin errores de consola.
`tsc --noEmit` y `npm run build` limpios (19 rutas, sin cambio de conteo).

## Branch de trabajo

`claude/accounting-app-sme-design-wqfazv` → remote: `manuel-erasmo-oss/tyui`

## Commits de esta sesión (más recientes primero)

| Hash | Descripción |
|---|---|
| `a5717a8` | polish: Centro de Alertas con tratamiento visual premium |
| `0e21450` | feat: Centro de Alertas en Dashboard + gráficos con historial real configurable |
| `58e2a51` | fix: prorratear Bonificación de empleados liquidados a mitad del ejercicio fiscal |
| `c1cbd0c` | feat: liquidación de Bonificación por Utilidades vía período especial en Nómina |
| `06c579f` | feat: ampliar plantilla de Carga Inicial con identidad, contacto y datos bancarios |
| `7374260` | feat: Saldo ISR a Favor migrado — Carga Inicial ya no es decorativa |
| `f32d2cf` | fix: acumulación de vacaciones ahora compone múltiples años + venta de vacaciones |
| `c167b40` | feat: disfrute de vacaciones — registro de toma + puente automático a Nómina |
| `0aa2a7e` | feat: agregar favicon al sistema (isotipo Cielo Cloud) |
| `bb2f8ec` | feat: permitir crear períodos retroactivos hasta 10 años atrás |
| `320390a` | fix: Cálculo de Nómina — permitir seleccionar el período libremente |
| `de3e2c4` | redesign: separar Nómina en Cálculo de Nómina y Gestión de Envíos |
| `86bf00a` | fix: períodos de Regalía Pascual contaminaban Reportería/Liquidación + rediseño premium con prepantalla |
| `252b78a` | docs: registrar en CLAUDE.md las fases pendientes y las 3 features más recientes |
| `4c8bbab` | fix: Regalía Pascual — banner de ciclo pendiente no distinguía período cerrado |
| `5ffe5b5` | fix: vacaciones no gozadas llevan AFP/SFS/ISR — no son indemnización exenta |
| `fe92d70` | feat: liquidación de Regalía Pascual vía período especial en Nómina |
| `0fdac97` | polish: identidad visual propia para Liquidación — no imita Préstamos/Reportería |
| `9020d43` | redesign: Liquidación en asistente de 3 pasos, cálculo transparente y editable, PDF de firma |
| `4c465cc` | feat: exportación a Excel en Empleados y Préstamos |
| `732f04c` | feat: exportación a Excel con estilo real en todos los módulos de negocio |
| `7d0fdcf` | fix: key duplicada en fila de nómina — pertenecía al Fragment, no al `<tr>` |
| `add67a2` | feat: salida pendiente de empleados + pago de días trabajados al terminar |
| `aa8b459` | fix: dos decimales consistentes en montos + bordes visibles en tablas |
| `7b54e8b` | fix: el salto real era texto envolviéndose a 2 líneas durante el flyout |
| `5d0e386` | fix: salto residual del layout interno al abrir el flyout de la sidebar |
| `4160d79` | fix: eliminar jank al pasar el mouse por la sidebar (flyout + prefetch) |
| `1555027` | feat: catálogo configurable de ingresos y deducciones en Configuración |
| `57be0a8` | feat: sidebar colapsado se expande temporalmente al pasar el mouse (flyout) |
| `e1f0ef1` | feat: filas de tabla clickeables — corrige desajuste de affordance de hover |
| `f44a6f5` | feat: estados vacíos con personalidad, PDF de comprobante rediseñado, botón primario compartido |
| `7613918` | feat: paletazo de comandos (Cmd+K) + skeletons con forma en Dashboard |
| `8a34dde` | docs: registrar rediseño premium de login/registro en CLAUDE.md |
| `fc96104` | redesign: pantallas de login y registro con estética cinematográfica premium |
| `4f9a905` | fix: multiempresa con cuentas reales de Firebase, no perfiles compartidos |
| `503b167` | feat: multiempresa — una cuenta puede tener varias empresas |
| `458a71c` | polish: Resumen deja de repetir el rail, agrega patrones estilo QuickBooks/SAP |
| `3d85c59` | redesign: recrear Configuración como rail persistente + panel continuo |
| `08725d8` | retire: eliminar módulo Inicio de Año, reubicar Feriados en Configuración |
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
