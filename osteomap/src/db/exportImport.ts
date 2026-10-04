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

export type ImportPreview = {
    sites: SiteRecord[];
    contexts: ContextRecord[];
    cases: CaseRecord[];
    existingSites: SiteRecord[];
    existingContexts: ContextRecord[];
};

export type ImportChoices = {
    sites: Record<string, string>;
    contexts: Record<string, string>;
};

export type ImportResult = {
    sitesCreated: number;
    contextsCreated: number;
    casesImported: number;
    casesSkipped: number;
};

export async function previewDatabaseCSV(file: Blob): Promise<ImportPreview> {
    const text = await file.text();
    const rows = parseCsvRow(text);

    if (rows.length < 2) {
        throw new Error("The CSV file has no records to import.");
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

    if (Object.values(idx).some((index) => index < 0)) {
        throw new Error("The CSV file is missing required columns.");
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

    const [existingSites, existingContexts] = await Promise.all([
        db.sites.toArray(), db.contexts.toArray()
    ]);

    if (!caseMap.size) throw new Error("The CSV file has no cases to import.");

    return {
        sites: Array.from(siteMap.values()),
        contexts: Array.from(contextMap.values()),
        cases: Array.from(caseMap.values()),
        existingSites,
        existingContexts
    };
}

export async function importDatabaseCSV(preview: ImportPreview, choices: ImportChoices): Promise<ImportResult> {
    return db.transaction('rw', db.sites, db.contexts, db.cases, async () => {
        const [currentSites, currentContexts, currentCases] = await Promise.all([
            db.sites.toArray(), db.contexts.toArray(), db.cases.toArray()
        ]);
        const siteIds = new Set(currentSites.map((site) => site.siteId));
        const contextIds = new Set(currentContexts.map((context) => context.contextId));
        const caseIds = new Set(currentCases.map((record) => record.caseId));
        const siteMap = new Map<string, string>();
        const contextMap = new Map<string, string>();
        const newSites: SiteRecord[] = [];
        const newContexts: ContextRecord[] = [];
        const newCases: CaseRecord[] = [];
        let casesSkipped = 0;
        const neededContexts = new Set(preview.cases.filter((record) => !caseIds.has(record.caseId)).map((record) => record.contextId));
        const neededSites = new Set(preview.contexts.filter((context) => neededContexts.has(context.contextId)).map((context) => context.siteId));

        for (const site of preview.sites) {
            if (!neededSites.has(site.siteId)) continue;
            const chosenId = choices.sites[site.siteId];
            if (siteIds.has(site.siteId)) {
                siteMap.set(site.siteId, site.siteId);
            } else if (chosenId && siteIds.has(chosenId)) {
                siteMap.set(site.siteId, chosenId);
            } else {
                siteMap.set(site.siteId, site.siteId);
                siteIds.add(site.siteId);
                newSites.push(site);
            }
        }

        for (const context of preview.contexts) {
            if (!neededContexts.has(context.contextId)) continue;
            const siteId = siteMap.get(context.siteId);
            if (!siteId) throw new Error(`Site missing for context ${context.contextName}.`);
            const chosenId = choices.contexts[context.contextId];
            if (contextIds.has(context.contextId)) {
                const existing = currentContexts.find((item) => item.contextId === context.contextId);
                if (existing?.siteId !== siteId) {
                    throw new Error(`Context ${context.contextName} belongs to a different site in this database.`);
                }
                contextMap.set(context.contextId, context.contextId);
            } else if (chosenId && currentContexts.some((existing) => existing.contextId === chosenId && existing.siteId === siteId)) {
                contextMap.set(context.contextId, chosenId);
            } else {
                contextMap.set(context.contextId, context.contextId);
                contextIds.add(context.contextId);
                newContexts.push({ ...context, siteId });
            }
        }

        for (const record of preview.cases) {
            if (caseIds.has(record.caseId)) {
                casesSkipped++;
                continue;
            }
            const contextId = contextMap.get(record.contextId);
            if (!contextId) throw new Error(`Context missing for case ${record.caseName}.`);
            caseIds.add(record.caseId);
            newCases.push({ ...record, contextId });
        }

        await db.sites.bulkAdd(newSites);
        await db.contexts.bulkAdd(newContexts);
        await db.cases.bulkAdd(newCases);
        return {
            sitesCreated: newSites.length,
            contextsCreated: newContexts.length,
            casesImported: newCases.length,
            casesSkipped
        };
    });
}
