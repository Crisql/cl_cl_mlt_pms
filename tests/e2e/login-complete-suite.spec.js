// LOGIN — Suite E2E completa (paridad con Angular legacy)
// Referencia: docs/migration/comparisons/LOGIN-COMPLETE-ANALYSIS.md
const { test, expect } = require('@playwright/test');

const CURRENT_YEAR = new Date().getFullYear();

// Token de prueba con la forma real de IToken (se guarda COMPLETO en CurrentSession)
const FAKE_TOKEN = {
  access_token: 'fake-token-abc123',
  ExpireTime: '2099-12-31T23:59:59',
  UserEmail: 'test@clavisco.com',
  Licence: ''
};

/** Mockea POST /api/token con éxito y captura el request */
async function mockTokenSuccess(page, captured) {
  await page.route('**/api/token', async (route) => {
    captured.request = route.request();
    captured.body = route.request().postDataJSON();
    captured.headers = route.request().headers();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_TOKEN) });
  });
}

test.describe('Login - Carga inicial', () => {
  test('Muestra logo, campos, botón y links', async ({ page }) => {
    await page.goto('/Login');

    await expect(page.locator('img[alt="Logo"]')).toBeVisible();
    await expect(page.locator('#loginUser')).toBeVisible();
    await expect(page.locator('#loginPass')).toBeVisible();
    await expect(page.locator('#loginPass')).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await expect(page.locator('a:has-text("¿Olvidó su contraseña?")')).toBeVisible();
    await expect(page.locator('a:has-text("Cambiar contraseña")')).toBeVisible();
    await expect(page.getByText(`© ${CURRENT_YEAR} Clavis Consultores`).first()).toBeVisible();
  });
});

test.describe('Login - Validaciones (toasts exactos del legacy)', () => {
  test('Form vacío → "Por favor complete el formulario antes de enviarlo"', async ({ page }) => {
    await page.goto('/Login');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('#toast-container')).toContainText('Por favor complete el formulario antes de enviarlo');
  });

  test('Email inválido → mensaje de formato', async ({ page }) => {
    await page.goto('/Login');
    await page.fill('#loginUser', 'no-es-un-email');
    await page.fill('#loginPass', 'password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('#toast-container')).toContainText('Correo en formato inválido. Sugerencia: micorreo@ejemplo.com');
  });

  test('Contraseña < 8 caracteres → mensaje de longitud', async ({ page }) => {
    await page.goto('/Login');
    await page.fill('#loginUser', 'user@clavisco.com');
    await page.fill('#loginPass', 'corta');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('#toast-container')).toContainText('La longitud de la contraseña debe tener 8 caracteres');
  });
});

test.describe('Login - Toggle visibilidad de contraseña', () => {
  test('Alterna entre password y text', async ({ page }) => {
    await page.goto('/Login');
    const toggle = page.locator('[data-action*="toggleLoginPassword"], [data-login-target="loginPassToggle"]').first();

    await expect(page.locator('#loginPass')).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(page.locator('#loginPass')).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(page.locator('#loginPass')).toHaveAttribute('type', 'password');
  });
});

