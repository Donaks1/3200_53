// import { saveAs } from "file-saver";
// import { db } from "./db";
// import { exportDB } from "dexie-export-import";

// export async function exportDatabase(): Promise<void> {
//     try {
//         const blob = await exportDB(db);
//         saveAs(blob, "osteomap_database.json");
//     } catch (error) {
//         console.error("Error exporting database:", error);
//     }
// }

// export async function exportSingleCase(caseId: string): Promise<void> {
//     try {
//         const caseRecord = await db.cases.get(caseId);
//         if (!caseRecord) {
//             throw new Error(`Case with ID ${caseId} not found.`);
//         }

//         const contextRecord = await db.contexts.get(caseRecord.contextId);
//         const siteRecord = contextRecord ? await db.sites.get(contextRecord.siteId) : undefined;

//         const blob = await exportDB(db, {
//             filter: (tableName, value) => {
//                 if (tableName === "cases") return value.caseId === caseId;
//                 if (tableName === "contexts") return value.contextId === caseRecord.contextId;
//                 if (tableName === "sites") return value.siteId === siteRecord?.siteId;
//                 return false;
//             }
//         });
//         saveAs(blob, `osteomap_case_${caseRecord.caseName}.json`);
//     } catch (error) {
//         console.error("Error exporting single case:", error);
//     }
// }


// export async function importDatabase(file: Blob): Promise<void> {
//     try {
//         await db.import(file, {
//             clearTablesBeforeImport: false,
//             overwriteValues: true,
//         });
//         console.log("Database imported successfully.");
//     } catch (error) {
//         console.error("Error importing database:", error);
//     }
// }


import { saveAs } from "file-saver";
import { db } from "./db";
import { createId } from "./id";
import type { CaseRecord, ContextRecord, SiteRecord, SegmentState } from "./types";

const CSV_HEADERS = [
    'siteId', 'siteName',
    'contextId', 'contextName',
    'caseId', 'caseName',
    'dateCreated', 'dateModified', 'fieldNotes', 'sex', 'ageGroup',
    'segmentId', 'segmentState'
];

function escapeCsv(value: string): string {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function toCsvRow(fields: string[]): string {
    return fields.map(escapeCsv).join(',');
}

function caseToCsvRows(caseRecord: CaseRecord, contextRecord: ContextRecord | undefined, siteRecord: SiteRecord | undefined): string[] {
    const base = [
        siteRecord?.siteId || '',
        siteRecord?.siteName || '',
        contextRecord?.contextId || '',
        contextRecord?.contextName || '',
        caseRecord.caseId,
        caseRecord.caseName,
        caseRecord.dateCreated,
        caseRecord.dateModified,
        caseRecord.fieldNotes || '',
        caseRecord.sex || '',
        caseRecord.ageGroup || ''
    ];

    const segmentEntries = Object.entries(caseRecord.segmentStates);

    if (segmentEntries.length === 0) {
        return [toCsvRow([...base, '', ''])];
    }

    return segmentEntries.map(([segmentId, segmentState]) => toCsvRow([...base, segmentId, segmentState]));
}

export async function exportSingleCaseCSV(caseId: string): Promise<void> {
    try {
        const caseRecord = await db.cases.get(caseId);
        if (!caseRecord) {
            throw new Error(`Case with ID ${caseId} not found.`);
        }

        const contextRecord = await db.contexts.get(caseRecord.contextId);
        const siteRecord = contextRecord ? await db.sites.get(contextRecord.siteId) : undefined;

        const csvRows = [toCsvRow(CSV_HEADERS), ...caseToCsvRows(caseRecord, contextRecord, siteRecord)];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        saveAs(blob, `osteomap_case_${caseRecord.caseName}.csv`);
    } catch (error) {
        console.error("Error exporting single case to CSV:", error);
    }
}

export async function exportDatabaseCSV(): Promise<void> {
    try {
        const [sites, contexts, cases] = await Promise.all([
            db.sites.toArray(),
            db.contexts.toArray(),
            db.cases.toArray()
        ]);

        const contextMap = new Map(contexts.map(ctx => [ctx.contextId, ctx]));
        const siteMap = new Map(sites.map(site => [site.siteId, site]));

        const csvRows = [toCsvRow(CSV_HEADERS)];
        for (const caseRecord of cases) {
            const contextRecord = contextMap.get(caseRecord.contextId);
            const siteRecord = contextRecord ? siteMap.get(contextRecord.siteId) : undefined;
            csvRows.push(...caseToCsvRows(caseRecord, contextRecord, siteRecord));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        saveAs(blob, "osteomap_database.csv");
    } catch (error) {
        console.error("Error exporting database to CSV:", error);
    }
}

function parseCsvRow(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"' && text[i + 1] === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(current);
                current = '';
            } else if (char === '\n' || char === '\r') {
                if (current || row.length > 0) {
                    row.push(current);
                    rows.push(row);
                    row = [];
                    current = '';
                }
                if (char === '\r' && text[i + 1] === '\n') {
                    i++;
                }
            } else {
                current += char;
            }
        }
    }
    if (current || row.length > 0) {
        row.push(current);
        rows.push(row);
    }
    return rows;
}

