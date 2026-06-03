// Smoke tests del setup inicial — verifican que la base de la migración
// funciona: páginas renderizan, guards redirigen y el proxy llega al API clv.
const { test, expect } = require('@playwright/test');

test.describe('Setup inicial - Smoke', () => {
  test('La página de Login carga con sus campos', async ({ page }) => {
    await page.goto('/Login');

    await expect(page.locator('#loginUser')).toBeVisible();
    await expect(page.locator('#loginPass')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('Home sin sesión redirige a /Login (réplica de ValidateSession)', async ({ page }) => {
    await page.goto('/Home');

    await page.waitForURL(/\/Login/);
    expect(page.url()).toContain('/Login');
  });

  test('La raíz redirige a /Home (réplica de redirectTo)', async ({ page }) => {
    const response = await page.goto('/');
    // Sin sesión: / → /Home → guard → /Login
    await page.waitForURL(/\/Login/);
    expect(response.ok()).toBeTruthy();
  });

  test('El proxy /api/* llega al API del cliente clv', async ({ request }) => {
    // Login inválido a propósito: si el API responde (aunque sea 4xx con
    // estructura de error), el proxy está funcionando end-to-end.
    const response = await request.post('/api/token', {
      headers: { 'Content-Type': 'application/json', 'Cl-Recaptcha-Token': '' },
      data: { UserName: 'smoke@test.invalid', Password: 'invalid' }
    });

    // Gateway errors (502/504) indicarían proxy roto; el API real responde
    // 400/401/403 ante credenciales inválidas.
    expect([502, 504]).not.toContain(response.status());
  });
});
