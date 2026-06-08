# SELECTCOMPANY — Análisis Completo (Angular → Rails)

**Fuentes legacy analizadas (100% del código leído):**
- `src/app/pages/select-company/select-company.component.{ts,html,css}`
- `src/app/core/services/company.service.ts`, `user.service.ts`, `user-company.service.ts`, `menu.service.ts`, `app.service.ts`, `cryptography.service.ts`
- `src/app/core/intefaces/constants.ts` (LogoutMenuOption)
- `src/assets/data/typesCompanyProcess.json`
- `src/app/pages/home/home.component.ts` (apertura del modal)

## Contexto de apertura

- **Modal** abierto desde Home (`dialog.open(SelectCompanyComponent, {disableClose: true, width 70%, height 80%})`) cuando hay sesión y NO hay compañía seleccionada.
- También existe la ruta `/SelectCompany` (página) en el routing.
- `disableClose: true` → no se cierra con ESC/click fuera.
- Si YA había compañía seleccionada (`hasSelectedCompany`), el footer muestra botón **"Cancelar"**; si no, solo **"Cerrar Sesión"**.

## Estructura del modal

1. **Header**: título `Selección de compañía`.
2. **Barra**: select **"Seleccione un proceso"** (opciones de `typesCompanyProcess.json` SIN la opción 'A': `H→HTH`, `T→TXT`) + búsqueda **"Criterio de búsqueda"** (placeholder "Buscar compañía", debounce 350ms, botón buscar).
3. **Tabla** (`cl-table`, id `CompanyTable`):
   - Columnas: `Name`→**Nombre de la compañía**, `DatabaseCode`→**Base de datos**, `ProcessName`→**Procesos configurados** (todas las demás propiedades ignoradas).
   - Botón por fila: flecha (`arrow_forward`, acción CONTINUE) → `SelectCompany(row)`.
   - Paginación LOCAL (`ShouldPaginateRequest: false`): tamaños `[5, 10, 15]`, default **5**.
4. **Footer**: `Cancelar` (condicional) + `Cerrar Sesión`.

## Carga inicial (`LoadInitialData`)

1. `CompaniesList` desde storage `ListCompanies` (localStorage **base64**); si vacío → `GET /api/Company/GetCompaniesByUser`.
2. Overlay: `Obteniendo compañias asignadas` (texto literal con typo del legacy).
3. `GET assets/data/typesCompanyProcess.json` → filtra `id != 'A'` → processTypes (HTH, TXT). (Asset local — excluido de interceptores.)
4. Si no hay compañías → toast WARNING `No cuenta con compañías asignadas, contacte al administrador`.
5. Map `ProcessName`: `'H'→'HTH'`, `'T'→'TXT'`, default `'Todos'`.
6. Guarda `ListCompanies` (base64) con las compañías mapeadas.

## Búsqueda (`OnSearchCompany` / `FilterCompanies`)

Filtro local case-insensitive sobre **`Name + DatabaseCode` concatenados** `.includes(criterio)`. Se dispara por botón Y por cambio de valor (debounce 350ms).

## Selección (`SelectCompany(company)`)

Validaciones (modales tipo INFO con botón continuar):
1. `company.Process === 'A'` y select vacío → **"Proceso requerido"** / `Primero debe seleccionar un proceso.` → ABORTA.
2. Select vacío (y Process ≠ 'A') → select toma `company.Process`.
3. `company.Process !== 'A'` y select ≠ `company.Process` → **"Proceso no habilitado"** / `La compañía no cuenta con el proceso seleccionado.` → ABORTA.

Efectos (en este orden):
1. `selectProcess` = nombre del proceso del select (`HTH`/`TXT`).
2. `sessionStorage.removeItem('SelectedCompany')`; borra `RoleAccess` y `KeyMenu` (localStorage).
3. `sessionStorage.Process = selectProcess` (JSON del string, p.ej. `"HTH"`).
4. `AssignPermissionsByCompany(company)` (async, ver abajo).
5. Toast SUCCESS: `Se encuentra trabajando con la compañía {Name}  y el proceso {selectProcess} ` (espaciado literal del legacy) — se muestra INMEDIATAMENTE (no espera el async).
6. Push a notification center (título compañía, mensaje `Proceso Seleccionado: {selectProcess}`) — shell, diferido.

## `AssignPermissionsByCompany(company)`

