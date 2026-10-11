// Asks the browser to keep this app's records even when the device runs low on
// space, which it may otherwise clear without asking. Browsers decide for
// themselves (Chrome grants it to installed or frequently used apps, Firefox
// asks the person, Safari goes by use), so a refusal is not an error: it is
// asked again on the next launch, and exports remain the backup either way.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
