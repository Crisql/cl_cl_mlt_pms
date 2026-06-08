// SHELL / LAYOUT — Suite E2E completa (PagesComponent + cl-menu + HeaderComponent)
// Referencia: docs/migration/comparisons/SHELL-COMPLETE-ANALYSIS.md
const { test, expect } = require('@playwright/test');

const FAKE_SESSION = {
  access_token: 'fake-token-abc123',
  ExpireTime: '2099-12-31T23:59:59',
  Email: 'test@clavisco.com',
  UserEmail: 'test@clavisco.com',
  Licence: ''
};

const COMPANY = {
  Id: 1, Name: 'Clavisco CR', DatabaseCode: 'DB_CLV_CR',
  Process: 'T', ProcessName: 'TXT', ConfigTXT: '[{"f":1}]', ListConfHTH: [],
  CanCrossCurrencies: false, Logo: ''
};

const KEY_MENU = [
  { Key: 'home', Description: 'Inicio', Route: 'Home', Icon: 'home', Nodes: [], Visible: true, Permission: '' },
  {
    Key: 'config', Description: 'Configuración', Route: '', Icon: 'settings', Visible: true, Permission: '',
    Nodes: [
      { Key: 'config-process', Description: 'Procesos', Route: 'ConfigProcess', Icon: 'tune', Nodes: [], Visible: true, Permission: '' },
      { Key: 'config-hidden', Description: 'Oculto', Route: 'Hidden', Icon: 'block', Nodes: [], Visible: false, Permission: '' }
    ]
  },
  { Key: 'invisible', Description: 'Invisible', Route: 'Nope', Icon: 'block', Nodes: [], Visible: false, Permission: '' },
  { Key: 'logout', Description: 'Cerrar Sesión', Route: 'Logout', Icon: 'logout', Nodes: [], Visible: true, Permission: '' }
];

/** Sesión + compañía + KeyMenu + mocks API */
async function setupShell(page, options = {}) {
  await page.addInitScript(({ session, company, keyMenu }) => {
    localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    sessionStorage.setItem('SelectedCompany', JSON.stringify(company));
    sessionStorage.setItem('Process', JSON.stringify('TXT'));
    localStorage.setItem('KeyMenu', btoa(JSON.stringify(keyMenu)));
  }, {
    session: FAKE_SESSION,
    company: options.company ?? COMPANY,
    keyMenu: options.keyMenu ?? KEY_MENU
  });

  const captured = { settingKeys: [], exchangeCalls: 0, loggedUserCalls: 0 };

  await page.route('**/api/Chart', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: '' }) })
  );
  await page.route('**/api/Users/GetLoggedUser', (route) => {
    captured.loggedUserCalls++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: { ProfilePicture: 'data:image/png;base64,iVBORw0KGgo=', MainCurrency: 'CRC', ListConfHTH: [], SapUser: '' } })
    });
  });
  await page.route('**/api/Setting/GetSettingByKey**', (route) => {
    const url = new URL(route.request().url());
    captured.settingKeys.push(url.searchParams.get('key'));
    const isBatch = url.searchParams.get('key') === 'AutoBatchProcessor';
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: { Json: isBatch ? 'true' : '[]' } })
    });
  });
  await page.route('**/api/Bank/GetExchangeRateFromBccr', (route) => {
    captured.exchangeCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: 512.75 }) });
  });
  await page.route('**/api/Company/GetCompaniesByUser', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [COMPANY] }) })
  );

  return captured;
}

