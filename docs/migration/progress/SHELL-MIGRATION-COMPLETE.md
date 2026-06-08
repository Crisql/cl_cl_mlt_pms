# SHELL / LAYOUT — Migración Completa

**Fecha:** 2026-06-03
**Estado:** ✅ Completo (13/13 pruebas pasando; regresión total 52/52)

## Funcionalidad implementada (100%)

### Sidebar (cl-menu)
- ✅ Árbol del menú desde `KeyMenu` (localStorage base64) con filtro recursivo por `Visible`
- ✅ Íconos Material Icons (campo `Icon` del IMenuItem)
- ✅ Acordeón `OnlyOneOpened`: expandir un nodo colapsa los demás
- ✅ Nodo activo resaltado (Route === ruta actual) y expansión automática del padre
- ✅ Click en nodo con ruta → navega; en la ruta actual → toast `Ya se encuentra en {Description}` (adaptación MPA: sin recarga)
- ✅ `Route: 'Logout'` → logout completo → `/Login`
- ✅ Logo de compañía (base64 con prefijo automático) o default `clavis-white.png`; título de ambiente (`APP_ENV_NAME`)
- ✅ Toggle hamburguesa + overlay móvil

### Header (app-header)
- ✅ **Compañía: {Name}** → abre el modal SelectCompany migrado (con Cancelar al haber compañía previa)
- ✅ **Tipo de cambio Venta** → SOLO visible con `CanCrossCurrencies`; refresh llama `GET /api/Bank/GetExchangeRateFromBccr` → `sessionStorage.ExchangeRateBCCR`
- ✅ **Usuario** (avatar de `GetLoggedUser().ProfilePicture` + email de `CurrentSession.Email`)
- ✅ **Proceso TXT/HTH** con validaciones exactas: "Proceso no habilitado" (aborta) y "Proceso no configurado" (→ `/ConfigProcess`); válido → `sessionStorage.Process` + evento `pms:process-changed`
- ✅ Refresco del header al cambiar compañía (`pms:company-changed`)

### Post-login (app.component)
- ✅ `LoadSettings`: `GET /api/Setting/GetSettingByKey?key=BankAccountsValidFormats` (memoria) y `?key=AutoBatchProcessor` → `sessionStorage.AutoBatchProcessor`

## Pruebas

- Suite: `tests/e2e/shell-complete-suite.spec.js` — **13/13 pasando**
- **Regresión completa: 52/52** (smoke 4 + login 16 + select-company 13 + home-charts 6 + shell 13)

## Adaptaciones MPA documentadas

- Llamadas de arranque (GetLoggedUser/avatar, ExchangeRate, LoadSettings) cacheadas en sessionStorage — una vez por sesión de pestaña (en el SPA corrían una vez por carga de la app)
- Click en nodo activo: toast sin recarga (el SPA "renavegaba" sin recargar)
- `CurrentPageTitle`: via `content_for :page_title` por página

## Diferido (módulos no migrados aún)

- ModalSAPCredentials al click en Usuario (módulo SAPCredentials) — el fallback (toast warning sin usuario) sí está
- cl-user-help-button y cl-notification-center
