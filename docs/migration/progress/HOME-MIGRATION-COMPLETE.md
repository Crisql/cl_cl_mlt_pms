# HOME (+ CHARTS) — Migración Completa

**Fecha:** 2026-06-03
**Estado:** ✅ Completo (6/6 pruebas pasando; regresión total 39/39)

## Funcionalidad implementada (100%)

- ✅ `ValidateSession`: sin `CurrentSession` → `/Login`; con sesión sin compañía → modal SelectCompany (migrado en su propio módulo)
- ✅ Tarjeta "Bienvenido" con fecha `yyyy-MM-dd`, versión (`v.{APP_VERSION}`) e imagen `home-white.png`
- ✅ Dashboard de charts (réplica de `<app-charts>`):
  - `GET /api/Chart` (Bearer + `cl-company-id`) SOLO cuando hay compañía seleccionada
  - Filtro `IsActive` (charts inactivos no se renderizan)
  - Manejo "Sin datos": labels vacíos → `['Sin datos']`, datasets `data=[1]`, `label='Sin datos'` (verificado contra el estado interno de chart.js)
  - Config chart.js: `{type, data, options: JSON.parse(Options)}` — chart.js **4.4** (misma versión que Angular) vía importmap CDN
  - `Message` no vacío → modal de error con título = Message y detalle `"{Title}: {ErrorMessage}"` unido por comas
  - Error de red → silencioso (réplica del `catchError(() => [])`)
  - Overlay "Cargando tablero principal"
  - Re-fetch al cambiar de compañía: evento `pms:company-changed` (equivalente al observable `globalService.company`), disparado por SelectCompany al cerrar con compañía
  - Destrucción de instancias chart.js previas antes de re-render

## Pruebas

- Suite: `tests/e2e/home-charts-complete-suite.spec.js` — **6/6 pasando**
- Cobertura: estructura del Home, contrato API (headers verificados), filtro IsActive, transformación "Sin datos", modal de error, no-llamada sin compañía, re-fetch tras selección de compañía
- **Regresión completa: 39/39** (smoke 4 + login 16 + select-company 13 + home-charts 6)

## Diferencias conocidas con Angular

- Cosmético: grid en Tailwind (mismas proporciones responsive ~23%/48%/100%)
- `window.Chart` expuesto globalmente (debug/pruebas)

## Diferido al shell/layout (PagesComponent)

- Logo de compañía y avatar de usuario en el header
- Render visual del menú lateral (los datos `KeyMenu` ya se guardan idénticos)
- `LoadSettings` y user-help post-login
