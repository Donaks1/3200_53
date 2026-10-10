import { test, expect } from '@playwright/test'

test('create a site, context and specimen, and it is still there after reload', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Add site' }).click()
  await page.getByPlaceholder('Site name').fill('Test Site')
  await page.getByRole('button', { name: 'Create site' }).click()

  await page.getByRole('button', { name: 'Add context' }).click()
  await page.getByPlaceholder('Context name').fill('Context 1')
  await page.getByRole('button', { name: 'Create context' }).click()

  await page.getByRole('button', { name: 'Add specimen' }).click()
  await page.getByPlaceholder('Specimen ID').fill('SK-001')
  await page.getByRole('button', { name: 'Continue specimen creation' }).click()
  await page.getByLabel('Specimen sex').selectOption('male')
  await page.getByLabel('Specimen age group').selectOption('adult')
  await page.getByRole('button', { name: 'Save metadata' }).click()
  // The specimen only shows up once it has been written, so wait for it before reloading
  await expect(page.getByRole('button', { name: 'SK-001' })).toBeVisible()

  // Data is saved on the device, so it should survive a reload
  await page.reload()
  await page.getByRole('button', { name: 'Test Site' }).click()
  await page.getByRole('button', { name: 'Context 1' }).click()
  await expect(page.getByRole('button', { name: 'SK-001' })).toBeVisible()
})
