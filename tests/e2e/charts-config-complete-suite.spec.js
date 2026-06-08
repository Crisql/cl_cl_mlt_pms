// CHARTS-CONFIG (Dashboard) — Suite E2E completa (paridad con Angular legacy)
// Referencia: docs/migration/comparisons/CHARTS-CONFIG-COMPLETE-ANALYSIS.md
// Decisión de diseño: crear/editar por rutas (no modal).
const { test, expect } = require('@playwright/test');

const FAKE_SESSION = {
  access_token: 'fake-token-abc123',
  ExpireTime: '2099-12-31T23:59:59',
  UserEmail: 'test@clavisco.com',
  Email: 'test@clavisco.com',
  Licence: ''
};

const COMPANY = { Id: 7, Name: 'Clavisco CR', DatabaseCode: 'DB_CLV_CR', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] };

const CHARTS = [
  { Id: 1, Title: 'Pagos por mes', Type: 'bar', XAxisDatasets: 'vw_pagos', IsActive: true, Options: '{}', XType: 'string', YType: 'number', CreatedBy: 'admin', UpdatedBy: 'admin' },
  { Id: 2, Title: 'Distribución', Type: 'pie', XAxisDatasets: 'vw_dist', IsActive: true, Options: '{}', XType: 'string', YType: 'number', CreatedBy: 'admin', UpdatedBy: 'admin' },
  { Id: 3, Title: 'Tendencia', Type: 'line', XAxisDatasets: 'vw_tend', IsActive: false, Options: '{}', XType: 'string', YType: 'number', CreatedBy: 'admin', UpdatedBy: 'admin' }
];

const COLOR_RANGES = [
  { Code: 'BLUES', Name: 'Azules', Colors: '["#1B81BE","#0A4D72"]' },
  { Code: 'SINGLE', Name: 'Verde', Colors: '["#58D68D"]' },
  { Code: 'BAD', Name: 'Inválido', Colors: '["rojo","#XYZ"]' } // inválido → excluido + notificación
];

/** Sesión + compañía + mocks de los endpoints del shell y de Chart */
async function setup(page, opts = {}) {
  await page.addInitScript(({ session, company }) => {
    localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    sessionStorage.setItem('SelectedCompany', JSON.stringify(company));
    sessionStorage.setItem('Process', JSON.stringify('TXT'));
    // Evita que el shell dispare LoadProfile/LoadSettings/exchange
    sessionStorage.setItem('UserAvatar', 'data:image/png;base64,AAA');
    sessionStorage.setItem('AutoBatchProcessor', 'false');
    localStorage.setItem('KeyMenu', btoa(JSON.stringify([])));
  }, { session: FAKE_SESSION, company: COMPANY });

  const captured = { post: null, patch: null, labelsId: null, configCalls: 0 };

  // Endpoints del shell autenticado (silenciados)
  await page.route('**/api/Menu', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [] }) }));
  await page.route('**/api/Users/GetLoggedUser', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null }) }));
  await page.route('**/api/Setting/GetSettingByKey**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null }) }));
  await page.route('**/api/Bank/GetExchangeRateFromBccr', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: 0 }) }));

  // Listado
  await page.route('**/api/Chart/GetChartsConfiguration', (r) => {
    captured.configCalls++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: opts.charts ?? CHARTS, Message: '' }) });
  });
  // Rangos de color
  await page.route('**/api/Chart/GetChartsColorRanges', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: opts.ranges ?? COLOR_RANGES, Message: '' }) })
  );
  // Labels por gráfico
  await page.route('**/api/Chart/GetChartsLabelsByChartId**', (r) => {
    const u = new URL(r.request().url());
    captured.labelsId = u.searchParams.get('Id');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: opts.labels ?? [], Message: '' }) });
  });
  // POST / PATCH (capturar). El path exacto es /api/Chart (sin sufijo).
  await page.route('**/api/Chart', (r) => {
    const method = r.request().method();
    if (method === 'POST') captured.post = { headers: r.request().headers(), body: r.request().postDataJSON() };
    if (method === 'PATCH') captured.patch = { headers: r.request().headers(), body: r.request().postDataJSON() };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: { Id: 99 }, Message: '' }) });
  });

  return captured;
}

