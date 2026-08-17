import { db } from "./db";
import type { CaseRecord, NewCaseRecord } from "./types";

export async function createCase(contextId: string, input: NewCaseRecord): Promise<CaseRecord> {
    const newCase: CaseRecord = {
        caseId: crypto.randomUUID(),
        contextId,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        fieldNotes: input.fieldNotes ?? '',
        caseName: input.caseName,
        sex: input.sex,
        ageGroup: input.ageGroup,
        segmentStates: {},
    };

    await db.cases.add(newCase);
    return newCase;
}

export async function updateSegmentState(caseId: string, segmentId: string, newState: CaseRecord['segmentStates'][string]): Promise<void> {
    const existingCase = await db.cases.get(caseId);
    if (!existingCase) throw new Error("Case not found");

    existingCase.segmentStates[segmentId] = newState;
    existingCase.dateModified = new Date().toISOString();

    await db.cases.put(existingCase);
}

export async function updateCaseMetadata(caseId: string, updates: Partial<Omit<CaseRecord, 'caseId' | 'contextId' | 'segmentStates'>>): Promise<void> {
    const existingCase = await db.cases.get(caseId);
    if (!existingCase) throw new Error("Case not found");

    Object.assign(existingCase, updates);
    existingCase.dateModified = new Date().toISOString();

    await db.cases.put(existingCase);
}

export async function getCase(caseId: string): Promise<CaseRecord | undefined> {
    return db.cases.get(caseId);
}

export async function getAllCases(): Promise<CaseRecord[]> {
    return db.cases.toArray();
}

export async function getCasesByContext(contextId: string): Promise<CaseRecord[]> {
    return db.cases.where('contextId').equals(contextId).toArray();
}

export async function deleteCase(caseId: string): Promise<void> {
    await db.cases.delete(caseId);
}