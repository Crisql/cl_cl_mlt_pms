# SELECTCOMPANY — Migración Completa

**Fecha:** 2026-06-03
**Estado:** ✅ Completo (13/13 pruebas pasando)

## Funcionalidad implementada (100%)

- ✅ Modal sobre Home con `disableClose` (sin X, no cierra con ESC/click fuera), abierto automáticamente cuando hay sesión sin compañía (réplica de `Home.OpenDialog`)
- ✅ Ruta `/SelectCompany` (página legacy) abre el modal directamente
- ✅ Carga de compañías: cache `ListCompanies` (base64) o `GET /api/Company/GetCompaniesByUser`; overlay "Obteniendo compañias asignadas"
- ✅ `ProcessName` mapeado (H→HTH, T→TXT, default Todos) y persistido en cache
- ✅ Select "Seleccione un proceso" desde `assets/data/typesCompanyProcess.json` (filtra opción 'A')
- ✅ Toast WARNING cuando no hay compañías asignadas
- ✅ Búsqueda local sobre `Name + DatabaseCode` (debounce 350ms + botón)
- ✅ Tabla con columnas del legacy + botón flecha por fila; paginación local 5/10/15 (default 5) con info "X - Y de Z"
- ✅ Validaciones de selección (3 modales INFO con textos exactos): "Proceso requerido", "Proceso no habilitado", select vacío toma el proceso de la compañía
- ✅ Efectos de storage en orden exacto: borra `SelectedCompany`/`RoleAccess`/`KeyMenu` → guarda `Process` → guarda compañía → permisos
- ✅ `GET /api/UsersByCompany/GetPermissionsRoles` (con `cl-company-id` nuevo) → `RoleAccess` base64 `{Roles, Access[]}`
- ✅ `GET /api/Users/GetLoggedUser` → enriquece `SelectedCompany` (MainCurrency, TaxIdNum, ListConfHTH)
- ✅ `CurrentSession.Licence` = AES-CBC(SapUser) — implementado con WebCrypto, compatible byte a byte con crypto-js del legacy (key/iv fijos, PKCS7, Base64)
- ✅ `ValidateProcessConfigured` → modal "Proceso no configurado" → navega `/ConfigProcess`
- ✅ 401 en GetLoggedUser → menú restringido (keys home/settings + logout) → `/Home`
- ✅ `GET /api/Menu` al cerrar → `KeyMenu` base64 con `LogoutMenuOption` agregada
- ✅ Toast SUCCESS con texto y espaciado literal del legacy (se muestra inmediato, sin esperar el async)
- ✅ Footer: "Cancelar" solo si había compañía previa; "Cerrar Sesión" → logout completo → `/Login`

## Pruebas

- Suite: `tests/e2e/select-company-complete-suite.spec.js` — **13/13 pasando**
- Cobertura: estructura del modal, paginación, mapeo ProcessName, búsqueda, cache ListCompanies (verifica que NO re-llama al API), toast sin compañías, 2 validaciones de proceso, selección completa (storage + headers cl-company-id verificados), proceso no configurado → /ConfigProcess, 401 → menú restringido, Cancelar condicional, logout

## Diferencias conocidas con Angular

- **Cosmético**: tabla propia en Tailwind en lugar de `cl-table` Material; `SetTableScrollHeight` (cálculo px) no replicado
- **Mejora deliberada (documentada)**: ante error de red en `GetPermissionsRoles` el legacy deja el overlay bloqueando para siempre (subscribe sin error handler); aquí se cierra el overlay y se loguea el error
- **Pendiente de verificación**: el handler del evento `Dropdown` de cl-table ("No cuenta con este proceso habilitado, contactar a clavisco.") parece código muerto — la tabla legacy no define columnas dropdown en su configuración. NO replicado; confirmar con el equipo
- **Diferido al shell**: push al notification center, avatar de usuario y render visual del menú (los DATOS — KeyMenu, RoleAccess — sí se guardan idénticos)

## Limitaciones

- `/ConfigProcess` aún no migrado → la navegación tras "Proceso no configurado" llega a 404 hasta que se migre ese módulo
