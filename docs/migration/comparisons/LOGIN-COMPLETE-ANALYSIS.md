# LOGIN — Análisis Completo (Angular → Rails)

**Fuentes legacy analizadas (100% del código leído):**
- `src/app/pages/login-container/login-container.component.{ts,html,css}` (PMS)
- `@clavisco/login`: `login.component.{ts,html}`, `login.service.ts`, `login.space.ts` (clavisco_components)
- `src/app/app.component.ts` (configuración LOGN + eventos post-login)
- `src/app/core/interceptors/*.ts` (AppInterceptor, RequestInterceptor, InputOutputInterceptor, HttpAlertDecodedInterceptor)
- `@clavisco/core`: `repository.ts` (SetStorage = btoa(JSON)), `storage.service.ts` (CleanStorage = solo config multi-ventana)

## Configuración del componente en PMS (LoginContainerComponent)

| Input | Valor PMS |
|---|---|
| `ApiUrl` | `environment.ApiUrl + 'api/'` → token en **`/api/token`** |
| `DotNetApiType` | `'CORE'` → body JSON `{UserName, Password}` |
| `SesionName` | `'CurrentSession'` → localStorage en **base64(JSON)** |
| `PathToRedirect` | query `redirectURL` \|\| `'/Home'` |
| `UseReCaptcha` | `true` (v3, action `"Login"`, site key del environment) |
| `LogoPath` | `assets/companiesLogo/{environment.LoginLogo}` (clv: `claviscoLogin.png`) |
| `EnforcePasswordPolicy` | `true` (default) — mínimo 8 caracteres |
| `ShouldResolve` | `true` (el componente resuelve navegación y storage por sí mismo) |
| `ngOnInit` (container) | `StorageService.CleanStorage()` — **NO limpia storage**, solo resetea config multi-ventana |

## Estructura de la página

Una sola página con **4 vistas conmutadas** por flags (`isSendRecoverPasswordEmail`, `isChangePassword`, `isRecoverPassword`):

1. **Login** (default)
2. **Enviar correo de recuperación** (`¿Olvidó su contraseña?`)
3. **Cambiar contraseña** (`Cambiar contraseña`)
4. **Recuperar contraseña** (activada por query param `?token=...`)

Todas muestran: logo arriba centrado + copyright `© {añoActual} Clavis Consultores`.

Al conmutar vistas se hace `history.replaceState` a `/#/login`, `/#/recovery`, `/#/change-password` y **todos los formularios se resetean**.
> Diferencia documentada: en Rails se usa `history.replaceState` a `/Login#login`, `/Login#recovery`, `/Login#change-password` (sin hash-routing Angular). Comportamiento funcional idéntico.

## Vista 1: LOGIN

**Campos:**
| Campo | id | Tipo | Validación |
|---|---|---|---|
| Correo electrónico | `loginUser` | text | required |
| Contraseña | `loginPass` | password | required; min 8 (policy) |

- Toggle de visibilidad de contraseña (ícono visibility/visibility_off).
- Botón **"Ingresar"** — NO se deshabilita; al click valida y lanza toasts.
- Links: **"¿Olvidó su contraseña?"** y **"Cambiar contraseña"** separados por `|` (ambos visibles en PMS porque ambas configs existen).

**Validaciones de `Login()` (toasts de error, en este orden):**
1. Form inválido → `Por favor complete el formulario antes de enviarlo`
2. Email inválido (regex IsAValidEmail) → `Correo en formato inválido. Sugerencia: micorreo@ejemplo.com`
3. `password.length < 8` → `La longitud de la contraseña debe tener 8 caracteres`

**Flujo de login:**
1. Overlay ON con mensaje `Iniciando Sesión` (overlaysConfiguration del app.component).
2. reCAPTCHA v3 `execute("Login")` → token.
3. `POST /api/token` — headers `Content-Type: application/json`, `Cl-Recaptcha-Token: {token}`; body `{"UserName": ..., "Password": ...}`.
   (El AppInterceptor EXCLUYE las URLs con `token` → NO lleva Authorization ni cl-company-id.)
4. Overlay OFF (finalize).
5. **Éxito** (`callback.access_token` presente): `Repository.Behavior.SetStorage(callback, 'CurrentSession')` → **guarda el objeto de respuesta COMPLETO** como base64(JSON) → `router.navigate(PathToRedirect)`.
6. **Respuesta sin access_token**: toast error con `GetError(callback)`.
7. **Error HTTP**: toast error con `GetError(error)` (el API responde p.ej. `401 {"Message":"Usuario o contraseña incorrecto","Code":401}`; HttpAlertDecodedInterceptor aplica `decodeURIComponent` al Message).

