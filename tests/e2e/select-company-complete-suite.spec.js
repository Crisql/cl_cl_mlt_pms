// SELECTCOMPANY — Suite E2E completa (paridad con Angular legacy)
// Referencia: docs/migration/comparisons/SELECTCOMPANY-COMPLETE-ANALYSIS.md
const { test, expect } = require('@playwright/test');

const FAKE_SESSION = {
  access_token: 'fake-token-abc123',
  ExpireTime: '2099-12-31T23:59:59',
  UserEmail: 'test@clavisco.com',
  Licence: ''
};

const COMPANIES = [
  { Id: 1, Name: 'Clavisco CR', DatabaseCode: 'DB_CLV_CR', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] },
  { Id: 2, Name: 'Clavisco GT', DatabaseCode: 'DB_CLV_GT', Process: 'H', ConfigTXT: '', ListConfHTH: [] },
  { Id: 3, Name: 'Acme Corp', DatabaseCode: 'DB_ACME', Process: 'A', ConfigTXT: '[{"f":1}]', ListConfHTH: [] },
  { Id: 4, Name: 'Beta SA', DatabaseCode: 'DB_BETA', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] },
  { Id: 5, Name: 'Gamma Inc', DatabaseCode: 'DB_GAMMA', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] },
  { Id: 6, Name: 'Delta Ltd', DatabaseCode: 'DB_DELTA', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] },
  { Id: 7, Name: 'Omega SRL', DatabaseCode: 'DB_OMEGA', Process: 'T', ConfigTXT: '[{"f":1}]', ListConfHTH: [] }
];

const LOGGED_USER = {
  MainCurrency: 'CRC',
  TaxIdNum: '3-101-123456',
  ListConfHTH: [{ Id: 9 }],
  ProfilePicture: '',
  SapUser: 'sapmanager'
};

const PERMISSIONS_ROLES = {
  Permissions: [{ Name: 'V_Pay' }, { Name: 'V_Docs' }],
  Roles: [{ Id: 1, Name: 'Admin' }]
};

const MENU = [
  { Key: 'home', Description: 'Inicio', Route: 'Home', Icon: 'home', Nodes: [], Visible: true, Permission: '' },
  { Key: 'lots', Description: 'Lotes', Route: 'Lots', Icon: 'list', Nodes: [], Visible: true, Permission: '' },
  { Key: 'settings', Description: 'Configuración', Route: 'Settings', Icon: 'settings', Nodes: [], Visible: true, Permission: '' }
];

/** Sesión válida + mocks API por defecto */
async function setupAuthenticated(page, options = {}) {
  await page.addInitScript((session) => {
    localStorage.setItem('CurrentSession', btoa(JSON.stringify(session)));
  }, FAKE_SESSION);

  const captured = { permsHeaders: null, userHeaders: null, companiesCalls: 0 };

  await page.route('**/api/Company/GetCompaniesByUser', (route) => {
    captured.companiesCalls++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: options.companies ?? COMPANIES })
    });
  });

  await page.route('**/api/UsersByCompany/GetPermissionsRoles', (route) => {
    captured.permsHeaders = route.request().headers();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: PERMISSIONS_ROLES })
    });
  });

  await page.route('**/api/Users/GetLoggedUser', (route) => {
    captured.userHeaders = route.request().headers();
    if (options.loggedUserStatus === 401) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ Message: 'No autorizado' }) });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ Data: options.loggedUser ?? LOGGED_USER })
    });
  });

  await page.route('**/api/Menu', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: MENU }) })
  );

  return captured;
}

const modal = (page) => page.locator('[data-controller="select-company"]');

