# CHARTS-CONFIG — Análisis completo del legacy (Angular → Rails)

> Módulo Angular: `src/app/pages/charts-config/` (ruta `/Dashboard`, lazy `ChartsConfigModule`).
> Es la **administración (CRUD) de los gráficos del tablero**. El render del tablero
> en sí (`/Home` → `<app-charts>`) ya está migrado (ver `HOME-COMPLETE-ANALYSIS.md`).

## DECISIÓN DE DISEÑO (acordada con el usuario)

El legacy crea/edita gráficos en un **modal** (`ModalChartConfigComponent`, `MatDialog`, `width: 40vw`).
En Rails **se reemplaza el modal por navegación por rutas**:

- `/Dashboard` → listado
- `/Dashboard/new` → formulario de creación
- `/Dashboard/:id/edit` → formulario de edición

Esto es un cambio **solo de navegación/diseño** (permitido por el protocolo). El **contrato de
API, los campos, validaciones, defaults y flujos se mantienen idénticos** al modal del Angular.

---

## 1. LISTADO — `ChartsConfigComponent`

### Estructura
- Card "Buscar o agregar": input de búsqueda (`app-search-input`, debounce 350ms) + botón **Nuevo**.
- Card "Resultados de búsqueda": tabla `cl-table` con botón de fila **Editar**.

### Tabla (cl-table) — columnas visibles
`MapDisplayColumns` con:
- `renameColumns`: `Title`→**Titulo**, `TypeIcon`→**Tipo**, `XAxisDatasets`→**Vista de base de datos**, `Active`→**Activo** (`UpdatedBy`→"Actualizado por" se renombra **pero también está en `ignoreColumns`**, así que NO se muestra).
- `ignoreColumns`: `Id, ViewLabels, IsActive, UpdatedBy, Options, CreatedDate, UpdateDate, CreatedBy, ViewLabelsCode, Data, XAxisDatasetsCode, XType, YType, ErrorMessage, Type`.
- `iconColumns`: `TypeIcon`, `Active`.

→ **Columnas finales visibles: Titulo · Tipo (ícono) · Vista de base de datos · Activo (ícono)** + botón Editar.

### Íconos
- **TypeIcon** según `Type.toLowerCase()`: `pie`→`pie_chart`, `bar`→`bar_chart`, `line`→`show_chart`, default→`insert_chart`; color `#1b81be`. Tooltip de la celda = `` `${type.toLowerCase()} Chart` `` (`CellsMessages.TypeIcon`).
- **Active**: `IsActive ? Enabled : Disabled`
  - Enabled = `check_circle` color `#58d68d`
  - Disabled = `cancel` color `#ec7063`

### Búsqueda (local)
`FilterCharts`: `chartsList.filter(c => c.Title.toLowerCase().includes(criterio.toLowerCase()))`. Se dispara con `onValueChange` y `onClickSearchButton`.

### Botones de fila
Solo **Editar** (`CL_ACTIONS.UPDATE`, ícono `edit`, color `primary`). Al hacer click → abre el form de edición con el `IChart` de la fila.

### Carga
`getCharts()` → overlay → `GetChartsConfiguration()` → setea `chartsList`, calcula `TypeIcon` por fila, infla la tabla. En error: lista vacía (no rompe).

### Contrato API del listado
| Acción | Método | Endpoint | Notas |
|--------|--------|----------|-------|
| Cargar lista | GET | `/api/Chart/GetChartsConfiguration` | `ICLResponse<IChart[]>` (incluye activos e inactivos) |

---

## 2. FORMULARIO — `ModalChartConfigComponent` (en Rails: páginas new/edit)

### Pestaña "Gráficos" (`formChart`)
| Campo | Control | Validación | Notas |
|-------|---------|-----------|-------|
| Titulo | input text | **required** | |
| Tipo | select | **required** | opciones de `ChartType.json` (bar/pie/line), value = `id` |
| Opciones | input text + autocomplete | **required** | opciones de `optionsForCharts.json`; el autocomplete sugiere `option.id` |
| XType | select | **required** | opciones de `dataType.json` (string/number) |
| YType | select | **required** | opciones de `dataType.json` |
| Vista de datasets | input text | **required** | mapea a `XAxisDatasets` |
| Activo | slide-toggle | — | `IsActive`, default **true** |

Campos ocultos del form: `CreatedBy`, `UpdatedBy` (se envían vacíos al crear).

### Pestaña "Labels" (`formChartLabel`)
| Campo | Control | Validación |
|-------|---------|-----------|
| Nombre del label principal | input text | **required** (`XAxis`) |
| Labels dinámicos | slide-toggle | required (`HaveDynamicLabels`, default false) |
| (manual) Colors | FormArray de `{Label (required), Color}` | al menos 1 fila |
| (dinámico) Rango de colores dinámicos | select (`ChartColorRange`) | sin validador |

