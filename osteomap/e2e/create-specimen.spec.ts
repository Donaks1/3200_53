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
  await page.getByLabel('Specimen age group').selectOption('adolescent')
  await page.getByLabel('Specimen field notes').fill('Left femur recovered')
  await page.getByRole('button', { name: 'Save metadata' }).click()
  await expect(page.getByRole('button', { name: 'SK-001' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Test Site' }).click()
  await page.getByRole('button', { name: 'Context 1' }).click()
  await expect(page.getByRole('button', { name: 'SK-001' })).toBeVisible()

  await page.getByRole('button', { name: 'View All Skeletons' }).click()
  await expect(page.getByRole('heading', { name: 'SK-001' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit skeleton' }).click()
  await expect(page.getByRole('textbox', { name: 'Skeleton ID' })).toHaveValue('SK-001')
  await expect(page.getByRole('combobox', { name: 'Sex' })).toHaveValue('male')
  await expect(page.getByRole('combobox', { name: 'Age group' })).toHaveValue('adolescent')
  await expect(page.getByRole('textbox', { name: 'General notes' })).toHaveValue('Left femur recovered')
})