test.describe('SelectCompany - Apertura desde Home', () => {
  test('Sin compañía seleccionada: el modal se abre con estructura completa', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');

    await expect(modal(page)).toBeVisible();
    await expect(page.getByText('Selección de compañía')).toBeVisible();

    // Select de proceso: HTH y TXT, SIN 'Todos' (id 'A' filtrado)
    const options = await page.locator('#sc-process option').allTextContents();
    expect(options).toContain('HTH');
    expect(options).toContain('TXT');
    expect(options).not.toContain('Todos');

    // Búsqueda
    await expect(page.locator('#sc-search')).toBeVisible();

    // Tabla: columnas renombradas del legacy
    await expect(page.getByText('Nombre de la compañía')).toBeVisible();
    await expect(page.getByText('Base de datos')).toBeVisible();
    await expect(page.getByText('Procesos configurados')).toBeVisible();

    // Footer: sin compañía previa NO hay Cancelar; sí Cerrar Sesión
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cerrar Sesión' })).toBeVisible();
  });

  test('Paginación local: 5 por página default, cambia a 10, navega páginas', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    // 7 compañías → página 1 muestra 5
    await expect(modal(page).locator('tbody tr')).toHaveCount(5);
    await expect(page.getByText('1 - 5 de 7')).toBeVisible();

    // Siguiente página → 2 restantes
    await modal(page).locator('[data-select-company-target="nextPage"]').click();
    await expect(modal(page).locator('tbody tr')).toHaveCount(2);
    await expect(page.getByText('6 - 7 de 7')).toBeVisible();

    // Page size 10 → todas en una página
    await modal(page).locator('[data-select-company-target="pageSize"]').selectOption('10');
    await expect(modal(page).locator('tbody tr')).toHaveCount(7);
  });

  test('ProcessName mapeado: H→HTH, T→TXT, A→Todos', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();
    await modal(page).locator('[data-select-company-target="pageSize"]').selectOption('15');

    const row1 = modal(page).locator('tbody tr', { hasText: 'Clavisco CR' });
    await expect(row1).toContainText('TXT');
    const row2 = modal(page).locator('tbody tr', { hasText: 'Clavisco GT' });
    await expect(row2).toContainText('HTH');
    const row3 = modal(page).locator('tbody tr', { hasText: 'Acme Corp' });
    await expect(row3).toContainText('Todos');
  });

  test('Búsqueda filtra por Name + DatabaseCode (incluye debounce)', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    // Por nombre
    await page.fill('#sc-search', 'clavisco');
    await expect(modal(page).locator('tbody tr')).toHaveCount(2, { timeout: 3000 });

    // Por código de base de datos
    await page.fill('#sc-search', 'DB_ACME');
    await expect(modal(page).locator('tbody tr')).toHaveCount(1);
    await expect(modal(page).locator('tbody tr')).toContainText('Acme Corp');

    // Limpia → todas
    await page.fill('#sc-search', '');
    await expect(modal(page).locator('tbody tr')).toHaveCount(5);
  });

  test('Sin compañías asignadas → toast de advertencia', async ({ page }) => {
    await setupAuthenticated(page, { companies: [] });
    await page.goto('/Home');

    await expect(page.locator('#toast-container')).toContainText('No cuenta con compañías asignadas, contacte al administrador');
  });

  test('Cache ListCompanies: segunda visita NO llama GetCompaniesByUser', async ({ page }) => {
    const captured = await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page).locator('tbody tr')).toHaveCount(5);
    expect(captured.companiesCalls).toBe(1);

    // Recargar: las compañías vienen del storage base64 'ListCompanies'
    await page.reload();
    await expect(modal(page).locator('tbody tr')).toHaveCount(5);
    expect(captured.companiesCalls).toBe(1);

    const listRaw = await page.evaluate(() => localStorage.getItem('ListCompanies'));
    const list = JSON.parse(Buffer.from(listRaw, 'base64').toString());
    expect(list).toHaveLength(7);
    expect(list[0].ProcessName).toBe('TXT');
  });
});

test.describe('SelectCompany - Validaciones de proceso', () => {
  test('Compañía Process=A sin proceso seleccionado → modal "Proceso requerido"', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();
    await modal(page).locator('[data-select-company-target="pageSize"]').selectOption('15');

    const row = modal(page).locator('tbody tr', { hasText: 'Acme Corp' });
    await row.locator('[data-role="select-company-row"]').click();

    await expect(page.getByText('Proceso requerido')).toBeVisible();
    await expect(page.getByText('Primero debe seleccionar un proceso.')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    // No se seleccionó nada
    expect(await page.evaluate(() => sessionStorage.getItem('SelectedCompany'))).toBeNull();
  });

  test('Proceso seleccionado ≠ proceso de la compañía → modal "Proceso no habilitado"', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    // Seleccionar proceso HTH y compañía con Process 'T'
    await page.locator('#sc-process').selectOption('H');
    const row = modal(page).locator('tbody tr', { hasText: 'Clavisco CR' });
    await row.locator('[data-role="select-company-row"]').click();

    await expect(page.getByText('Proceso no habilitado')).toBeVisible();
    await expect(page.getByText('La compañía no cuenta con el proceso seleccionado.')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    expect(await page.evaluate(() => sessionStorage.getItem('SelectedCompany'))).toBeNull();
  });
});