**Modo manual** (`HaveDynamicLabels=false`): botón "Agregar Color" agrega fila `{Label, Color (input type=color, default #000000)}`; botón borrar por fila.

**Modo dinámico** (`HaveDynamicLabels=true`): `Colors` pasa a ser un `FormControl` simple; se muestra un select de rangos de color (`GetChartsColorRanges`), solo los **válidos** (`IsRangeInvalid=false`), con preview de color sólido o degradado.

### Toggle de labels dinámicos (`AskToChangeDynamicLabels`)
- Si se activa **y** ya hay filas de color → confirm: *"Al cambiar a label dinámicos se perderá el nombre de los labels ya creados. ¿Desea continuar?"* (disableClose). Si **no** → revierte el toggle.
- Si no hay filas → cambia directo (`OnSlideToggleChange`).
- `OnSlideToggleChange`: activado → `Colors` = `FormControl('')`; desactivado → `Colors` = `FormArray([])` (y rehabilita labels).

### Validación de rangos de color (`IsRangeInvalid` / `CheckColorRanges`)
Un rango es inválido si `JSON.parse(Colors)` no es array no vacío de colores `^#[0-9A-F]{6}$` (case-insensitive). Los rangos inválidos:
- se **excluyen** del select dinámico.
- generan una **notificación** (legacy: `NotificationCenterService.Push`, priority low). Mensajes:
  - 1 inválido: `El rango {Name} no tiene el formato correcto`
  - varios: `Los rangos {Name, Name...} no tienen el formato correcto`

> **Adaptación Rails:** no hay `NotificationCenterService` portado. Se replica con **toast** de error (misma información). Diferencia documentada.

### Preview de color (modo dinámico)
- `CheckGradientColors(colors)`: `JSON.parse(colors).length > 1`.
- `GetGradientStyle(colors, isGradient)`: si no gradiente → `background: colors[0]`; si gradiente → `linear-gradient(to right, c1, c2, ...)`.

### Validez del form (`IsValidForm`)
```
if (formChartLabel.invalid || ColorsFormArray.length == 0) return false
if (formChart.invalid) return false
return true
```
**Sutileza replicada:** en modo dinámico, `Colors` es un `FormControl`, por lo que `ColorsFormArray.length` es `undefined` y `undefined == 0` es **false** → en dinámico la condición se reduce a `formChartLabel.invalid` (basta `XAxis` + `formChart` válido). En modo manual sí se exige ≥1 fila con `Label`.

`GetTooltipMessage()`: si inválido por labels → *"Se requiere que se complete la información de los labels"*; si `formChart` inválido → *"Formulario no válido"*. Botón Guardar deshabilitado si `!IsValidForm()`.

### Guardar (`OnSave`)
1. Guard: `if (formChartLabel.invalid || ColorsFormArray.length == 0)` → toast warning *"Se requiere que se complete la información de los labels"* y return.
2. `isEditing` → `UpdateGraph()` (PATCH); si no → `CreateGraph()` (POST).

### Construcción del payload (`BuildChartContext`)
```js
chart = formChart.getRawValue()  // {Title, Type, Options, XType, YType, XAxisDatasets, IsActive, CreatedBy, UpdatedBy}
haveDynamic = formChartLabel.HaveDynamicLabels
colors = haveDynamic ? [] : ColorsFormArray.map(Color)
labels = haveDynamic ? [] : ColorsFormArray.map(Label)
ChartLabel = {
  HaveDynamicLabels,
  Colors: JSON.stringify(colors),
  ChartColorRange: formChartLabel.ChartColorRange,
  Labels: JSON.stringify(labels),
  XAxis: formChartLabel.XAxis,
  CreatedBy: '', UpdatedBy: ''
}
return { Chart: chart, ChartLabel }
```
- **Crear** (`CreateGraph`): `POST /api/Chart` con el `IChartContext`. Toast success *"Creado correctamente"*.
- **Editar** (`UpdateGraph`): setea `Chart.Id = data.Id` y `ChartLabel.Id = chartLabels[0]?.Id ?? 0`; `PATCH /api/Chart`. Toast success *"Actualizado correctamente"*. (El toast de update se muestra siempre; el de create solo si `data` truthy.)

En ambos: overlay durante la operación; al finalizar cierra el form (en Rails: navega de vuelta a `/Dashboard`) y refresca el listado.