test.describe('Shell - Sidebar (cl-menu)', () => {
  test('Renderiza KeyMenu filtrando nodos no visibles, con íconos', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    const nav = page.locator('[data-principal-target="menuContainer"]');
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Configuración')).toBeVisible();
    await expect(nav.getByText('Cerrar Sesión')).toBeVisible();

    // Nodos Visible: false filtrados (recursivo)
    await expect(nav.getByText('Invisible')).toHaveCount(0);
    await expect(nav.getByText('Oculto')).toHaveCount(0);

    // Íconos material (Material Symbols: superset que incluye los nombres
    // nuevos del API como article_shortcut)
    await expect(nav.locator('.material-symbols-outlined', { hasText: 'home' })).toBeVisible();
  });

  test('Acordeón: expande hijos al click y nodo activo resaltado', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    const nav = page.locator('[data-principal-target="menuContainer"]');

    // Hijos ocultos inicialmente
    await expect(nav.getByText('Procesos')).toBeHidden();

    // Click en Configuración → expande
    await nav.getByText('Configuración').click();
    await expect(nav.getByText('Procesos')).toBeVisible();

    // Nodo activo: Inicio (estamos en /Home) resaltado
    const homeButton = nav.locator('button', { hasText: 'Inicio' });
    await expect(homeButton).toHaveClass(/bg-blue-100/);
  });

  test('Click en nodo de la ruta actual → toast "Ya se encuentra en X"', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    const nav = page.locator('[data-principal-target="menuContainer"]');
    await nav.getByText('Inicio').click();

    await expect(page.locator('#toast-container')).toContainText('Ya se encuentra en Inicio');
  });

  test('Click en Cerrar Sesión del menú → /Login', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    const nav = page.locator('[data-principal-target="menuContainer"]');
    await nav.getByText('Cerrar Sesión').click();

    await page.waitForURL(/\/Login/);
  });

  test('Toggle hamburguesa oculta/muestra el sidebar', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    const sidebar = page.locator('[data-principal-target="sidebar"]');
    await expect(sidebar).toBeVisible();

    await page.locator('header button[title="Menú"]').click();
    await expect(sidebar).toBeHidden();

    await page.locator('header button[title="Menú"]').click();
    await expect(sidebar).toBeVisible();
  });
});