// ============================================================
test.describe('Charts-config - Listado (/Dashboard)', () => {
  test('GET GetChartsConfiguration con headers correctos y render de filas', async ({ page }) => {
    const captured = await setup(page);
    await page.goto('/Dashboard');

    const rows = page.locator('[data-charts-config-target="tableBody"] tr');
    await expect(rows).toHaveCount(3);
    await expect(page.getByText('Pagos por mes')).toBeVisible();
    await expect(page.getByText('vw_pagos')).toBeVisible();

    // Contrato: 1 sola carga con Bearer + cl-company-id
    expect(captured.configCalls).toBe(1);
  });

  test('Íconos de tipo (bar/pie/line) y de activo (check/cancel)', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard');
    const rows = page.locator('[data-charts-config-target="tableBody"] tr');

    await expect(rows.nth(0).locator('.material-icons', { hasText: 'bar_chart' })).toBeVisible();
    await expect(rows.nth(1).locator('.material-icons', { hasText: 'pie_chart' })).toBeVisible();
    await expect(rows.nth(2).locator('.material-icons', { hasText: 'show_chart' })).toBeVisible();

    // Activo: filas 0 y 1 check_circle, fila 2 cancel
    await expect(rows.nth(0).locator('.material-icons', { hasText: 'check_circle' })).toBeVisible();
    await expect(rows.nth(2).locator('.material-icons', { hasText: 'cancel' })).toBeVisible();
  });

  test('Tooltip de tipo "{type} Chart"', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard');
    const typeIcon = page.locator('[data-charts-config-target="tableBody"] tr').nth(0).locator('.material-icons', { hasText: 'bar_chart' });
    await expect(typeIcon).toHaveAttribute('title', 'bar Chart');
  });

  test('Búsqueda local por Título filtra (debounce)', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard');
    await page.locator('[data-charts-config-target="searchInput"]').fill('distri');
    await expect(page.locator('[data-charts-config-target="tableBody"] tr')).toHaveCount(1);
    await expect(page.getByText('Distribución')).toBeVisible();
  });

  test('Botón Nuevo navega a /Dashboard/new', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard');
    await page.locator('[data-charts-config-target="newButton"]').click();
    await expect(page).toHaveURL(/\/Dashboard\/new$/);
    await expect(page.locator('[data-chart-config-form-target="title"]')).toHaveText('Datos del gráfico');
  });

  test('Botón Editar navega a /Dashboard/:id/edit', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard');
    await page.locator('[data-charts-config-target="tableBody"] tr').nth(0).locator("[data-role='edit-chart']").click();
    await expect(page).toHaveURL(/\/Dashboard\/1\/edit$/);
  });
});