function normaliseName(name: string): string {
    return name.trim().toLocaleLowerCase();
}

function getAvailableName(name: string, takenNames: Set<string>): string {
    const baseName = name.replace(/\s*\(\d+\)$/, '');
    let counter = 1;
    while (takenNames.has(normaliseName(`${baseName}(${counter})`))) {
        counter++;
    }
    return `${baseName}(${counter})`;
}

function getRequiredColumnIndexes(header: string[]) {
    const col = (name: string) => header.indexOf(name);
    const idx = {
        siteId: col('siteId'),
        siteName: col('siteName'),
        contextId: col('contextId'),
        contextName: col('contextName'),
        caseId: col('caseId'),
        caseName: col('caseName'),
        dateCreated: col('dateCreated'),
        dateModified: col('dateModified'),
        fieldNotes: col('fieldNotes'),
        sex: col('sex'),
        ageGroup: col('ageGroup'),
        segmentId: col('segmentId'),
        segmentState: col('segmentState')
    };

    if (Object.values(idx).some((index) => index < 0)) {
        throw new Error("The CSV file is missing required columns.");
    }

    return idx;
}

export interface ParsedImport {
    sites: SiteRecord[];
    contexts: ContextRecord[];
    cases: CaseRecord[];
}

export type ImportPreview = ParsedImport & {
    existingSites: SiteRecord[];
    existingContexts: ContextRecord[];
};

export type ImportChoices = {
    sites: Record<string, string>;
    contexts: Record<string, string>;
};

export type ConflictResolution = 'rename' | 'replace' | 'skip';

export interface ImportConflict {
    incoming: CaseRecord;
    existing: CaseRecord;
    suggestedName: string;
}

export interface ImportResult {
    sitesCreated: number;
    contextsCreated: number;
    casesImported: number;
    casesSkipped: number;
    casesReplaced: number;
}

interface ImportPlan {
    siteIdMap: Map<string, string>;
    contextIdMap: Map<string, string>;
    newSites: SiteRecord[];
    newContexts: ContextRecord[];
}

function buildImportPlan(
    parsed: ParsedImport,
    choices: ImportChoices,
    existingSites: SiteRecord[],
    existingContexts: ContextRecord[]
): ImportPlan {
    const siteIdMap = new Map<string, string>();
    const contextIdMap = new Map<string, string>();
    const newSites: SiteRecord[] = [];
    const newContexts: ContextRecord[] = [];

    const existingSiteById = new Map(existingSites.map((site) => [site.siteId, site]));
    const existingContextById = new Map(existingContexts.map((context) => [context.contextId, context]));

    for (const site of parsed.sites) {
        const chosenSiteId = choices.sites[site.siteId];
        if (existingSiteById.has(site.siteId)) {
            siteIdMap.set(site.siteId, site.siteId);
            continue;
        }

        if (chosenSiteId && existingSiteById.has(chosenSiteId)) {
            siteIdMap.set(site.siteId, chosenSiteId);
            continue;
        }

        siteIdMap.set(site.siteId, site.siteId);
        newSites.push(site);
        existingSiteById.set(site.siteId, site);
    }

    for (const context of parsed.contexts) {
        const targetSiteId = siteIdMap.get(context.siteId);
        if (!targetSiteId) {
            throw new Error(`Site missing for context ${context.contextName}.`);
        }

        const chosenContextId = choices.contexts[context.contextId];
        const matchingContext = existingContextById.get(context.contextId);

        if (matchingContext) {
            if (matchingContext.siteId !== targetSiteId) {
                throw new Error(`Context ${context.contextName} belongs to a different site in this database.`);
            }
            contextIdMap.set(context.contextId, context.contextId);
            continue;
        }

        const chosenContext = chosenContextId ? existingContextById.get(chosenContextId) : undefined;
        if (chosenContext) {
            if (chosenContext.siteId !== targetSiteId) {
                throw new Error(`Selected context for ${context.contextName} is not in the chosen site.`);
            }
            contextIdMap.set(context.contextId, chosenContextId);
            continue;
        }

        contextIdMap.set(context.contextId, context.contextId);
        const contextToCreate = { ...context, siteId: targetSiteId };
        newContexts.push(contextToCreate);
        existingContextById.set(context.contextId, contextToCreate);
    }

    return { siteIdMap, contextIdMap, newSites, newContexts };
}

