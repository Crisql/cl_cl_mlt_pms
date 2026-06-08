# SHELL / LAYOUT (PagesComponent + cl-menu + HeaderComponent) — Análisis Completo

**Fuentes legacy analizadas (100% del código leído):**
- `src/app/pages/pages.component.{ts,html,css}` (shell con router-outlet)
- `@clavisco/menu`: `menu.component.{ts,html}` (clavisco_components)
- `src/app/theme/components/header/header.component.{ts,html}`
- `src/app/app.component.ts` (efectos post-login: LoadSettings + user-help)
- `src/app/core/services/{bank,setting,global,menu}.service.ts`
- `src/app/core/intefaces/IMenuNode.ts` (IMenuItem)

## PagesComponent (shell)

- Envuelve TODAS las rutas autenticadas (`router-outlet` dentro de `cl-menu`).
- `ngOnInit`: lee **`KeyMenu`** (localStorage base64) → `SetOptionMenu(nodes)` → infla el cl-menu.
- Toolbar: botón hamburguesa (`ToggleMenu`), `CurrentPageTitle` (observable — cada página lo setea), `<app-header>`.
- `ClickMenuOption`: si `node.Route === 'Logout'` → `Logout()` + `/Login`.
- Logo del menú: `SelectedCompany.Logo` (base64, prefija `data:image/png;base64,` si falta) o default `clavis-white.png`. Se refresca al cambiar compañía (observable `company`).
- `Title` del menú: `environment.env` (clv: `"Producción ambiente clavisco"`).

## cl-menu (sidebar)

- Árbol anidado de `IMenuItem {Key, Description, Route, Icon, Visible, Nodes, Permission}`.
- **`FilterVisibleNode`**: filtra recursivamente por `Visible`.
- Click en nodo (`ExecuteAction`):
  - Con hijos + `OnlyOneOpened` (default): colapsa todo y expande ese nodo (acordeón).
  - Con `Route`: si la ruta actual ES la misma → toast INFO `Ya se encuentra en {Description}`; navega a la ruta.
  - Emite OUTPUT → PagesComponent procesa Logout.
- Nodo activo: `Route === router.url` (highlight); al navegar expande automáticamente el padre del nodo activo.
- Responsive: `< 800px` → modo overlay y cerrado; si no, lateral fijo abierto.
- Header del sidebar: Logo + Title + User.

## HeaderComponent (toolbar derecha)

| Elemento | Comportamiento | API |
|---|---|---|
| **Compañía: {Name}** | click → abre modal SelectCompany (el ya migrado) | — |
| **Tipo de cambio Venta: {n}** | SOLO visible si `company.CanCrossCurrencies`; click → refresca | `GET /api/Bank/GetExchangeRateFromBccr` → `sessionStorage.ExchangeRateBCCR` |
| **Usuario: {email}** (avatar) | email de `CurrentSession.Email`; avatar de `GetLoggedUser().ProfilePicture`; click → ModalSAPCredentials (módulo NO migrado — diferido) | `GET /api/Users/GetLoggedUser` |
| **Proceso: {p}** | dropdown TXT/HTH → `SelectProcess(p)` | — |
| user-help + notification-center | módulos diferidos | — |

**`SelectProcess(p)` (validaciones exactas):**
1. `company.Process != 'A'` y `p != company.ProcessName` → modal INFO **"Proceso no habilitado"** / `La compañía no cuenta con el proceso seleccionado.` → ABORTA.
2. Config inválida (TXT sin ConfigTXT JSON válido / HTH sin ListConfHTH) → modal INFO **"Proceso no configurado"** / `El proceso seleccionado para esta compañía no ha sido configurado.` → al continuar `/ConfigProcess` (y CONTINÚA con los pasos 3-4 — el legacy no retorna aquí).
3. `selectedProcess = p`; `sessionStorage.Process = p`.
4. `onProcessChange.next()` (observable global).

**Carga inicial del header:** company/process de storage; `ExchangeRateBCCR` de sessionStorage; `LoadProfile()` → GetLoggedUser → avatar + `GetExchangeRateFromBCCR()`.

## Efectos post-login (app.component → migrados aquí)

Al existir sesión (`CurrentSession.access_token`):
1. **`LoadSettings()`**: `GET /api/Setting/GetSettingByKey?key=BankAccountsValidFormats` (en memoria) y `GET ...?key=AutoBatchProcessor` → `sessionStorage.AutoBatchProcessor` (JSON del Data.Json parseado). Errores ignorados (catchError → null).
2. Config user-help (`GET /api/UserHelp?...`) → **diferido** (componente cl-user-help no migrado).

## Contrato API del shell

| Método | Endpoint | Cuándo |
|---|---|---|
| GET | `/api/Users/GetLoggedUser` | carga del header (avatar) |
| GET | `/api/Bank/GetExchangeRateFromBccr` | si CanCrossCurrencies (auto + botón refresh) |
| GET | `/api/Setting/GetSettingByKey?key=BankAccountsValidFormats` | post-login |
| GET | `/api/Setting/GetSettingByKey?key=AutoBatchProcessor` | post-login → sessionStorage |

## Adaptaciones MPA/Turbo (documentadas)

- El Angular es SPA: app.component/header corren UNA vez por carga. En Rails cada visita recarga el layout → las llamadas de arranque (GetLoggedUser, ExchangeRate, LoadSettings) se cachean en sessionStorage (`UserAvatar`, `ExchangeRateBCCR`, `AutoBatchProcessor`) y solo se ejecutan si no existen — semánticamente equivalente a "una vez por sesión de pestaña". El botón de refresh del tipo de cambio SIEMPRE llama al API (como el legacy).
- `CurrentPageTitle`: cada página lo declara (content_for :page_title), equivalente al observable.

## Matriz de funcionalidad

| Funcionalidad | Implementado | % | Notas |
|---|---|---|---|
| Sidebar con árbol de KeyMenu (Visible, acordeón, activo, íconos) | ✅ | 100% | |
| Toast "Ya se encuentra en X" | ✅ | 100% | |
| Logout desde el menú | ✅ | 100% | |
| Logo compañía (base64/default) + Title env + User | ✅ | 100% | |
| Toggle hamburguesa + responsive < 800px | ✅ | 100% | |
| Header: Compañía → modal SelectCompany | ✅ | 100% | reusa el migrado |
| Header: Tipo de cambio (CanCrossCurrencies + refresh + storage) | ✅ | 100% | |
| Header: Usuario (email + avatar GetLoggedUser) | ✅ | 100% | |
| Header: Proceso TXT/HTH con validaciones exactas | ✅ | 100% | |
| Post-login LoadSettings → AutoBatchProcessor | ✅ | 100% | |
| ModalSAPCredentials al click en usuario | ⏳ | 0% | módulo SAPCredentials no migrado (toast de fallback sí) |
| user-help / notification-center | ⏳ | 0% | módulos diferidos |
