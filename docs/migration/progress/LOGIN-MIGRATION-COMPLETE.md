# LOGIN — Migración Completa

**Fecha:** 2026-06-03
**Estado:** ✅ Completo (16/16 pruebas pasando, 1 skipped por falta de credenciales de prueba)

## Funcionalidad implementada (100%)

- ✅ Vista login: campos `loginUser`/`loginPass`, botón "Ingresar", validaciones con toasts EXACTOS del legacy (form vacío / email inválido / contraseña < 8)
- ✅ POST `/api/token` (CORE): body JSON `{UserName, Password}`, headers `Content-Type: application/json` + `Cl-Recaptcha-Token`, SIN Authorization
- ✅ reCAPTCHA v3 action "Login" (site key por ENV)
- ✅ Sesión: respuesta COMPLETA del token guardada como base64(JSON) en `localStorage.CurrentSession` → redirect a `redirectURL || /Home`
- ✅ Error de login: toast con `GetError` (Message del API decodificado con decodeURIComponent)
- ✅ Toggle de visibilidad de contraseña (todas las vistas)
- ✅ Vista "¿Olvidó su contraseña?": GET `/api/Users/RecoverPassword/{email}`, botón deshabilitado hasta email válido, ShowAlert + vuelta a login
- ✅ Vista "Cambiar contraseña": PATCH `/api/Users/ChangePassword` `{oldPassword, newPassword, email}`, validador notEqual ("Las contraseñas no coinciden"), min 8
- ✅ Vista "Recuperar contraseña" (activada por `?token=`): PATCH `/api/Users/ChangeRecoverPassword` `{password}` con `Authorization: Bearer {token-temporal}`
- ✅ `history.replaceState` entre vistas + reset de todos los formularios
- ✅ Copyright `© {año} Clavis Consultores`, logo por cliente (ENV `LOGIN_LOGO`)
- ✅ Toasts con config global del PMS (10000ms, top center)

## Pruebas

- Suite: `tests/e2e/login-complete-suite.spec.js` — **17 pruebas (16 pasando, 1 skipped)**
- Cobertura: carga inicial, validaciones, toggle, contrato API exacto de los 4 endpoints (body/headers/método verificados con mocks), redirectURL, manejo de errores, navegación entre vistas, API real clv (credenciales inválidas)
- Skipped: login real exitoso — requiere `CLV_TEST_USER`/`CLV_TEST_PASSWORD`

## Diferencias conocidas con Angular (solo cosméticas/documentadas)

- UI en Tailwind en lugar de Angular Material (diseño permitido cambiar)
- `history.replaceState` usa `/Login#recovery` etc. en lugar de `/#/recovery` (Angular hash routing) — comportamiento funcional idéntico
- Íconos de visibilidad: carácter 👁 en lugar de Material Icons

## Dependencias diferidas (documentadas en el análisis)

- Efectos post-login del shell (`GlobalService.LoadSettings`, config user-help) → se migran con el módulo shell/layout (PagesComponent)
