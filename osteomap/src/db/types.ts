export type SegmentState = 'present' | 'absent' | 'pathological';

export type AgeGroup = 'infant' | 'child' | 'adolescent' | 'adult';

export interface SiteRecord {
    siteId: string;
    siteName: string;
}

export interface ContextRecord {
    contextId: string;
    contextName: string;
    siteId: string;
}

export interface CaseRecord {
    caseId: string;
    caseName: string;
    dateCreated: string;
    dateModified: string;
    fieldNotes: string;
    sex: string;
    ageGroup: AgeGroup;
    segmentStates: Record<string, SegmentState>;
    contextId: string;
}

export interface NewCaseRecord {
    caseName: string;
    sex: string;
    fieldNotes?: string;
    ageGroup: AgeGroup;
}