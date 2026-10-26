import { expect, type Page } from '@playwright/test'

/** Signs in through the Auth emulator (fake Google account), skipping the Google popup. */
export async function signIn(page: Page, email: string, name?: string) {
  await page.goto('/login')
  await page.waitForFunction(() => typeof window.__pblTestSignIn === 'function')
  await page.evaluate(([e, n]) => window.__pblTestSignIn!(e!, n), [
    email,
    name,
  ] as const)
  await expect(page).not.toHaveURL(/\/login$/)
}

export async function signInAt(page: Page, path: string, email: string) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login$/)
  await page.waitForFunction(() => typeof window.__pblTestSignIn === 'function')
  await page.evaluate((e) => window.__pblTestSignIn!(e), email)
}
