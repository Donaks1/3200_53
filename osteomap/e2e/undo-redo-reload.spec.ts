// import { test, expect, type Page } from '@playwright/test'

// // Same steps as create-specimen.spec.ts, then open the specimen.
// async function openFreshSkeleton(page: Page) {
//   await page.goto('/')

//   await page.getByRole('button', { name: 'Add site' }).click()
//   await page.getByPlaceholder('Site name').fill('Test Site')
//   await page.getByRole('button', { name: 'Create site' }).click()

//   await page.getByRole('button', { name: 'Add context' }).click()
//   await page.getByPlaceholder('Context name').fill('Context 1')
//   await page.getByRole('button', { name: 'Create context' }).click()

//   await page.getByRole('button', { name: 'Add specimen' }).click()
//   await page.getByPlaceholder('Specimen ID').fill('SK-001')
//   await page.getByRole('button', { name: 'Continue specimen creation' }).click()
//   await page.getByLabel('Specimen sex').selectOption('male')
//   await page.getByLabel('Specimen age group').selectOption('adult')
//   await page.getByRole('button', { name: 'Save metadata' }).click()

//   await openSpecimen(page)
// }

// // ASSUMPTION: clicking the SK-001 button opens the skeleton page.
// async function openSpecimen(page: Page) {
//   await page.getByRole('button', { name: 'SK-001' }).click()
//   await page.getByRole('button', { name: 'Open Skeleton' }).click()
//   await expect(page.locator('.skeleton-front-layer #l_femur path').first()).toBeAttached({ timeout: 10_000 })
// }

// // After a reload the app is back on the home screen (create-specimen.spec.ts
// // does the same), so walk back to the specimen.
// async function reopenAfterReload(page: Page) {
//   await page.reload()
//   await page.getByRole('button', { name: 'Test Site' }).click()
//   await page.getByRole('button', { name: 'Context 1' }).click()
//   await openSpecimen(page)
// }

// const bone = (page: Page, id: string) => page.locator(`.skeleton-front-layer #${id}`)

// // Click a shape inside the group; clicking the <g> centre can hit a gap.
// const paintBone = (page: Page, id: string) =>
//   page.locator(`.skeleton-front-layer #${id} path`).first().click()

// // The drawer is only collapsed with CSS (max-height 0), so the buttons count as
// // "visible" to Playwright even when closed. Check aria-expanded instead.
// async function openTools(page: Page) {
//   const tools = page.getByRole('button', { name: 'Tools' })
//   if ((await tools.getAttribute('aria-expanded')) !== 'true') await tools.click()
// }

// test('colour two bones, undo, reload, redo', async ({ page }) => {
//   await openFreshSkeleton(page)

//   // Paint with the drawer closed: when open it covers the lower part of the screen.
//   await paintBone(page, 'l_femur')
//   await paintBone(page, 'r_femur')
//   await expect(bone(page, 'l_femur')).toHaveAttribute('data-paint', 'present')
//   await expect(bone(page, 'r_femur')).toHaveAttribute('data-paint', 'present')

//   await openTools(page)
//   await page.getByRole('button', { name: 'Undo' }).click()
//   await expect(bone(page, 'r_femur')).not.toHaveAttribute('data-paint', /.+/)
//   await expect(bone(page, 'l_femur')).toHaveAttribute('data-paint', 'present')

//   await reopenAfterReload(page)
//   await expect(bone(page, 'l_femur')).toHaveAttribute('data-paint', 'present')
//   await expect(bone(page, 'r_femur')).not.toHaveAttribute('data-paint', /.+/) // last colour gone

//   await openTools(page)
//   await page.getByRole('button', { name: 'Redo' }).click()
//   await expect(bone(page, 'r_femur')).toHaveAttribute('data-paint', 'present') // it's back
// })


// test('painted bones and an undo both survive a reload', async ({ page }) => {
//   await openFreshSkeleton(page)

//   await paintBone(page, 'l_femur')
//   await paintBone(page, 'r_femur')

//   await openTools(page)
//   await page.getByRole('button', { name: 'Undo' }).click()
//   await expect(bone(page, 'r_femur')).not.toHaveAttribute('data-paint', /.+/)

//   await reopenAfterReload(page)
//   await expect(bone(page, 'l_femur')).toHaveAttribute('data-paint', 'present')
//   await expect(bone(page, 'r_femur')).not.toHaveAttribute('data-paint', /.+/)
// })