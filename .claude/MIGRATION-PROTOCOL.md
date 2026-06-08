# PROTOCOLO DE MIGRACIÓN — PMS (Consolidador de Pagos)

## CONTEXTO DE PROYECTOS

| Rol | Proyecto | Ruta |
|-----|----------|------|
| **Origen (legacy)** | Angular 14 `acordoba_cl_cl_mlt_pms` | `..\acordoba_cl_cl_mlt_pms` |
| **Destino (este repo)** | Rails `cl_cl_mlt_pms` | `.` (github.com/AngieCordoba/cl_cl_mlt_pms) |
| **Referencia de patrones** | Rails `ema-ui-migration_jramirez` | `..\ema-ui-migration_jramirez` |

- El proyecto EMA es la **referencia obligatoria** de estructura, stack y patrones (proxy, helpers, Stimulus, pruebas). Ante cualquier duda de "¿cómo se hace X en Rails?", ver primero cómo lo hizo EMA.
- El Angular legacy es la **fuente de verdad de funcionalidad**. NUNCA se modifica.

## PRINCIPIO RECTOR (INNEGOCIABLE)

> **La funcionalidad debe ser EXACTAMENTE la misma que en Angular.**
> El diseño visual puede cambiar (Tailwind en vez de Material), pero:
> - Lo que se **envía** al API (endpoint, método HTTP, query params, payload, headers) debe ser **idéntico**.
> - Lo que se **recibe** del API debe procesarse con la **misma lógica** (mismos campos leídos, mismas validaciones, mismos cálculos, mismos flujos).
> - Cada botón, campo, validación, default, mensaje y flujo de usuario del Angular debe existir y comportarse igual en Rails.

## ARQUITECTURA OBJETIVO (PATRÓN EMA)

Rails es **SOLO UI**. No hay modelos de negocio ni base de datos propia. El backend sigue siendo el API .NET existente.

```
Browser (Stimulus JS) ──fetch("/api/...")──► Rails ProxyController ──► API .NET (clpmsapi)
                       ◄────── respuesta JSON "as-is" ───────────────┘
```

### Stack
- Rails 8.x + importmap-rails (sin Webpack/esbuild)
- Hotwire: Turbo + Stimulus
- Tailwind CSS v4 (`tailwindcss-rails`)
- Playwright para E2E, Vitest para unit tests de JS

### Piezas base (copiar/adaptar de EMA)
| Pieza | Origen en EMA | Propósito |
|-------|---------------|-----------|
| `app/controllers/api/proxy_controller.rb` | copiar casi exacto | Proxy transparente a `LEGACY_API_URL`, reenvía TODOS los headers |
| `config/routes.rb` → `namespace :api { match "*path", to: "proxy#forward", via: :all }` | copiar | Routing del proxy |
| `app/javascript/lib/api_helpers.js` | copiar/adaptar | `getAPIHeaders()`, `getSession()` |
| `app/javascript/lib/auth.js`, `lib/guards.js` | copiar/adaptar | Token, expiración, permisos, guards de navegación |
| `app/javascript/vendor/clavisco/*` | reusar lo ya porteado | Ports JS de `@clavisco/*` (login, alerts, table, search-modal, etc.) |
| `.env.example` con `LEGACY_API_URL` | copiar/adaptar | Configuración por ambiente |

### Autenticación (igual que Angular/EMA)
- Login: POST `/api/token` con `grant_type=password&username=...&password=...`
- Token guardado en `localStorage` (clave `CurrentSession`, igual que Angular PMS — verificar el nombre exacto en el legacy antes de implementar)
- Cada request lleva: `Authorization: Bearer {token}`, `cl-company-id`, y los headers `cl-*` que agregan los interceptores Angular (`AppInterceptor`, `RequestInterceptor`, `PagedRequestInterceptor`)
- **Verificar en el Angular las rutas excluidas de interceptores**: `assets`, `Reports`, `Parameters`, `token`, `ChangeRecoverPassword`, `RecoverPassword`, `ChangePassword` — replicar el mismo comportamiento

## MULTI-CLIENTE

El Angular soporta 16+ clientes vía `src/environments/environment.{cliente}.ts` (cada uno con `ApiUrl`, `LoginLogo`, ReCaptcha key, LogRocket).

**En Rails: un deploy por cliente, configurado por ENV** (mismo código, distinta config):
- `LEGACY_API_URL` → API del cliente
- Variables para logo/recaptcha cuando aplique

