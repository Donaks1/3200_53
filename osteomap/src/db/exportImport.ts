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

export async function importDatabaseCSV(file: Blob): Promise<void> {
    const text = await file.text();
    const rows = parseCsvRow(text);

    if (rows.length < 2) {
        console.error("CSV file is empty or does not contain enough data.");
        return;
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

    await db.transaction('rw', db.sites, db.contexts, db.cases, async () => {
        await db.sites.bulkPut(Array.from(siteMap.values()));
        await db.contexts.bulkPut(Array.from(contextMap.values()));
        await db.cases.bulkPut(Array.from(caseMap.values()));
    });
}