**Token de respuesta (IToken):** `access_token`, `ExpireTime` (expiración, comparada en UTC), `UserEmail`, `Licence` (encriptada), etc. Se guarda TODO el objeto.

## Vista 2: ENVIAR CORREO DE RECUPERACIÓN

- Campo `userEmail` (required + email).
- Botón **"Enviar correo de recuperación"** — `disabled` si form inválido.
- Link "Iniciar de sesión" → vuelve a login (texto legacy literal: "Iniciar de sesión").
- Overlay `Enviando Correo de Recuperación`.
- **API:** `GET /api/Users/RecoverPassword/{email}` (config `endpointToRequest: 'api/Users/RecoverPassword/#EMAIL#'`, `#EMAIL#` reemplazado).
- Éxito → `ShowAlert({Response})` (modal con Message) y vuelve a vista login. Error → `ShowAlert({HttpErrorResponse})`.

## Vista 3: CAMBIAR CONTRASEÑA

- Campos: `userEmail` (required+email), `currentPassword` (required), `newPassword` (required, min 8), `confirmPassword` (required, igual a newPassword — validador NotEquals marca `notEqual` en confirmPassword).
- Cada password con su toggle de visibilidad independiente.
- Botón **"Cambiar contraseña"** — `disabled` si form inválido.
- Overlay `Cambiando Contraseña`.
- **API:** `PATCH /api/Users/ChangePassword` body `{oldPassword, newPassword, email}`.
  (URL excluida del AppInterceptor → sin Authorization.)
- Éxito → ShowAlert + GoToLogin. Error → ShowAlert.

## Vista 4: RECUPERAR CONTRASEÑA (desde email)

- Activación: `ReadURLParameters()` — si query param `token` existe → muestra esta vista (`/#/recovery`).
- Campos: `newPassword` (required, min 8), `confirmPassword` (required, notEqual).
- Botón **"Cambiar contraseña"** — `disabled` si inválido.
- Overlay `Actualizando Contraseña`.
- **API:** `PATCH /api/Users/ChangeRecoverPassword` body `{password}` header `Authorization: Bearer {token-del-query-param}`.
  (URL excluida del AppInterceptor → usa SOLO el token temporal.)
- Éxito → ShowAlert + GoToLogin. Error → ShowAlert.

## Validadores custom (login.space.ts)

- `NotEquals(c1, c2)`: si valores difieren → error `notEqual` en c1. Mensaje: `Las contraseñas no coinciden`.
- `PasswordMinLength(c)`: `< 8` → error `passwordMinLength`. Mensaje: `La contraseña debe tener un mínimo de 8 caracteres`.

## Comportamiento post-login global (app.component — pertenece al shell)

Cuando `POST */token` responde con `access_token` (InputOutputInterceptor → `NotifyUserLoginCompleted`):
1. `GlobalService.LoadSettings()`: settings `BankAccountsValidFormats` y `AutoBatchProcessor` (→ `sessionStorage AutoBatchProcessor`).
2. Config de links de documentación user-help (`GET api/UserHelp`).

> **Dependencia diferida:** estos efectos se migran con el módulo shell/layout (PagesComponent), NO con Login. Documentado aquí para no perderlo.

## Config global de alerts (PMS)

Toasts: duración 10000ms, posición top center (`SetTokenConfiguration ALERTS`).

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Vista login (campos, validaciones, toasts exactos) | ✅ | 100% | |
| POST /api/token CORE + Cl-Recaptcha-Token | ✅ | 100% | |
| Guardar CurrentSession base64 + redirect redirectURL\|\|/Home | ✅ | 100% | |
| reCAPTCHA v3 action Login | ✅ | 100% | badge visible (UseReCaptcha=true) |
| Toggle visibilidad contraseña | ✅ | 100% | |
| Vista enviar correo recuperación + GET RecoverPassword/{email} | ✅ | 100% | |
| Vista cambiar contraseña + PATCH ChangePassword | ✅ | 100% | |
| Vista recuperar por token + PATCH ChangeRecoverPassword | ✅ | 100% | |
| replaceState entre vistas + reset de formularios | ✅ | 100% | hash adaptado (diferencia documentada) |
| Copyright año actual | ✅ | 100% | |
| Logo por cliente (ENV LOGIN_LOGO) | ✅ | 100% | |
| Efectos post-login del shell (LoadSettings, user-help) | ⏳ | 0% | Diferido al módulo shell/layout |
