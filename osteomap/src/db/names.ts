// Names are compared the way people read them: ignoring capitals and the
// spaces around them, so "SK-001" and "sk-001 " name the same specimen.
export function normaliseName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function sameName(a: string, b: string): boolean {
  return normaliseName(a) === normaliseName(b)
}

export type NamedRecord = 'site' | 'context' | 'specimen'

// Where each kind of name has to be unique: across every site, among one
// site's contexts, and among one context's specimens.
const UNIQUE_WITHIN: Record<NamedRecord, string> = {
  site: '',
  context: ' in this site',
  specimen: ' in this context',
}

export function duplicateNameMessage(kind: NamedRecord, name: string): string {
  return `A ${kind} called "${name.trim()}" already exists${UNIQUE_WITHIN[kind]}.`
}

// Thrown when a site, context or specimen would take a name already in use
// where it has to be unique.
export class DuplicateNameError extends Error {
  constructor(kind: NamedRecord, name: string) {
    super(duplicateNameMessage(kind, name))
    this.name = 'DuplicateNameError'
  }
}
