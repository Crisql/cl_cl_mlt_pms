# HOME (+ CHARTS) — Análisis Completo (Angular → Rails)

**Fuentes legacy analizadas (100% del código leído):**
- `src/app/pages/home/home.component.{ts,html,css}`
- `src/app/pages/home/charts/charts.component.{ts,html,css}`
- `src/app/core/services/chart.service.ts`
- `src/app/core/services/global.service.ts` (observable `company`)
- `src/assets/data/ChartType.json`, `optionsForCharts.json`

## HomeComponent

**Rutas:** `/Home` y `/Home/:UserId` (misma vista). Raíz `''` redirige a `/Home`.

**ngOnInit:**
1. `ValidateSession()`: con `CurrentSession` → `currentUser = UserEmail` del token y `OpenDialog()`; SIN sesión → borra `CurrentSession` y navega `/Login`.
2. `OpenDialog()`: si NO hay compañía seleccionada y está autenticado → abre **SelectCompany** como modal (disableClose, 70%/80%). [Migrado en SelectCompany]
3. Logo de compañía: `SelectedCompany.Logo` (base64) o default — shell, diferido.

**Vista:** tarjeta "Bienvenido" + fecha `yyyy-MM-dd` + `v.{version}` + imagen `home-white.png`; debajo `<app-charts>`.

## ChartsComponent (app-charts)

**Activación:**
- `ngOnInit`: SOLO si `HaveSelectedCompany()` → `GetCharts()`.
- Suscripción a `globalService.company` (emite cuando SelectCompany cierra con compañía) → limpia y re-ejecuta `GetCharts()`.

**GetCharts():**
1. Overlay: `Cargando tablero principal`.
2. `GET /api/Chart` (Bearer + cl-company-id) → `ICLResponse<IChart[]>`.
   - `IChart`: `{Title, Type ('bar'|'pie'|'line'), Data (labels/datasets chart.js), Options (string JSON), IsActive, ErrorMessage}`.
3. Si `Message.length > 0` → **modal ERROR**: title = `Message`, subtitle = charts con `ErrorMessage` unidos como `"{Title}: {ErrorMessage}"` separados por `', '`.
4. `chartsData = Data.filter(IsActive)`.
5. Por cada chart: si `Data.labels` está vacío → `labels = ['Sin datos']` y cada dataset: `data.push(1)`, `label = 'Sin datos'`.
6. Config chart.js: `{type: chart.Type, data: chart.Data, options: JSON.parse(chart.Options)}`.
7. Render: un `<canvas>` por chart (destruye instancias previas antes de re-crear).
8. `catchError` → lista vacía (sin modal de error de red).

**Vista charts:** grid de tarjetas: `Title` + divider + canvas (4 por fila en desktop, responsive).

**Librería:** chart.js 4.4 (`Chart.register(...registerables)` — equivalente a `chart.js/auto`).

## Contrato API

| Método | Endpoint | Headers | Cuándo |
|---|---|---|---|
| GET | `/api/Chart` | Bearer + cl-company-id | Home con compañía seleccionada; re-fetch al cambiar compañía |

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| ValidateSession + OpenDialog | ✅ | 100% | migrado con SelectCompany |
| Tarjeta Bienvenido (fecha yyyy-MM-dd, versión, imagen) | ✅ | 100% | |
| GET /api/Chart solo con compañía | ✅ | 100% | |
| Filtro IsActive | ✅ | 100% | |
| Manejo "Sin datos" (labels vacíos) | ✅ | 100% | |
| Render chart.js (type/data/options parseadas) | ✅ | 100% | chart.js 4.4 vía importmap CDN |
| Modal de error con Message + ErrorMessages | ✅ | 100% | |
| Re-fetch al cambiar compañía (observable company) | ✅ | 100% | CustomEvent pms:company-changed |
| Overlay "Cargando tablero principal" | ✅ | 100% | |
| Logo de compañía en shell / avatar | ⏳ | 0% | Diferido al módulo shell/layout |