function buildConflicts(
    parsed: ParsedImport,
    choices: ImportChoices,
    existingSites: SiteRecord[],
    existingContexts: ContextRecord[],
    existingCases: CaseRecord[]
): { conflicts: ImportConflict[]; contextIdMap: Map<string, string> } {
    const { contextIdMap } = buildImportPlan(parsed, choices, existingSites, existingContexts);

    const existingCaseById = new Map(existingCases.map((caseRecord) => [caseRecord.caseId, caseRecord]));
    const existingCaseByContextName = new Map<string, CaseRecord>();
    const namesByContext = new Map<string, Set<string>>();

    const getNames = (contextId: string): Set<string> => {
        if (!namesByContext.has(contextId)) {
            namesByContext.set(contextId, new Set());
        }
        return namesByContext.get(contextId)!;
    };

    for (const existingCase of existingCases) {
        const key = `${existingCase.contextId}::${normaliseName(existingCase.caseName)}`;
        if (!existingCaseByContextName.has(key)) {
            existingCaseByContextName.set(key, existingCase);
        }
        getNames(existingCase.contextId).add(normaliseName(existingCase.caseName));
    }

    for (const incomingCase of parsed.cases) {
        const mappedContextId = contextIdMap.get(incomingCase.contextId);
        if (mappedContextId) {
            getNames(mappedContextId).add(normaliseName(incomingCase.caseName));
        }
    }

    const conflicts: ImportConflict[] = [];
    for (const incomingCase of parsed.cases) {
        const mappedContextId = contextIdMap.get(incomingCase.contextId);
        if (!mappedContextId) {
            throw new Error(`Context missing for case ${incomingCase.caseName}.`);
        }

        const remappedIncoming: CaseRecord = { ...incomingCase, contextId: mappedContextId };
        const duplicateById = existingCaseById.get(incomingCase.caseId);
        const duplicateByName = existingCaseByContextName.get(`${mappedContextId}::${normaliseName(incomingCase.caseName)}`);
        const existingCase = duplicateById ?? duplicateByName;

        if (!existingCase) {
            continue;
        }

        const names = getNames(mappedContextId);
        const suggestedName = getAvailableName(incomingCase.caseName, names);
        names.add(normaliseName(suggestedName));

        conflicts.push({
            incoming: remappedIncoming,
            existing: existingCase,
            suggestedName
        });
    }

    return { conflicts, contextIdMap };
}

function toParsedImport(fileText: string): ParsedImport {
    const rows = parseCsvRow(fileText);

    if (rows.length < 2) {
        throw new Error("The CSV file has no records to import.");
    }

    const header = rows[0];
    const idx = getRequiredColumnIndexes(header);

    const siteMap = new Map<string, SiteRecord>();
    const contextMap = new Map<string, ContextRecord>();
    const caseMap = new Map<string, CaseRecord>();

    for (const row of rows.slice(1)) {
        const siteId = row[idx.siteId];
        const contextId = row[idx.contextId];
        const caseId = row[idx.caseId];
        if (!caseId) continue;

        if (siteId && !siteMap.has(siteId)) {
            siteMap.set(siteId, { siteId, siteName: row[idx.siteName] });
        }

        if (contextId && !contextMap.has(contextId)) {
            contextMap.set(contextId, { contextId, contextName: row[idx.contextName], siteId });
        }

        if (!caseMap.has(caseId)) {
            caseMap.set(caseId, {
                caseId,
                caseName: row[idx.caseName],
                dateCreated: row[idx.dateCreated],
                dateModified: row[idx.dateModified],
                fieldNotes: row[idx.fieldNotes],
                sex: row[idx.sex],
                ageGroup: row[idx.ageGroup] as CaseRecord['ageGroup'],
                segmentStates: {},
                contextId
            });
        }

        const segmentId = row[idx.segmentId];
        const segmentState = row[idx.segmentState] as SegmentState;
        if (segmentId && segmentState) {
            caseMap.get(caseId)!.segmentStates[segmentId] = segmentState;
        }
    }

    if (!caseMap.size) {
        throw new Error("The CSV file has no cases to import.");
    }

    return {
        sites: Array.from(siteMap.values()),
        contexts: Array.from(contextMap.values()),
        cases: Array.from(caseMap.values())
    };
}