### Carga inicial del form (`GetInitialData`, forkJoin)
| Llamada | Método | Endpoint | Cuándo |
|---------|--------|----------|--------|
| Tipos de gráfico | GET | `/assets/data/ChartType.json` | siempre |
| Tipos de dato | GET | `/assets/data/dataType.json` | siempre |
| Opciones | GET | `/assets/data/optionsForCharts.json` | siempre |
| Labels del gráfico | GET | `/api/Chart/GetChartsLabelsByChartId?Id={id}` | **solo en edición** |
| Rangos de color | GET | `/api/Chart/GetChartsColorRanges` | siempre |

Cada llamada tolera error (catchError → null). Al editar, `formChart.patchValue(data)` y luego `PatchLabels()` con `chartLabels[0]`.

### `PatchLabels` (edición)
- `HaveDynamicLabels`, `XAxis` desde `chartLabels[0]`.
- `labels = JSON.parse(Labels)`.
- dinámico → `Colors = FormControl(chartLabel.Colors)`, `ChartColorRange = chartLabel.ChartColorRange`.
- manual → `colors = JSON.parse(Colors)`; por cada color `push(NewLabel(labels[i], color))`.

---

## 3. CONTRATO API CONSOLIDADO

| Acción | Método | Endpoint | Body | Headers |
|--------|--------|----------|------|---------|
| Listar | GET | `/api/Chart/GetChartsConfiguration` | — | Bearer + cl-company-id |
| Rangos de color | GET | `/api/Chart/GetChartsColorRanges` | — | Bearer + cl-company-id |
| Labels por gráfico | GET | `/api/Chart/GetChartsLabelsByChartId?Id={id}` | — | Bearer + cl-company-id |
| Crear | POST | `/api/Chart` | `IChartContext` | Bearer + cl-company-id |
| Editar | PATCH | `/api/Chart` | `IChartContext` (con Ids) | Bearer + cl-company-id |

Assets locales (no API): `/assets/data/ChartType.json`, `/assets/data/dataType.json`, `/assets/data/optionsForCharts.json`.

### Interfaces
```ts
IChart        { Id, Title, Type, Options, XAxisDatasets, XType, YType, IsActive, Data, Active, ErrorMessage?, TypeIcon?, CreatedBy, UpdatedBy, ... }
IChartLabels  { Id, ChartId, Colors, XAxis, Labels, HaveDynamicLabels, ChartColorRange, CreatedBy, UpdatedBy }
IChartColorRange { Code, Name, Colors }   // Colors = JSON string de array de hex
IChartContext { Chart: IChart, ChartLabel: IChartLabels }
EnumDescriptor { id, name }
```

---

## 4. MATRIZ DE FUNCIONALIDAD

| Funcionalidad | Implementado en Rails | % | Notas |
|---------------|----------------------|---|-------|
| Listado GetChartsConfiguration | ✅ | 100 | tabla Tailwind |
| Columnas Titulo/Tipo(ícono)/Vista/Activo(ícono) | ✅ | 100 | mismos íconos/colores |
| Tooltip de tipo "{type} Chart" | ✅ | 100 | |
| Búsqueda local por Título (debounce 350) | ✅ | 100 | |
| Botón Nuevo → ruta new | ✅ | 100 | ruta en vez de modal |
| Botón Editar → ruta edit | ✅ | 100 | ruta en vez de modal |
| Form: pestaña Gráficos (7 campos) | ✅ | 100 | mismas validaciones |
| Form: pestaña Labels (manual/dinámico) | ✅ | 100 | |
| Toggle dinámico con confirm de pérdida | ✅ | 100 | confirm de alerts |
| Agregar/Eliminar color (manual) | ✅ | 100 | |
| Validación rangos de color + preview | ✅ | 100 | sólido/degradado |
| Notificación de rangos inválidos | ✅ | 100 | **toast** (no notification-center) |
| IsValidForm (incl. sutileza dinámico) | ✅ | 100 | |
| POST crear / PATCH editar (contrato) | ✅ | 100 | payload idéntico |
| Carga inicial forkJoin (enums+labels+rangos) | ✅ | 100 | edición re-hidrata IChart vía GetChartsConfiguration |

### Diferencias conocidas (solo navegación/diseño)
1. **Rutas en vez de modal** para crear/editar (decisión del usuario).
2. **Toast** en lugar de `NotificationCenterService` para rangos de color inválidos (no hay centro de notificaciones portado).
3. En edición, el form **re-hidrata el `IChart`** llamando `GetChartsConfiguration` y filtrando por `Id` (el modal recibía el objeto en memoria; aquí no hay diálogo, y no existe endpoint GET-by-id). Mismo endpoint ya usado por el listado; sin cambio de contrato.