1. Overlay ON; `sessionStorage.SelectedCompany = company` (JSON) — **a partir de aquí los requests llevan `cl-company-id`**.
2. `GET /api/UsersByCompany/GetPermissionsRoles` → `{Data: {Permissions[], Roles[]}}` → guarda **`RoleAccess`** (base64) como `{Roles, Access: [nombres de permisos]}`.
3. `GET /api/Users/GetLoggedUser` → `IConfCompanyUserLogged`:
   - `MainCurrency`/`TaxIdNum` → actualizan `SelectedCompany` (sessionStorage re-escrito).
   - `ListConfHTH` → actualiza `SelectedCompany.ListConfHTH`.
   - `ProfilePicture` → avatar global (shell, diferido).
   - `SapUser` → **`UpdateSessionLicence`**: re-escribe `CurrentSession.Licence` = AES-CBC(SapUser) (crypto-js, key `C1Av!sC0)!$02021`, iv `$$C1Av!sC0)!$100`, PKCS7, salida Base64). Si SapUser vacío → `''`.
   - `ValidateProcessConfigured()`: si proceso TXT sin `ConfigTXT` JSON válido no vacío, o HTH sin `ListConfHTH` → modal INFO **"Proceso no configurado"** / `El proceso seleccionado para esta compañía no ha sido configurado.` → al continuar navega **`/ConfigProcess`**.
   - Overlay OFF; `CloseThisModal(false)`.
4. **Error 401 en GetLoggedUser**: menú restringido (`GET /api/Menu` filtrado a keys `home`,`settings` + opción logout) → `KeyMenu`; cierra modal; navega `/Home`.
5. **Otro error**: guarda SelectedCompany igual; cierra modal.

## `CloseThisModal(pCanceledAction)`

- Si hay compañía seleccionada: `GetMenu()` → `GET /api/Menu` → agrega `LogoutMenuOption` (`{Key:'logout', Description:'Cerrar Sesión', Route:'Logout', Icon:'logout'}`) si falta → guarda **`KeyMenu`** (base64) → menú del shell.
- `dialogRef.close(!pCanceledAction)`.

## Logout (botón del footer)

`AuthenticationService.Logout()` (limpia todo el storage de sesión) → `/Login` → cierra modal.

## Contrato API (resumen)

| # | Método | Endpoint | Headers clave | Cuándo |
|---|---|---|---|---|
| 1 | GET | `/api/Company/GetCompaniesByUser` | Bearer, SIN cl-company-id | carga inicial (si no hay cache ListCompanies) |
| 2 | GET | `assets/data/typesCompanyProcess.json` | ninguno (asset local) | carga inicial |
| 3 | GET | `/api/UsersByCompany/GetPermissionsRoles` | Bearer + cl-company-id (nueva) | tras seleccionar |
| 4 | GET | `/api/Users/GetLoggedUser` | Bearer + cl-company-id | tras permisos |
| 5 | GET | `/api/Menu` | Bearer + cl-company-id | al cerrar el modal |

## Storage (efectos)

| Clave | Dónde | Formato | Contenido |
|---|---|---|---|
| `ListCompanies` | localStorage | base64(JSON) | compañías con ProcessName |
| `SelectedCompany` | sessionStorage | JSON | compañía + MainCurrency/TaxIdNum/ListConfHTH del logged user |
| `Process` | sessionStorage | JSON string | `"HTH"` / `"TXT"` |
| `RoleAccess` | localStorage | base64(JSON) | `{Roles, Access[]}` |
| `KeyMenu` | localStorage | base64(JSON) | menú + logout |
| `CurrentSession.Licence` | localStorage | dentro del token base64 | AES(SapUser) |

## Notas / diferencias documentadas

- Evento `Dropdown` de cl-table (`GetSelectedRecords`): el config de la tabla NO define columnas dropdown, por lo que este handler parece código muerto heredado ("Proceso no habilitado / No cuenta con este proceso habilitado, contactar a clavisco."). NO se replica hasta verificar que cl-table genere dropdowns. **Pendiente de verificación con el equipo.**
- `SetTableScrollHeight` (cálculo px del alto de tabla): detalle de presentación Material — no se replica (diseño puede cambiar).
- Avatar de usuario, notification center y render visual del menú → módulo shell (diferidos); los DATOS (KeyMenu, RoleAccess) sí se guardan idénticos.

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Modal sobre Home (disableClose, Cancelar condicional) | ✅ | 100% | |
| Carga compañías (cache ListCompanies o API) + ProcessName | ✅ | 100% | |
| Select de proceso (HTH/TXT, sin 'A') desde JSON local | ✅ | 100% | |
| Búsqueda local Name+DatabaseCode (debounce 350ms + botón) | ✅ | 100% | |
| Tabla 3 columnas + botón flecha + paginación local 5/10/15 | ✅ | 100% | tabla propia (cl-table visual no replicado) |
| Validaciones de proceso (3 modales exactos) | ✅ | 100% | |
| Efectos de selección (storage + orden exacto) | ✅ | 100% | |
| GetPermissionsRoles → RoleAccess | ✅ | 100% | |
| GetLoggedUser → SelectedCompany enriquecida + Licence AES | ✅ | 100% | WebCrypto AES-CBC compatible crypto-js |
| ValidateProcessConfigured → /ConfigProcess | ✅ | 100% | |
| Manejo 401 → menú restringido | ✅ | 100% | |
| GetMenu → KeyMenu + logout option | ✅ | 100% | |
| Toast éxito + texto exacto | ✅ | 100% | |
| Logout desde footer | ✅ | 100% | |
| Notification center push / avatar / render menú | ⏳ | 0% | Diferido al shell |