test.describe('Login - Contrato API (POST /api/token)', () => {
  test('Envía body JSON {UserName, Password} + header Cl-Recaptcha-Token y guarda CurrentSession base64', async ({ page }) => {
    const captured = {};
    await mockTokenSuccess(page, captured);

    await page.goto('/Login');
    await page.fill('#loginUser', 'user@clavisco.com');
    await page.fill('#loginPass', 'password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // Redirección a /Home (PathToRedirect default)
    await page.waitForURL(/\/Home/);

    // Contrato exacto del body (CORE)
    expect(captured.body).toEqual({ UserName: 'user@clavisco.com', Password: 'password123' });
    expect(captured.headers['content-type']).toContain('application/json');
    // El header debe existir (vacío si recaptcha no resolvió, igual que of("") en legacy)
    expect(captured.headers).toHaveProperty('cl-recaptcha-token');
    // El endpoint de token NO lleva Authorization (AppInterceptor lo excluye)
    expect(captured.headers).not.toHaveProperty('authorization');

    // Sesión guardada COMO EL LEGACY: objeto completo en base64(JSON)
    const stored = await page.evaluate(() => localStorage.getItem('CurrentSession'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(Buffer.from(stored, 'base64').toString())).toEqual(FAKE_TOKEN);
  });

  test('Respeta redirectURL tras login exitoso', async ({ page }) => {
    const captured = {};
    await mockTokenSuccess(page, captured);

    await page.goto('/Login?redirectURL=%2FLots');
    await page.fill('#loginUser', 'user@clavisco.com');
    await page.fill('#loginPass', 'password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await page.waitForURL(/\/Lots/);
  });

  test('Error 401 → toast con Message del API', async ({ page }) => {
    await page.route('**/api/token', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ Message: 'Usuario o contraseña incorrecto', Code: 401 })
      })
    );

    await page.goto('/Login');
    await page.fill('#loginUser', 'user@clavisco.com');
    await page.fill('#loginPass', 'password-mala');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.locator('#toast-container')).toContainText('Usuario o contraseña incorrecto');
    // No se guardó sesión ni se navegó
    expect(await page.evaluate(() => localStorage.getItem('CurrentSession'))).toBeNull();
    expect(page.url()).toContain('/Login');
  });

  test('Respuesta 200 sin access_token → toast de error, sin sesión', async ({ page }) => {
    await page.route('**/api/token', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Message: 'Cuenta bloqueada' }) })
    );

    await page.goto('/Login');
    await page.fill('#loginUser', 'user@clavisco.com');
    await page.fill('#loginPass', 'password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.locator('#toast-container')).toContainText('Cuenta bloqueada');
    expect(await page.evaluate(() => localStorage.getItem('CurrentSession'))).toBeNull();
  });
});

test.describe('Login - Vista enviar correo de recuperación', () => {
  test('Navega a la vista, botón deshabilitado hasta email válido, y vuelve a login', async ({ page }) => {
    await page.goto('/Login');
    await page.locator('a:has-text("¿Olvidó su contraseña?")').click();

    // replaceState → #recovery (adaptación del /#/recovery legacy)
    expect(page.url()).toContain('recovery');

    await expect(page.locator('#userEmail')).toBeVisible();
    const sendButton = page.getByRole('button', { name: 'Enviar correo de recuperación' });
    await expect(sendButton).toBeDisabled();

    await page.fill('#userEmail', 'email-invalido');
    await expect(sendButton).toBeDisabled();

    await page.fill('#userEmail', 'user@clavisco.com');
    await expect(sendButton).toBeEnabled();

    // Link vuelve a login y resetea formularios (texto legacy literal)
    await page.locator('a:has-text("Iniciar de sesión")').click();
    await expect(page.locator('#loginUser')).toBeVisible();
    expect(page.url()).toContain('login');
  });

  test('Contrato API: GET /api/Users/RecoverPassword/{email}', async ({ page }) => {
    let capturedUrl = null;
    await page.route('**/api/Users/RecoverPassword/**', (route) => {
      capturedUrl = route.request().url();
      expect(route.request().method()).toBe('GET');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Message: 'Correo enviado' }) });
    });

    await page.goto('/Login');
    await page.locator('a:has-text("¿Olvidó su contraseña?")').click();
    await page.fill('#userEmail', 'user@clavisco.com');
    await page.getByRole('button', { name: 'Enviar correo de recuperación' }).click();

    await expect.poll(() => capturedUrl).toContain('/api/Users/RecoverPassword/user@clavisco.com');
    // Éxito → ShowAlert (modal) y vuelve a vista login
    await expect(page.getByText('Correo enviado')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.locator('#loginUser')).toBeVisible();
  });
});

