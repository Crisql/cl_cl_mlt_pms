# CHARTS-CONFIG (Dashboard) — Migración COMPLETA

> Módulo legacy: `src/app/pages/charts-config/` (ruta `/Dashboard`).
> Administración (CRUD) de los gráficos del tablero.
> Análisis: `docs/migration/comparisons/CHARTS-CONFIG-COMPLETE-ANALYSIS.md`.

## ✅ Funcionalidad implementada (100%)

### Listado `/Dashboard`
- `GET /api/Chart/GetChartsConfiguration` con headers `Authorization: Bearer` + `cl-company-id`.
- Tabla con columnas **Titulo · Tipo (ícono) · Vista de base de datos · Activo (ícono)** + acción **Editar**.
- Íconos de tipo: `bar_chart`/`pie_chart`/`show_chart`/`insert_chart` (color `#1b81be`), tooltip `"{type} Chart"`.
- Íconos de estado: `check_circle` (#58d68d) / `cancel` (#ec7063).
- Búsqueda local por Título con debounce 350ms.
- Paginación local (10/20/50, default 10).
- Botón **Nuevo** → `/Dashboard/new`; **Editar** → `/Dashboard/:id/edit`.

### Formulario (crear/editar, por rutas)
- Carga inicial: `ChartType.json`, `dataType.json`, `optionsForCharts.json` (assets locales) + `GET /api/Chart/GetChartsColorRanges`; en edición además `GET /api/Chart/GetChartsLabelsByChartId?Id={id}`.
- Pestaña **Gráficos**: Title, Type, Options (con autocomplete/datalist), XType, YType, XAxisDatasets, IsActive — mismas validaciones (required) que el legacy.
- Pestaña **Labels**: XAxis (required), toggle "Labels dinámicos", filas Label+Color (modo manual) o select de rango de colores (modo dinámico) con preview sólido/degradado.
- Validación de rangos de color (`^#[0-9A-F]{6}$`): los inválidos se excluyen del select y generan notificación.
- `IsValidForm` replicado **incluida la sutileza** de que en modo dinámico no se exige ≥1 fila de color.
- **Crear**: `POST /api/Chart` con `IChartContext` exacto (`Chart` + `ChartLabel`, `Colors`/`Labels` como JSON string).
- **Editar**: `PATCH /api/Chart` con `Chart.Id` y `ChartLabel.Id` (= `chartLabels[0].Id` o `0`); `CreatedBy/UpdatedBy` heredados del registro.
- Toasts "Creado correctamente" / "Actualizado correctamente"; overlay durante la operación; al terminar navega al listado.

## ✅ Pruebas (14/14)
`tests/e2e/charts-config-complete-suite.spec.js`:
- Listado: contrato GET + headers, render, íconos tipo/estado, tooltip, búsqueda, navegación Nuevo/Editar.
- Form crear: carga de selects/opciones/rangos (excluye inválidos), habilitación del botón Guardar, **POST con payload `IChartContext` exacto**, variante labels dinámicos.
- Form editar: hidratación de campos + labels manuales, **PATCH con `Chart.Id`/`ChartLabel.Id`** y `CreatedBy` heredado.
- Toggle dinámico: confirmación de pérdida (cancelar revierte / aceptar cambia a dinámico).

Regresión total tras la migración: **67 passed, 1 skipped** (el skip es el test de login real que requiere credenciales clv).

## 📋 Diferencias conocidas (solo navegación/diseño)
1. **Rutas en vez de modal** para crear/editar (decisión del usuario). `/Dashboard/new` y `/Dashboard/:id/edit`.
2. **Toast** en lugar de `NotificationCenterService` para rangos de color inválidos (no hay centro de notificaciones portado).
3. En edición el formulario **re-hidrata el `IChart`** vía `GetChartsConfiguration` filtrando por `Id` (no existe GET-by-id; el modal recibía el objeto en memoria). Mismo endpoint del listado, sin cambio de contrato.
4. **Corrección de bug del legacy**: al cancelar el cambio a labels dinámicos, el legacy quedaba en estado inconsistente (toggle activo pero modo manual). En Rails el toggle se revierte a desactivado, conservando las filas manuales.
5. Preview de rango de colores como **swatch bajo el select** (el legacy lo pintaba dentro de cada opción del `mat-select`, no replicable en un `<select>` nativo).

## Archivos
- `config/routes.rb` (+ rutas Dashboard/new/edit)
- `app/controllers/charts_config_controller.rb`
- `app/views/charts_config/index.html.erb`, `form.html.erb`
- `app/javascript/controllers/charts_config_controller.js` (listado)
- `app/javascript/controllers/chart_config_form_controller.js` (formulario)
- `public/assets/data/{ChartType,dataType,optionsForCharts}.json`
- `tests/e2e/charts-config-complete-suite.spec.js`
