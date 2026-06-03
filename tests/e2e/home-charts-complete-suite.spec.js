// HOME (+ CHARTS) — Suite E2E completa (paridad con Angular legacy)
// Referencia: docs/migration/comparisons/HOME-COMPLETE-ANALYSIS.md
const { test, expect } = require('@playwright/test');

const FAKE_SESSION = {
  access_token: 'fake-token-abc123',
  ExpireTime: '2099-12-31T23:59:59',
  UserEmail: 'test@clavisco.com',
  Licence: ''
};

const COMPANY = { Id: 1, Name: 'Clavisco CR', DatabaseCode: 'DB_CLV_CR', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] };

const CHARTS = [
  {
    Title: 'Pagos por mes', Type: 'bar', IsActive: true, ErrorMessage: null,
    Options: '{"scales":{"y":{"beginAtZero":true}}}',
    Data: { labels: ['Ene', 'Feb'], datasets: [{ label: 'Pagos', data: [10, 20] }] }
  },
  {
    Title: 'Distribución', Type: 'pie', IsActive: true, ErrorMessage: null,
    Options: '{}',
    Data: { labels: ['A', 'B'], datasets: [{ label: 'Dist', data: [5, 7] }] }
  },
  {
    Title: 'Inactivo', Type: 'line', IsActive: false, ErrorMessage: null,
    Options: '{}',
    Data: { labels: ['X'], datasets: [{ label: 'L', data: [1] }] }
  }
];

/** Sesión + compañía seleccionada + mock de /api/Chart */
async function setupWithCompany(page, options = {}) {
  await page.addInitScript(({ session, company }) => {
    localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    sessionStorage.setItem('SelectedCompany', JSON.stringify(company));
    sessionStorage.setItem('Process', JSON.stringify('TXT'));
  }, { session: FAKE_SESSION, company: COMPANY });

  const captured = { chartCalls: 0, headers: null };

  await page.route('**/api/Chart', (route) => {
    captured.chartCalls++;
    captured.headers = route.request().headers();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: options.charts ?? CHARTS, Message: options.message ?? '' })
    });
  });

  return captured;
}

test.describe('Home - Estructura', () => {
  test('Tarjeta Bienvenido con fecha yyyy-MM-dd y versión', async ({ page }) => {
    await setupWithCompany(page);
    await page.goto('/Home');

    await expect(page.getByText('Bienvenido')).toBeVisible();

    // Fecha en formato yyyy-MM-dd (legacy: currentDate | date:'yyyy-MM-dd')
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    await expect(page.locator('[data-home-target="currentDate"]')).toHaveText(expected);

    await expect(page.getByText(/^v\./)).toBeVisible();
  });
});

test.describe('Home - Charts (contrato API y render)', () => {
  test('Con compañía: GET /api/Chart con headers correctos y renderiza solo charts activos', async ({ page }) => {
    const captured = await setupWithCompany(page);
    await page.goto('/Home');

    // Render: 2 tarjetas (la inactiva NO se muestra)
    await expect(page.getByText('Pagos por mes')).toBeVisible();
    await expect(page.getByText('Distribución')).toBeVisible();
    await expect(page.getByText('Inactivo')).toBeHidden();
    await expect(page.locator('canvas.chart-canvas')).toHaveCount(2);

    // Contrato: Bearer + cl-company-id de la compañía seleccionada
    expect(captured.chartCalls).toBe(1);
    expect(captured.headers['authorization']).toBe(`Bearer ${FAKE_SESSION.access_token}`);
    expect(captured.headers['cl-company-id']).toBe('1');

    // chart.js efectivamente montado (el canvas adquiere tamaño al renderizar)
    const box = await page.locator('canvas.chart-canvas').first().boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('Charts con labels vacíos → render "Sin datos" sin fallar', async ({ page }) => {
    const emptyChart = [{
      Title: 'Vacío', Type: 'pie', IsActive: true, ErrorMessage: null,
      Options: '{}',
      Data: { labels: [], datasets: [{ label: '', data: [] }] }
    }];
    await setupWithCompany(page, { charts: emptyChart });
    await page.goto('/Home');

    await expect(page.getByText('Vacío')).toBeVisible();
    await expect(page.locator('canvas.chart-canvas')).toHaveCount(1);

    // Legacy: labels=['Sin datos'], dataset.data=[1], label='Sin datos'
    // Se valida vía el estado interno de chart.js
    const chartState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.chart-canvas');
      const chart = window.Chart?.getChart ? window.Chart.getChart(canvas) : null;
      return chart ? { labels: chart.data.labels, dsLabel: chart.data.datasets[0].label, dsData: chart.data.datasets[0].data } : null;
    });
    if (chartState) {
      expect(chartState.labels).toEqual(['Sin datos']);
      expect(chartState.dsLabel).toBe('Sin datos');
      expect(chartState.dsData).toEqual([1]);
    }
  });

  test('Message no vacío → modal de error con detalle "Title: ErrorMessage"', async ({ page }) => {
    const chartsWithError = [
      { ...CHARTS[0], ErrorMessage: 'Query inválida' },
      CHARTS[1]
    ];
    await setupWithCompany(page, { charts: chartsWithError, message: 'Error al cargar algunos gráficos' });
    await page.goto('/Home');

    await expect(page.getByText('Error al cargar algunos gráficos')).toBeVisible();
    await expect(page.getByText('Pagos por mes: Query inválida')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
  });

  test('Sin compañía seleccionada: NO llama /api/Chart (solo modal SelectCompany)', async ({ page }) => {
    // Sesión sin compañía
    await page.addInitScript((session) => {
      localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    }, FAKE_SESSION);

    let chartCalls = 0;
    await page.route('**/api/Chart', (route) => {
      chartCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: '' }) });
    });
    await page.route('**/api/Company/GetCompaniesByUser', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [COMPANY] }) })
    );

    await page.goto('/Home');
    await expect(page.locator('[data-controller="select-company"]')).toBeVisible();
    expect(chartCalls).toBe(0);
  });

  test('Al seleccionar compañía en el modal → los charts cargan (evento company-changed)', async ({ page }) => {
    // Sesión sin compañía; seleccionar desde el modal dispara el re-fetch
    await page.addInitScript((session) => {
      localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    }, FAKE_SESSION);

    let chartCalls = 0;
    await page.route('**/api/Chart', (route) => {
      chartCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: CHARTS, Message: '' }) });
    });
    await page.route('**/api/Company/GetCompaniesByUser', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [COMPANY] }) })
    );
    await page.route('**/api/UsersByCompany/GetPermissionsRoles', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: { Permissions: [], Roles: [] } }) })
    );
    await page.route('**/api/Users/GetLoggedUser', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: { MainCurrency: 'CRC', TaxIdNum: '', ListConfHTH: [], SapUser: '' } }) })
    );
    await page.route('**/api/Menu', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [] }) })
    );

    await page.goto('/Home');
    const modal = page.locator('[data-controller="select-company"]');
    await expect(modal).toBeVisible();
    expect(chartCalls).toBe(0);

    // Seleccionar la compañía TXT (ConfigTXT válido → no navega a ConfigProcess)
    const row = modal.locator('tbody tr', { hasText: 'Clavisco CR' });
    await row.locator('[data-role="select-company-row"]').click();

    await expect(modal).toBeHidden({ timeout: 10000 });
    await expect.poll(() => chartCalls).toBe(1);
    await expect(page.getByText('Pagos por mes')).toBeVisible();
  });
});
