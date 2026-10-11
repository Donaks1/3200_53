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


// jsdom has no CSS.escape, and SkeletonPage calls it outside any try/catch
// when you click a bone, so without this the click handler throws.
if (!globalThis.CSS?.escape) {
  Object.defineProperty(globalThis, 'CSS', {
    value: { ...(globalThis.CSS ?? {}), escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) },
    configurable: true,
  })
}