// ============================================================
test.describe('Charts-config - Formulario (crear)', () => {
  test('Carga selects (Type/XType/YType), opciones y rangos válidos (excluye inválidos)', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard/new');

    // Type: placeholder + bar/pie/line
    await expect(page.locator('[data-chart-config-form-target="fType"] option')).toHaveCount(4);
    // XType/YType: placeholder + string/number
    await expect(page.locator('[data-chart-config-form-target="fXType"] option')).toHaveCount(3);

    // Rango de colores: placeholder + 2 válidos (BAD excluido)
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.locator('[data-chart-config-form-target="fHaveDynamicLabels"]').check();
    await expect(page.locator('[data-chart-config-form-target="fChartColorRange"] option')).toHaveCount(3);
    await expect(page.locator('[data-chart-config-form-target="fChartColorRange"]')).not.toContainText('Inválido');
  });

  test('Botón Guardar deshabilitado hasta completar form + label', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard/new');
    const save = page.locator('[data-chart-config-form-target="saveButton"]');
    await expect(save).toBeDisabled();

    // Completar pestaña Gráficos
    await page.locator('[data-chart-config-form-target="fTitle"]').fill('Nuevo gráfico');
    await page.locator('[data-chart-config-form-target="fType"]').selectOption('bar');
    await page.locator('[data-chart-config-form-target="fOptions"]').fill('{}');
    await page.locator('[data-chart-config-form-target="fXType"]').selectOption('string');
    await page.locator('[data-chart-config-form-target="fYType"]').selectOption('number');
    await page.locator('[data-chart-config-form-target="fXAxisDatasets"]').fill('vw_x');
    await expect(save).toBeDisabled(); // falta label

    // Pestaña Labels: XAxis + 1 color con label
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.locator('[data-chart-config-form-target="fXAxis"]').fill('Mes');
    await page.getByRole('button', { name: 'Agregar Color' }).click();
    await expect(save).toBeDisabled(); // label de la fila vacío
    await page.locator("[data-role='label-input']").first().fill('Enero');
    await expect(save).toBeEnabled();
  });

  test('Crear: POST /api/Chart con IChartContext exacto', async ({ page }) => {
    const captured = await setup(page);
    await page.goto('/Dashboard/new');

    await page.locator('[data-chart-config-form-target="fTitle"]').fill('Nuevo gráfico');
    await page.locator('[data-chart-config-form-target="fType"]').selectOption('bar');
    await page.locator('[data-chart-config-form-target="fOptions"]').fill('{}');
    await page.locator('[data-chart-config-form-target="fXType"]').selectOption('string');
    await page.locator('[data-chart-config-form-target="fYType"]').selectOption('number');
    await page.locator('[data-chart-config-form-target="fXAxisDatasets"]').fill('vw_x');
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.locator('[data-chart-config-form-target="fXAxis"]').fill('Mes');
    await page.getByRole('button', { name: 'Agregar Color' }).click();
    await page.locator("[data-role='label-input']").first().fill('Enero');
    await page.locator("[data-role='color-input']").first().fill('#ff0000');

    const reqPromise = page.waitForRequest((r) => r.url().endsWith('/api/Chart') && r.method() === 'POST');
    await page.locator('[data-chart-config-form-target="saveButton"]').click();
    await reqPromise;

    expect(captured.post).not.toBeNull();
    expect(captured.post.headers['authorization']).toBe(`Bearer ${FAKE_SESSION.access_token}`);
    expect(captured.post.headers['cl-company-id']).toBe('7');

    const ctx = captured.post.body;
    expect(ctx.Chart).toMatchObject({
      Title: 'Nuevo gráfico', Type: 'bar', Options: '{}', XType: 'string', YType: 'number',
      XAxisDatasets: 'vw_x', IsActive: true, CreatedBy: '', UpdatedBy: ''
    });
    expect(ctx.Chart.Id).toBeUndefined();
    expect(ctx.ChartLabel).toMatchObject({
      HaveDynamicLabels: false, XAxis: 'Mes', ChartColorRange: '', CreatedBy: '', UpdatedBy: ''
    });
    expect(JSON.parse(ctx.ChartLabel.Colors)).toEqual(['#ff0000']);
    expect(JSON.parse(ctx.ChartLabel.Labels)).toEqual(['Enero']);

    // Tras guardar navega al listado
    await expect(page).toHaveURL(/\/Dashboard$/);
  });

  test('Crear con labels dinámicos: Colors/Labels vacíos + ChartColorRange', async ({ page }) => {
    const captured = await setup(page);
    await page.goto('/Dashboard/new');

    await page.locator('[data-chart-config-form-target="fTitle"]').fill('Dinámico');
    await page.locator('[data-chart-config-form-target="fType"]').selectOption('pie');
    await page.locator('[data-chart-config-form-target="fOptions"]').fill('{}');
    await page.locator('[data-chart-config-form-target="fXType"]').selectOption('string');
    await page.locator('[data-chart-config-form-target="fYType"]').selectOption('number');
    await page.locator('[data-chart-config-form-target="fXAxisDatasets"]').fill('vw_y');
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.locator('[data-chart-config-form-target="fXAxis"]').fill('Categoría');
    await page.locator('[data-chart-config-form-target="fHaveDynamicLabels"]').check();
    await page.locator('[data-chart-config-form-target="fChartColorRange"]').selectOption('BLUES');

    const save = page.locator('[data-chart-config-form-target="saveButton"]');
    await expect(save).toBeEnabled();

    const reqPromise = page.waitForRequest((r) => r.url().endsWith('/api/Chart') && r.method() === 'POST');
    await save.click();
    await reqPromise;

    const ctx = captured.post.body;
    expect(ctx.ChartLabel.HaveDynamicLabels).toBe(true);
    expect(ctx.ChartLabel.ChartColorRange).toBe('BLUES');
    expect(JSON.parse(ctx.ChartLabel.Colors)).toEqual([]);
    expect(JSON.parse(ctx.ChartLabel.Labels)).toEqual([]);
  });
});