export async function parseImportCSV(file: Blob): Promise<ParsedImport> {
    const text = await file.text();
    return toParsedImport(text);
}

export async function previewDatabaseCSV(file: Blob): Promise<ImportPreview> {
    const parsed = await parseImportCSV(file);
    const [existingSites, existingContexts] = await Promise.all([
        db.sites.toArray(),
        db.contexts.toArray()
    ]);

    return {
        ...parsed,
        existingSites,
        existingContexts
    };
}

export async function findImportConflicts(preview: ImportPreview, choices: ImportChoices): Promise<ImportConflict[]> {
    const existingCases = await db.cases.toArray();
    return buildConflicts(preview, choices, preview.existingSites, preview.existingContexts, existingCases).conflicts;
}

function createUniqueCaseId(existingCaseIds: Set<string>): string {
    let newCaseId = createId();
    while (existingCaseIds.has(newCaseId)) {
        newCaseId = createId();
    }
    return newCaseId;
}

export async function applyImport(
    preview: ImportPreview,
    choices: ImportChoices,
    resolutions: Record<string, ConflictResolution>
): Promise<ImportResult> {
    return db.transaction('rw', db.sites, db.contexts, db.cases, async () => {
        const [currentSites, currentContexts, currentCases] = await Promise.all([
            db.sites.toArray(),
            db.contexts.toArray(),
            db.cases.toArray()
        ]);

        const plan = buildImportPlan(preview, choices, currentSites, currentContexts);
        const { conflicts, contextIdMap } = buildConflicts(preview, choices, currentSites, currentContexts, currentCases);
        const conflictsByCaseId = new Map(conflicts.map((conflict) => [conflict.incoming.caseId, conflict]));
        const casesToPut: CaseRecord[] = [];
        const caseIdsToDelete = new Set<string>();
        const existingCaseIds = new Set(currentCases.map((caseRecord) => caseRecord.caseId));

        let casesSkipped = 0;
        let casesReplaced = 0;

        for (const conflict of conflicts) {
            if (!resolutions[conflict.incoming.caseId]) {
                throw new Error(`Missing decision for duplicate case ${conflict.incoming.caseName}.`);
            }
        }

        for (const incomingCase of preview.cases) {
            const mappedContextId = contextIdMap.get(incomingCase.contextId);
            if (!mappedContextId) {
                throw new Error(`Context missing for case ${incomingCase.caseName}.`);
            }

            const remappedCase: CaseRecord = { ...incomingCase, contextId: mappedContextId };
            const conflict = conflictsByCaseId.get(incomingCase.caseId);

            if (!conflict) {
                casesToPut.push(remappedCase);
                existingCaseIds.add(remappedCase.caseId);
                continue;
            }

            const resolution = resolutions[incomingCase.caseId];
            if (resolution === 'skip') {
                casesSkipped++;
                continue;
            }

            if (resolution === 'rename') {
                const newCaseId = createUniqueCaseId(existingCaseIds);
                casesToPut.push({
                    ...remappedCase,
                    caseId: newCaseId,
                    caseName: conflict.suggestedName
                });
                existingCaseIds.add(newCaseId);
                continue;
            }

            if (resolution === 'replace') {
                if (conflict.existing.caseId !== remappedCase.caseId) {
                    caseIdsToDelete.add(conflict.existing.caseId);
                }
                casesToPut.push(remappedCase);
                existingCaseIds.add(remappedCase.caseId);
                casesReplaced++;
                continue;
            }

            throw new Error(`Unsupported conflict resolution for case ${incomingCase.caseName}.`);
        }

        await db.sites.bulkAdd(plan.newSites);
        await db.contexts.bulkAdd(plan.newContexts);
        await db.cases.bulkDelete(Array.from(caseIdsToDelete));
        await db.cases.bulkPut(casesToPut);

        return {
            sitesCreated: plan.newSites.length,
            contextsCreated: plan.newContexts.length,
            casesImported: casesToPut.length,
            casesSkipped,
            casesReplaced
        };
    });
}