test.describe('Shell - Header', () => {
  test('Muestra compañía, proceso, email del usuario y título de ambiente', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    await expect(page.locator('[data-principal-target="companyName"]')).toHaveText('Clavisco CR');
    await expect(page.locator('[data-principal-target="processName"]')).toHaveText('TXT');
    await expect(page.locator('[data-principal-target="userEmail"]')).toHaveText('test@clavisco.com');
    await expect(page.locator('[data-principal-target="envTitle"]')).toContainText('clavisco');
  });

  test('Click en Compañía → abre el modal SelectCompany', async ({ page }) => {
    await setupShell(page);
    await page.goto('/Home');

    await page.locator('button', { hasText: 'Compañía:' }).click();
    await expect(page.locator('[data-controller="select-company"]')).toBeVisible();
    // Con compañía previa: Cancelar visible
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('Tipo de cambio: oculto sin CanCrossCurrencies', async ({ page }) => {
    await setupShell(page); // CanCrossCurrencies: false
    await page.goto('/Home');

    await expect(page.locator('[data-principal-target="exchangeRateButton"]')).toBeHidden();
  });

  test('Tipo de cambio con CanCrossCurrencies: visible, refresca y persiste', async ({ page }) => {
    const captured = await setupShell(page, { company: { ...COMPANY, CanCrossCurrencies: true } });
    await page.goto('/Home');

    const button = page.locator('[data-principal-target="exchangeRateButton"]');
    await expect(button).toBeVisible();

    // El refresh manual SIEMPRE llama al API
    const callsBefore = captured.exchangeCalls;
    await button.click();
    await expect(page.locator('[data-principal-target="exchangeRate"]')).toHaveText('512.75');
    expect(captured.exchangeCalls).toBeGreaterThan(callsBefore);

    // sessionStorage.ExchangeRateBCCR actualizado (réplica de Repository.SetSession)
    const stored = await page.evaluate(() => sessionStorage.getItem('ExchangeRateBCCR'));
    expect(JSON.parse(stored)).toBe(512.75);
  });

  test('Avatar del usuario desde GetLoggedUser (ProfilePicture)', async ({ page }) => {
    const captured = await setupShell(page);
    await page.goto('/Home');

    await expect.poll(() => captured.loggedUserCalls).toBeGreaterThan(0);
    await expect(page.locator('[data-principal-target="userAvatar"]')).toHaveAttribute('src', /data:image\/png;base64/);
  });

  test('Proceso no habilitado → modal exacto del legacy', async ({ page }) => {
    // Compañía Process 'T' (TXT) → seleccionar HTH no está habilitado
    await setupShell(page);
    await page.goto('/Home');

    await page.locator('button', { hasText: 'Proceso:' }).click();
    await page.locator('[data-principal-target="processMenu"] button', { hasText: 'HTH' }).click();

    await expect(page.getByText('Proceso no habilitado')).toBeVisible();
    await expect(page.getByText('La compañía no cuenta con el proceso seleccionado.')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    // El proceso NO cambió
    const process = await page.evaluate(() => sessionStorage.getItem('Process'));
    expect(JSON.parse(process)).toBe('TXT');
  });

  test('Proceso válido → actualiza sessionStorage.Process', async ({ page }) => {
    // Compañía con ambos procesos (Process 'A') y config TXT válida
    await setupShell(page, {
      company: { ...COMPANY, Process: 'A', ProcessName: 'Todos', ConfigTXT: '[{"f":1}]' }
    });
    await page.goto('/Home');

    await page.locator('button', { hasText: 'Proceso:' }).click();
    await page.locator('[data-principal-target="processMenu"] button', { hasText: 'TXT' }).click();

    await expect(page.locator('[data-principal-target="processName"]')).toHaveText('TXT');
    const process = await page.evaluate(() => sessionStorage.getItem('Process'));
    expect(JSON.parse(process)).toBe('TXT');
  });
});

test.describe('Shell - Menú tras seleccionar compañía', () => {
  test('Entrar sin KeyMenu → seleccionar compañía → el sidebar se re-renderiza con el menú', async ({ page }) => {
    // Sesión SIN compañía y SIN KeyMenu (primer ingreso real)
    await page.addInitScript((session) => {
      localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
    }, FAKE_SESSION);

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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: KEY_MENU.filter((m) => m.Key !== 'logout') }) })
    );
    await page.route('**/api/Chart', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: '' }) })
    );
    await page.route('**/api/Setting/GetSettingByKey**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: { Json: '[]' } }) })
    );
    await page.route('**/api/Bank/GetExchangeRateFromBccr', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: 0 }) })
    );

    await page.goto('/Home');

    // Sin compañía: sidebar sin opciones y modal abierto
    const nav = page.locator('[data-principal-target="menuContainer"]');
    await expect(nav.getByText('Sin opciones de menú')).toBeVisible();
    const modal = page.locator('[data-controller="select-company"]');
    await expect(modal).toBeVisible();

    // Seleccionar compañía
    const row = modal.locator('tbody tr', { hasText: 'Clavisco CR' });
    await row.locator('[data-role="select-company-row"]').click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // El sidebar se re-renderiza con el menú del API + opción Cerrar Sesión
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Configuración')).toBeVisible();
    await expect(nav.getByText('Cerrar Sesión')).toBeVisible();
    await expect(nav.getByText('Sin opciones de menú')).toHaveCount(0);
  });
});

test.describe('Shell - Post-login (LoadSettings)', () => {
  test('Carga BankAccountsValidFormats y AutoBatchProcessor → sessionStorage', async ({ page }) => {
    const captured = await setupShell(page);
    await page.goto('/Home');

    await expect.poll(() => captured.settingKeys.length).toBeGreaterThanOrEqual(2);
    expect(captured.settingKeys).toContain('BankAccountsValidFormats');
    expect(captured.settingKeys).toContain('AutoBatchProcessor');

    const stored = await page.evaluate(() => sessionStorage.getItem('AutoBatchProcessor'));
    expect(JSON.parse(stored)).toBe(true);
  });
});
