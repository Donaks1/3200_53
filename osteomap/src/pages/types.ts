export type Page = 'home' | 'skeleton' | 'export'
export type NavigateFn = (page: Page, caseId?: string) => void