test.describe('Login - Vista cambiar contraseña', () => {
  test('Campos, validación notEqual y botón deshabilitado', async ({ page }) => {
    await page.goto('/Login');
    await page.locator('a:has-text("Cambiar contraseña")').click();

    expect(page.url()).toContain('change-password');

    await expect(page.locator('#cp-user-email')).toBeVisible();
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    const changeButton = page.getByRole('button', { name: 'Cambiar contraseña' });
    await expect(changeButton).toBeDisabled();

    await page.fill('#cp-user-email', 'user@clavisco.com');
    await page.fill('#currentPassword', 'actual12345');
    await page.fill('#newPassword', 'nueva12345');
    await page.fill('#confirmPassword', 'distinta12345');
    // Passwords no coinciden → error notEqual visible y botón deshabilitado
    await expect(page.locator('[data-login-target="cpNotEqualError"]')).toBeVisible();
    await expect(changeButton).toBeDisabled();

    await page.fill('#confirmPassword', 'nueva12345');
    await expect(changeButton).toBeEnabled();
  });

  test('Contrato API: PATCH /api/Users/ChangePassword {oldPassword,newPassword,email}', async ({ page }) => {
    const captured = {};
    await page.route('**/api/Users/ChangePassword', (route) => {
      captured.method = route.request().method();
      captured.body = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Message: 'Contraseña actualizada' }) });
    });

    await page.goto('/Login');
    await page.locator('a:has-text("Cambiar contraseña")').click();
    await page.fill('#cp-user-email', 'user@clavisco.com');
    await page.fill('#currentPassword', 'actual12345');
    await page.fill('#newPassword', 'nueva12345');
    await page.fill('#confirmPassword', 'nueva12345');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect.poll(() => captured.method).toBe('PATCH');
    expect(captured.body).toEqual({
      oldPassword: 'actual12345',
      newPassword: 'nueva12345',
      email: 'user@clavisco.com'
    });
    // Éxito → ShowAlert y vuelta a login
    await expect(page.getByText('Contraseña actualizada')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.locator('#loginUser')).toBeVisible();
  });
});

test.describe('Login - Vista recuperar contraseña (por token de email)', () => {
  test('Query param ?token=... activa la vista recover', async ({ page }) => {
    await page.goto('/Login?token=temporal-token-xyz');

    await expect(page.locator('#rp-newPassword')).toBeVisible();
    await expect(page.locator('#rp-confirmPassword')).toBeVisible();
    await expect(page.locator('#loginUser')).not.toBeVisible();
    expect(page.url()).toContain('recovery');
  });

  test('Contrato API: PATCH /api/Users/ChangeRecoverPassword con Bearer temporal y body {password}', async ({ page }) => {
    const captured = {};
    await page.route('**/api/Users/ChangeRecoverPassword', (route) => {
      captured.method = route.request().method();
      captured.body = route.request().postDataJSON();
      captured.auth = route.request().headers()['authorization'];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Message: 'Contraseña actualizada' }) });
    });

    await page.goto('/Login?token=temporal-token-xyz');
    await page.fill('#rp-newPassword', 'nueva12345');
    await page.fill('#rp-confirmPassword', 'nueva12345');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect.poll(() => captured.method).toBe('PATCH');
    expect(captured.body).toEqual({ password: 'nueva12345' });
    expect(captured.auth).toBe('Bearer temporal-token-xyz');
  });
});

test.describe('Login - API real (clv)', () => {
  test('Credenciales inválidas → toast del API real', async ({ page }) => {
    await page.goto('/Login');
    await page.fill('#loginUser', 'smoke@test.invalid');
    await page.fill('#loginPass', 'invalida123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // El API clv real responde 401 {"Message":"Usuario o contraseña incorrecto"}
    await expect(page.locator('#toast-container')).toContainText('Usuario o contraseña incorrecto', { timeout: 20000 });
  });

  test('Login real exitoso (requiere CLV_TEST_USER/CLV_TEST_PASSWORD)', async ({ page }) => {
    test.skip(!process.env.CLV_TEST_USER || !process.env.CLV_TEST_PASSWORD, 'Sin credenciales de prueba clv');

    await page.goto('/Login');
    await page.fill('#loginUser', process.env.CLV_TEST_USER);
    await page.fill('#loginPass', process.env.CLV_TEST_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await page.waitForURL(/\/Home/, { timeout: 30000 });
    const stored = await page.evaluate(() => localStorage.getItem('CurrentSession'));
    const session = JSON.parse(Buffer.from(stored, 'base64').toString());
    expect(session.access_token).toBeTruthy();
    expect(session.ExpireTime).toBeTruthy();
  });
});