test.describe('SelectCompany - Selección exitosa (contrato API y storage)', () => {
  test('Selección completa: storage idéntico al legacy + headers correctos', async ({ page }) => {
    const captured = await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    // Compañía TXT con select vacío → toma el proceso de la compañía
    const row = modal(page).locator('tbody tr', { hasText: 'Clavisco CR' });
    await row.locator('[data-role="select-company-row"]').click();

    // Toast éxito (inmediato, texto con espaciado literal del legacy)
    await expect(page.locator('#toast-container')).toContainText('Se encuentra trabajando con la compañía Clavisco CR  y el proceso TXT');

    // Modal se cierra al completar
    await expect(modal(page)).toBeHidden({ timeout: 10000 });

    const storage = await page.evaluate(() => ({
      process: sessionStorage.getItem('Process'),
      selectedCompany: sessionStorage.getItem('SelectedCompany'),
      roleAccess: localStorage.getItem('RoleAccess'),
      keyMenu: localStorage.getItem('KeyMenu'),
      session: localStorage.getItem('CurrentSession')
    }));

    // Process = "TXT" (JSON string)
    expect(JSON.parse(storage.process)).toBe('TXT');

    // SelectedCompany enriquecida con datos del logged user
    const company = JSON.parse(storage.selectedCompany);
    expect(company.Id).toBe(1);
    expect(company.MainCurrency).toBe('CRC');
    expect(company.TaxIdNum).toBe('3-101-123456');
    expect(company.ListConfHTH).toEqual([{ Id: 9 }]);

    // RoleAccess (base64): {Roles, Access: nombres}
    const roleAccess = JSON.parse(Buffer.from(storage.roleAccess, 'base64').toString());
    expect(roleAccess.Access).toEqual(['V_Pay', 'V_Docs']);
    expect(roleAccess.Roles).toEqual(PERMISSIONS_ROLES.Roles);

    // KeyMenu (base64): menú del API + opción logout agregada
    // (btoa legacy codifica en Latin1 — "Sesión" debe decodificarse como latin1)
    const keyMenu = JSON.parse(Buffer.from(storage.keyMenu, 'base64').toString('latin1'));
    expect(keyMenu.some((m) => m.Key === 'lots')).toBeTruthy();
    const logoutOption = keyMenu.find((m) => m.Key === 'logout');
    expect(logoutOption).toMatchObject({ Description: 'Cerrar Sesión', Route: 'Logout', Icon: 'logout' });

    // CurrentSession.Licence actualizada (AES de SapUser, no vacía)
    const session = JSON.parse(Buffer.from(storage.session, 'base64').toString());
    expect(session.Licence.length).toBeGreaterThan(0);

    // Headers: GetPermissionsRoles y GetLoggedUser llevan cl-company-id de la nueva compañía
    expect(captured.permsHeaders['cl-company-id']).toBe('1');
    expect(captured.permsHeaders['authorization']).toBe(`Bearer ${FAKE_SESSION.access_token}`);
    expect(captured.userHeaders['cl-company-id']).toBe('1');
  });

  test('Proceso sin configuración → modal "Proceso no configurado" → /ConfigProcess', async ({ page }) => {
    // Compañía TXT sin ConfigTXT válido y logged user sin nada que lo arregle
    const companies = [{ Id: 10, Name: 'SinConfig SA', DatabaseCode: 'DB_SC', Process: 'T', ConfigTXT: '', ListConfHTH: [] }];
    await setupAuthenticated(page, {
      companies,
      loggedUser: { ...LOGGED_USER, ListConfHTH: [] }
    });
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    const row = modal(page).locator('tbody tr', { hasText: 'SinConfig SA' });
    await row.locator('[data-role="select-company-row"]').click();

    await expect(page.getByText('Proceso no configurado')).toBeVisible();
    await expect(page.getByText('El proceso seleccionado para esta compañía no ha sido configurado.')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.waitForURL(/\/ConfigProcess/);
  });

  test('401 en GetLoggedUser → menú restringido (home/settings + logout) y /Home', async ({ page }) => {
    await setupAuthenticated(page, { loggedUserStatus: 401 });
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    const row = modal(page).locator('tbody tr', { hasText: 'Clavisco CR' });
    await row.locator('[data-role="select-company-row"]').click();

    // La navegación a /Home puede destruir el contexto: leer y decodificar
    // TODO dentro del poll (con reintentos ante context destroyed)
    await expect.poll(async () => {
      try {
        const raw = await page.evaluate(() => localStorage.getItem('KeyMenu'));
        if (!raw) return null;
        const keyMenu = JSON.parse(Buffer.from(raw, 'base64').toString('latin1'));
        return keyMenu.map((m) => m.Key).sort().join(',');
      } catch {
        return null;
      }
    }, { timeout: 15000 }).toBe('home,logout,settings'); // sin 'lots' (restringido)
  });
});

test.describe('SelectCompany - Footer', () => {
  test('Con compañía previa: botón Cancelar visible y cierra el modal', async ({ page }) => {
    await setupAuthenticated(page);
    // Pre-cargar compañía seleccionada (sessionStorage se setea post-load)
    await page.addInitScript((company) => {
      sessionStorage.setItem('SelectedCompany', JSON.stringify(company));
    }, COMPANIES[0]);

    await page.goto('/Home');
    // Con compañía ya seleccionada el modal NO se abre automáticamente (legacy OpenDialog)
    await expect(modal(page)).toBeHidden();

    // Ruta directa /SelectCompany sí lo abre
    await page.goto('/SelectCompany');
    await expect(modal(page)).toBeVisible();
    const cancelButton = page.getByRole('button', { name: 'Cancelar' });
    await expect(cancelButton).toBeVisible();

    await cancelButton.click();
    await expect(modal(page)).toBeHidden();
  });

  test('Cerrar Sesión → limpia storage y redirige a /Login', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/Home');
    await expect(modal(page)).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await page.waitForURL(/\/Login/);

    // Nota: el addInitScript re-crea CurrentSession en cada carga, por lo que
    // se valida la limpieza con ListCompanies (borrada por el logout y no re-creada)
    const listCompanies = await page.evaluate(() => localStorage.getItem('ListCompanies'));
    expect(listCompanies).toBeNull();
  });
});
