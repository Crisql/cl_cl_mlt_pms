# cl_cl_mlt_pms — Consolidador de Pagos (UI Migration)

Migración de la UI del PMS (Consolidador de Pagos) de **Angular 14** a **Rails 8 + Hotwire (Turbo/Stimulus) + Tailwind CSS**.

- **Legacy (fuente de verdad de funcionalidad):** `..\acordoba_cl_cl_mlt_pms` (Angular)
- **Referencia de patrones:** `..\ema-ui-migration_jramirez` (misma arquitectura)
- **Protocolo de migración:** [`.claude/MIGRATION-PROTOCOL.md`](.claude/MIGRATION-PROTOCOL.md)

## Arquitectura

Rails es **solo UI**. El backend sigue siendo el API .NET existente:

```
Browser (Stimulus) ──fetch("/api/...")──► Api::ProxyController ──► API .NET (LEGACY_API_URL)
```

- El proxy (`app/controllers/api/proxy_controller.rb`) es 100% transparente: solo cambia la base URL y reenvía headers tal cual.
- La autenticación vive en el JS (igual que Angular): token en `localStorage.CurrentSession` (base64), compañía en `sessionStorage.SelectedCompany`, headers `Authorization: Bearer` + `cl-company-id`.
- Las rutas UI replican las del Angular exactamente (`/Login`, `/Home`, `/SelectCompany`, … incluso los typos históricos `SearchPruchaseOrders` / `BankFormarts`).

## Multi-cliente

Un deploy por cliente vía ENV (espejo de los `environment.{cliente}.ts` del Angular). Ver `.env.example`. Alcance actual: **clv (Clavisco)** únicamente.

## Setup

```bash
bundle install
npm install
cp .env.example .env   # ya configurado para clv
bin/dev                # http://localhost:3000
```

Requiere Ruby 3.3.6 y Node 20+.

## Pruebas

```bash
npx playwright install chromium   # primera vez
npm test                          # E2E (requiere bin/dev corriendo)
npm run test:unit                 # unit (vitest)
```

## Migrar un módulo

Decir a Claude Code: `migrate <módulo o URL>` — ejecuta el protocolo completo de 6 fases (análisis del legacy → pruebas E2E → implementación → validación → corrección → documentación). Ver `.claude/MIGRATION-PROTOCOL.md`.

Documentación generada por módulo: `docs/migration/comparisons/` y `docs/migration/progress/`.
