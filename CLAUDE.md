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

## Branch de trabajo

`claude/accounting-app-sme-design-wqfazv` → remote: `manuel-erasmo-oss/tyui`

## Commits de esta sesión (más recientes primero)

| Hash | Descripción |
|---|---|
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
