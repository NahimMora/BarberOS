import { test, expect } from '@playwright/test'

// Local smoke test (see docs/QA_CHECKLIST.md): needs a real Supabase
// project with the 3 demo accounts seeded (`npm run db:seed`) — does not
// run in GitHub Actions CI, which has no real Supabase connection.
async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/contraseña/i).fill(password)
  await page.getByRole('button', { name: /ingresar/i }).click()
}

test('admin logs in and reaches the dashboard', async ({ page }) => {
  await login(page, 'admin@demo.com', 'demo1234')
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
})

test('a barber is blocked from an admin-only route', async ({ page }) => {
  await login(page, 'barbero@demo.com', 'demo1234')
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

  await page.goto('/operacion')
  await expect(page).not.toHaveURL(/\/operacion/)
})