**Alcance actual: SOLO clv (Clavisco)**
- `LEGACY_API_URL=https://clpmsapi.clavisco.com`
- Fuente de verdad de la config clv: `src/environments/environment.ts` del Angular
- NO implementar ni probar otros clientes todavía, pero NUNCA hardcodear valores propios de clv dentro del código (siempre vía ENV/config), para que agregar un cliente sea solo agregar configuración.

## MÓDULOS DEL PMS (Angular `src/app/pages/`)

SelectCompany · SelectDocuments · SearchPurchaseOrders · Draft-Payment · Lots · Report-Manager · ConfigCtaBanks · ConfigCompany · ConfigPerms · ConfigProcess · BankFormats · SAPCredentials · BankStatement · ExternalReconciliation · Dashboard · wizard-setup · user-help

(+ login y flujo de selección de compañía obligatorio post-login)

---

## ACTIVACIÓN DEL PROTOCOLO

Cuando el usuario diga: **"migrate [URL o módulo]"** (sin slash), ejecutar automáticamente el proceso completo de 6 fases.

**Ejemplos:**
- "migrate http://localhost:3000/lots"
- "migrate draft-payment"
- "migra select-company"

## PROCESO COMPLETO (EJECUTAR AUTOMÁTICAMENTE)

### FASE 0: IDENTIFICAR MÓDULO

