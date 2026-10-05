import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../db/db'

// Runs after every test: remove anything rendered and empty the fake database,
// so each test starts fresh
afterEach(async () => {
  cleanup()
  await Promise.all(db.tables.map((table) => table.clear()))
})
