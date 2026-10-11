import { DuplicateNameError } from './names'

export const LOAD_ERROR_MESSAGE = "Your records couldn't be read from this device's storage. Try reloading the app."

// What to tell someone when a change couldn't be stored. A clashing name is
// theirs to fix, so it is explained as it is. Anything else is the device's
// storage refusing the write, which they can only free space for or retry.
export function saveErrorMessage(error: unknown): string {
  if (error instanceof DuplicateNameError) return error.message

  // Dexie reports a full disk itself, or as the reason a transaction aborted.
  const failure = error as { name?: string; inner?: { name?: string } } | null
  if (failure?.name === 'QuotaExceededError' || failure?.inner?.name === 'QuotaExceededError') {
    return "This device is out of storage space, so the change wasn't saved. Free up some space and try again."
  }
  return "The change couldn't be saved on this device. Please try again."
}