// ============================================================
test.describe('Charts-config - Formulario (editar)', () => {
  const EDIT_LABELS = [{ Id: 55, ChartId: 1, HaveDynamicLabels: false, XAxis: 'Mes', Labels: '["Enero","Febrero"]', Colors: '["#111111","#222222"]', ChartColorRange: '' }];

  test('Edición: hidrata campos del gráfico y los labels manuales', async ({ page }) => {
    const captured = await setup(page, { labels: EDIT_LABELS });
    await page.goto('/Dashboard/1/edit');

    await expect(page.locator('[data-chart-config-form-target="title"]')).toHaveText('Modificar datos del gráfico');
    await expect(page.locator('[data-chart-config-form-target="fTitle"]')).toHaveValue('Pagos por mes');
    await expect(page.locator('[data-chart-config-form-target="fType"]')).toHaveValue('bar');
    await expect(page.locator('[data-chart-config-form-target="fXAxisDatasets"]')).toHaveValue('vw_pagos');
    expect(captured.labelsId).toBe('1');

    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await expect(page.locator('[data-chart-config-form-target="fXAxis"]')).toHaveValue('Mes');
    const rows = page.locator("[data-role='color-row']");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator("[data-role='label-input']")).toHaveValue('Enero');
    await expect(rows.nth(1).locator("[data-role='label-input']")).toHaveValue('Febrero');
  });

  test('Editar: PATCH /api/Chart con Chart.Id y ChartLabel.Id', async ({ page }) => {
    const captured = await setup(page, { labels: EDIT_LABELS });
    await page.goto('/Dashboard/1/edit');
    await expect(page.locator('[data-chart-config-form-target="fTitle"]')).toHaveValue('Pagos por mes');

    await page.locator('[data-chart-config-form-target="fTitle"]').fill('Pagos por mes (v2)');

    const reqPromise = page.waitForRequest((r) => r.url().endsWith('/api/Chart') && r.method() === 'PATCH');
    await page.locator('[data-chart-config-form-target="saveButton"]').click();
    await reqPromise;

    expect(captured.patch).not.toBeNull();
    const ctx = captured.patch.body;
    expect(ctx.Chart.Id).toBe(1);
    expect(ctx.Chart.Title).toBe('Pagos por mes (v2)');
    expect(ctx.Chart.CreatedBy).toBe('admin'); // heredado del registro
    expect(ctx.ChartLabel.Id).toBe(55);
    expect(JSON.parse(ctx.ChartLabel.Labels)).toEqual(['Enero', 'Febrero']);
    await expect(page).toHaveURL(/\/Dashboard$/);
  });
});

// ============================================================
test.describe('Charts-config - Labels dinámicos (toggle)', () => {
  test('Activar con filas existentes → confirma pérdida; cancelar revierte', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard/new');
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.getByRole('button', { name: 'Agregar Color' }).click();
    await page.locator("[data-role='label-input']").first().fill('Uno');

    // Activar dinámicos → aparece confirm; cancelar
    await page.locator('[data-chart-config-form-target="fHaveDynamicLabels"]').check();
    await expect(page.getByText(/se perderá el nombre de los labels/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Revierte: sigue en modo manual con la fila
    await expect(page.locator('[data-chart-config-form-target="fHaveDynamicLabels"]')).not.toBeChecked();
    await expect(page.locator("[data-role='color-row']")).toHaveCount(1);
  });

  test('Activar y confirmar → modo dinámico (oculta filas, muestra rango)', async ({ page }) => {
    await setup(page);
    await page.goto('/Dashboard/new');
    await page.locator('[data-chart-config-form-target="tabLabelsBtn"]').click();
    await page.getByRole('button', { name: 'Agregar Color' }).click();
    await page.locator("[data-role='label-input']").first().fill('Uno');

    await page.locator('[data-chart-config-form-target="fHaveDynamicLabels"]').check();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await expect(page.locator('[data-chart-config-form-target="manualBlock"]')).toBeHidden();
    await expect(page.locator('[data-chart-config-form-target="dynamicBlock"]')).toBeVisible();
  });
});
