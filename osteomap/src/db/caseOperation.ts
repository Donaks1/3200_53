import { db } from "./db";
import type { CaseRecord, NewCaseRecord } from "./types";
import { createId } from "./id";
import { DuplicateNameError, sameName } from "./names";

// Specimen IDs are unique within their context, the way the CSV import already
// treats them. A rename that only changes capitals or spacing is always
// allowed, so specimens named alike before this rule existed stay editable.
async function caseNameTaken(contextId: string, name: string, exceptCaseId?: string): Promise<boolean> {
    const cases = await db.cases.where('contextId').equals(contextId).toArray();
    return cases.some((caseRecord) => caseRecord.caseId !== exceptCaseId && sameName(caseRecord.caseName, name));
}

export async function createCase(contextId: string, input: NewCaseRecord): Promise<CaseRecord> {
    const caseName = input.caseName.trim();
    if (!caseName) throw new Error("A specimen needs an ID.");

    return db.transaction("rw", db.cases, async () => {
        if (await caseNameTaken(contextId, caseName)) throw new DuplicateNameError("specimen", caseName);

        const newCase: CaseRecord = {
            caseId: createId(),
            contextId,
            dateCreated: new Date().toISOString(),
            dateModified: new Date().toISOString(),
            fieldNotes: input.fieldNotes ?? '',
            caseName,
            sex: input.sex,
            ageGroup: input.ageGroup,
            segmentStates: {},
        };

        await db.cases.add(newCase);
        return newCase;
    });
}

// Reads a case, changes it and writes it back as one transaction, so nothing
// else can write in between: not another save made at the same moment, which
// would otherwise be lost, and not a delete, which the write would undo.
async function changeCase(caseId: string, change: (existingCase: CaseRecord) => void): Promise<void> {
    await db.transaction("rw", db.cases, async () => {
        const existingCase = await db.cases.get(caseId);
        if (!existingCase) throw new Error("Case not found");

        change(existingCase);
        existingCase.dateModified = new Date().toISOString();

        await db.cases.put(existingCase);
    });
}

export async function updateSegmentState(caseId: string, segmentId: string, newState: CaseRecord['segmentStates'][string]): Promise<void> {
    await changeCase(caseId, (existingCase) => {
        if (!existingCase.segmentStates) existingCase.segmentStates = {};
        existingCase.segmentStates[segmentId] = newState;
    });
}

export async function removeSegmentState(caseId: string, segmentId: string): Promise<void> {
    await changeCase(caseId, (existingCase) => {
        if (existingCase.segmentStates) {
            delete existingCase.segmentStates[segmentId];
        }
    });
}

export async function setAllSegmentStates(caseId: string, segmentStates: Record<string, CaseRecord['segmentStates'][string]>): Promise<void> {
    await changeCase(caseId, (existingCase) => {
        existingCase.segmentStates = segmentStates;
    });
}


export async function updateCaseMetadata(caseId: string, updates: Partial<Omit<CaseRecord, 'caseId' | 'contextId' | 'segmentStates'>>): Promise<void> {
    await db.transaction("rw", db.cases, async () => {
        const existingCase = await db.cases.get(caseId);
        if (!existingCase) throw new Error("Case not found");

        if (updates.caseName !== undefined) {
            const caseName = updates.caseName.trim();
            if (!caseName) throw new Error("A specimen needs an ID.");
            if (!sameName(existingCase.caseName, caseName) && await caseNameTaken(existingCase.contextId, caseName, caseId)) {
                throw new DuplicateNameError("specimen", caseName);
            }
            updates = { ...updates, caseName };
        }

        Object.assign(existingCase, updates);
        existingCase.dateModified = new Date().toISOString();

        await db.cases.put(existingCase);
    });
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

export async function deleteSegmentState(caseId: string, segmentId: string): Promise<void> {
    await changeCase(caseId, (existingCase) => {
        delete existingCase.segmentStates[segmentId];
    });
}

export async function deleteCase(caseId: string): Promise<void> {
    await db.cases.delete(caseId);
}