1. De la URL o nombre, identificar el módulo Angular en `..\acordoba_cl_cl_mlt_pms\src\app\pages\[modulo]\`
2. Localizar/definir los archivos Rails correspondientes:
   ```
   Controlador Rails: app/controllers/[modulo]_controller.rb
   Vista:             app/views/[modulo]/index.html.erb
   Stimulus:          app/javascript/controllers/[modulo]_controller.js
   ```
3. **Si hay ambigüedad → PREGUNTAR.** No asumir qué módulo es.

### FASE 1: ANÁLISIS EXHAUSTIVO DE LEGACY

1. **Leer TODO el código Angular del módulo**
   - Componente `.ts`, `.html`, `.scss`
   - Servicios usados (`src/app/core/services/`)
   - Interfaces (`src/app/core/intefaces/`)
   - Modales/dialogs que abre
   - Componentes vendor `@clavisco/*` usados y su configuración
   - Interceptores que afectan sus requests

2. **Documentar TODA la funcionalidad**
   - Crear: `docs/migration/comparisons/[MODULE]-COMPLETE-ANALYSIS.md`
   - Incluir:
     - Estructura de la página (tabs, secciones, modales)
     - Lista COMPLETA de campos (tipo, validaciones, defaults)
     - Lista de TODOS los botones (qué hacen, cuándo están habilitados)
     - Todos los event listeners (onChange, onBlur, onClick, onKeydown, etc.)
     - **CONTRATO API**: TODAS las llamadas con método, endpoint, query params, payload completo y headers (incluyendo los que agregan los interceptores)
     - Lógica de negocio (change detection, validaciones, cálculos)
     - Flujos de usuario completos (crear, actualizar, buscar, eliminar)
     - Edge cases y manejo de errores
   - Crear matriz de funcionalidad:
     | Funcionalidad | Implementado en Rails | % Completo | Notas |

### FASE 2: GENERACIÓN DE PRUEBAS E2E

1. **Crear suite completa**: `tests/e2e/[module]-complete-suite.spec.js`
2. **Incluir pruebas para:**
   - Carga inicial (página carga, campos con valores correctos, botones correctos)
   - Cada campo individual (llenar, validar, onChange)
   - Cada botón (click, resultado, estado deshabilitado cuando corresponde)
   - Cada flujo completo (crear, buscar, actualizar, tabs, modales)
   - **Verificación del contrato API**: que los requests salgan con el endpoint, método, params, payload y headers exactos del Angular
   - Edge cases (campos vacíos, API errors, cambios sin guardar)
3. Las pruebas corren contra `http://localhost:3000` (proxy → API real de clv), igual que en EMA.

### FASE 3: IMPLEMENTACIÓN EN RAILS

1. **Verificar implementación actual** (controlador Stimulus, vista ERB, gaps)
2. **Implementar funcionalidad faltante** (en orden):
   - Estructura básica (ERB con TODOS los campos y botones, `data-controller` wired)
   - Lógica de negocio en Stimulus (métodos, validaciones, change detection)
   - Componentes vendor (port de `vendor/clavisco` — reusar los de EMA si ya existen)
   - Llamadas API vía `/api/...` con `getAPIHeaders()` (headers y parámetros EXACTOS)
   - Event handlers (onChange, onBlur, onClick, onKeydown, etc.)
3. **Reglas de implementación:**
   - El controlador Rails SOLO renderiza la vista. Toda la lógica vive en Stimulus.
   - NUNCA llamar al API .NET desde Ruby (excepto el ProxyController).
   - Reusar `lib/` y `vendor/clavisco/` — no duplicar helpers por módulo.
4. **Commit con mensaje descriptivo** al terminar.

### FASE 4: VALIDACIÓN CON PRUEBAS

```bash
npx playwright test [module]-complete-suite.spec.js --project=chromium
```
- Si TODAS pasan → FASE 6
- Si ALGUNA falla → FASE 5

### FASE 5: CORRECCIÓN Y RE-VALIDACIÓN (LOOP)

1. Analizar cada fallo (error, screenshot, trace → causa raíz)
2. **Comparar con Angular legacy** — NO ASUMIR, leer el código
3. Corregir y documentar qué se corrigió
4. Re-ejecutar pruebas. Repetir hasta que TODO pase.

### FASE 6: DOCUMENTACIÓN FINAL

1. Crear `docs/migration/progress/[MODULE]-MIGRATION-COMPLETE.md` con:
   - ✅ Funcionalidad implementada (100%)
   - ✅ Pruebas creadas y pasando
   - 📋 Diferencias conocidas con Angular (si las hay — solo visuales/diseño)
   - 📋 Limitaciones (si las hay)
2. Reportar al usuario con el resumen (funcionalidad, pruebas, rutas de docs).

---

## REGLAS OBLIGATORIAS

1. **NUNCA asumir funcionalidad** → Siempre verificar en el Angular legacy PRIMERO
2. **NUNCA cambiar el contrato API** → endpoint, método, params, payload y headers idénticos a Angular
3. **NUNCA saltarse pruebas** → Son obligatorias en TODA migración
4. **NUNCA decir "está listo" sin pruebas pasando al 100%**
5. **SIEMPRE leer TODO el código Angular del módulo** → No solo lo relevante
6. **SIEMPRE documentar cada fase**
7. **NUNCA inventar funcionalidad** → Solo replicar lo que existe
8. **SIEMPRE preguntar si hay ambigüedad** → No asumir
9. **NUNCA modificar el proyecto Angular ni el proyecto EMA** → Son solo lectura/referencia
10. **NUNCA hardcodear config de cliente (clv) en código** → Siempre vía ENV
11. **SIEMPRE seguir el patrón EMA** ante dudas de estructura/implementación en Rails
12. **Tener buenas prácticas** (código limpio, commits descriptivos, sin duplicación)

## CHECKLIST ANTES DE REPORTAR "COMPLETO"

- [ ] Leí COMPLETO el código Angular del módulo (componente + servicios + interfaces + interceptores)
- [ ] Documenté TODA la funcionalidad y el contrato API en COMPLETE-ANALYSIS
- [ ] Creé suite de pruebas que cubre TODA la funcionalidad
- [ ] Implementé TODA la funcionalidad en Rails (patrón EMA)
- [ ] Los requests salen IDÉNTICOS a los del Angular (verificado, no asumido)
- [ ] Ejecuté pruebas y TODAS pasan (100%)
- [ ] Documenté la migración en MIGRATION-COMPLETE
- [ ] Revisé que NO haya funcionalidad inventada ni config de cliente hardcodeada

## SETUP INICIAL DEL REPO (UNA SOLA VEZ, ANTES DEL PRIMER "migrate")

El repo está vacío. Antes del primer módulo:

1. Generar app Rails 8 con importmap + Stimulus + Turbo + Tailwind (espejo de EMA)
2. Copiar/adaptar de EMA: `ProxyController`, routing `/api/*`, `lib/api_helpers.js`, `lib/auth.js`, `lib/guards.js`, `.env.example`, `playwright.config.js`, estructura `tests/e2e/`
3. Configurar `.env` para clv: `LEGACY_API_URL=https://clpmsapi.clavisco.com`
4. Portar/copiar los `vendor/clavisco` que el PMS necesite (login, alerts, table, menu, overlay, search-modal…) — partir de los ya porteados en EMA
5. Implementar login + selección de compañía (flujo obligatorio post-login del PMS)
6. Crear estructura `docs/migration/{comparisons,progress}/`
7. Verificar que `bin/dev` levanta y que el proxy responde contra el API de clv
