export type Page = 'home' | 'skeleton' | 'export' | 'my-skeletons'
export type NavigateFn = (page: Page, caseId?: string) => void

