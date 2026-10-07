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

export interface ParsedImport {
    sites: SiteRecord[];
    contexts: ContextRecord[];
    cases: CaseRecord[];
}

export type ConflictResolution = 'rename' | 'replace' | 'skip';

export interface ImportConflict {
    incoming: CaseRecord;
    existing: CaseRecord;
    // Name the incoming case will be saved as if the user chooses to keep both
    suggestedName: string;
}

function normaliseName(name: string): string {
    return name.trim().toLowerCase();
}

// Strips a trailing "(n)" so re-importing "uwa(1)" suggests "uwa(2)" rather than "uwa(1)(1)"
function getAvailableName(name: string, takenNames: Set<string>): string {
    const baseName = name.replace(/\(\d+\)$/, '');
    let counter = 1;
    while (takenNames.has(normaliseName(`${baseName}(${counter})`))) {
        counter++;
    }
    return `${baseName}(${counter})`;
}

export async function parseImportCSV(file: Blob): Promise<ParsedImport> {
    const text = await file.text();
    const rows = parseCsvRow(text);

    if (rows.length < 2) {
        throw new Error("CSV file is empty or does not contain enough data.");
    }

    const header = rows[0];
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
    }

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

    return {
        sites: Array.from(siteMap.values()),
        contexts: Array.from(contextMap.values()),
        cases: Array.from(caseMap.values())
    };
}

// A case is a duplicate if its ID already exists, or a case with the same name exists in the same context
export async function findImportConflicts(parsed: ParsedImport): Promise<ImportConflict[]> {
    const existingCases = await db.cases.toArray();
    const existingById = new Map(existingCases.map(c => [c.caseId, c]));

    const takenNamesByContext = new Map<string, Set<string>>();
    const takenNames = (contextId: string) => {
        if (!takenNamesByContext.has(contextId)) takenNamesByContext.set(contextId, new Set());
        return takenNamesByContext.get(contextId)!;
    };
    for (const c of [...existingCases, ...parsed.cases]) {
        takenNames(c.contextId).add(normaliseName(c.caseName));
    }

    const conflicts: ImportConflict[] = [];
    for (const incoming of parsed.cases) {
        const existing = existingById.get(incoming.caseId)
            ?? existingCases.find(c =>
                c.contextId === incoming.contextId &&
                normaliseName(c.caseName) === normaliseName(incoming.caseName));
        if (!existing) continue;

        const names = takenNames(incoming.contextId);
        const suggestedName = getAvailableName(incoming.caseName, names);
        // Reserve the name so two renamed cases in the same context never collide
        names.add(normaliseName(suggestedName));
        conflicts.push({ incoming, existing, suggestedName });
    }
    return conflicts;
}

// Cases without an entry in `resolutions` are not duplicates and are imported as-is
export async function applyImport(
    parsed: ParsedImport,
    conflicts: ImportConflict[],
    resolutions: Record<string, ConflictResolution>
): Promise<void> {
    const conflictByCaseId = new Map(conflicts.map(c => [c.incoming.caseId, c]));
    const casesToPut: CaseRecord[] = [];
    const caseIdsToDelete: string[] = [];

    for (const incoming of parsed.cases) {
        const conflict = conflictByCaseId.get(incoming.caseId);
        if (!conflict) {
            casesToPut.push(incoming);
            continue;
        }

        const resolution = resolutions[incoming.caseId] ?? 'skip';
        if (resolution === 'rename') {
            casesToPut.push({ ...incoming, caseId: createId(), caseName: conflict.suggestedName });
        } else if (resolution === 'replace') {
            if (conflict.existing.caseId !== incoming.caseId) {
                caseIdsToDelete.push(conflict.existing.caseId);
            }
            casesToPut.push(incoming);
        }
    }

    await db.transaction('rw', db.sites, db.contexts, db.cases, async () => {
        await db.sites.bulkPut(parsed.sites);
        await db.contexts.bulkPut(parsed.contexts);
        await db.cases.bulkDelete(caseIdsToDelete);
        await db.cases.bulkPut(casesToPut);
    });
}
