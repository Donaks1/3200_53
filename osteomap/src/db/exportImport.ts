import { saveAs } from "file-saver";
import { db } from "./db";
import { createId } from "./id";
import type { CaseRecord, ContextRecord, SiteRecord, SegmentState } from "./types";
import { hierarchy } from "../pages/skeletonDrawings";
import { compareSegments, currentSegmentStates, describeSegment, zoneColumn } from "../pages/segmentNames";

const SPECIMENS_TITLE = 'SPECIMENS';
const INVENTORY_TITLE = 'INVENTORY';
const SPECIMEN_HEADERS = [
    'Specimen ID', 'Site ID', 'Context ID',
    'Site', 'Context', 'Specimen', 'Sex', 'Age Group', 'Field Notes', 'Date Created', 'Date Modified'
] as const;
const REQUIRED_SPECIMEN_HEADERS = ['Specimen ID', 'Site', 'Context', 'Specimen'] as const;
// Each INVENTORY row says what it is in words, then by the id the app knows it
// by; the specimens' states follow, one column each. Files from before the ids
// were standardised have just a "Bone" column of old ids.
const INVENTORY_HEADERS = ['Region', 'Bone', 'Side', 'Zone', 'Segment ID'] as const;
const SEGMENT_ID_HEADER = 'Segment ID';
const LEGACY_BONE_HEADER = 'Bone';
const SEGMENT_STATES: SegmentState[] = ['complete', 'absent', 'fragmentary'];

function escapeCsv(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function toCsvRow(fields: string[]): string {
    return fields.map(escapeCsv).join(',');
}

// A mark on a region (the whole skull, a hand, the spine and ribs) stands for
// every bone in it, so the export lists those bones one by one: every row is a
// single bone or zone, and rows line up from specimen to specimen however each
// was recorded. Importing the file back marks those bones, which shows the same.
function inventoryOf(states: Record<string, SegmentState>): Map<string, SegmentState> {
    const { children } = hierarchy();
    const parts = new Map<string, SegmentState>();
    const add = (id: string, state: SegmentState) => {
        const inside = children.get(id);
        if (describeSegment(id)?.kind === 'region' && inside?.length) {
            inside.forEach((part) => add(part, state));
        } else {
            parts.set(id, state);
        }
    };
    Object.entries(states).forEach(([id, state]) => add(id, state));
    return parts;
}

// The words in front of a row's states. An id this version can't read (from a
// newer drawing, say) is kept, with the region saying so.
function describeRow(id: string): string[] {
    const name = describeSegment(id);
    if (!name) return ['Not recognised', '', '', '', id];
    return [name.region, name.bone, name.side, zoneColumn(name), id];
}

interface SpecimenLabelSource {
    caseId: string;
    caseName: string;
    siteName: string;
    contextName: string;
}

function getSpecimenLabels(specimens: SpecimenLabelSource[]): string[] {
    const countBy = (keys: string[]) => keys.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map<string, number>());

    const names = specimens.map(s => s.caseName);
    const nameCounts = countBy(names.map(normaliseName));
    const withLocation = specimens.map((s, i) =>
        nameCounts.get(normaliseName(names[i]))! > 1 ? `${s.caseName} (${s.siteName} / ${s.contextName})` : s.caseName);
    const locationCounts = countBy(withLocation.map(normaliseName));

    return specimens.map((s, i) =>
        locationCounts.get(normaliseName(withLocation[i]))! > 1 ? `${withLocation[i]} [${s.caseId}]` : withLocation[i]);
}

function buildCsv(cases: CaseRecord[], contextMap: Map<string, ContextRecord>, siteMap: Map<string, SiteRecord>): string {
    const rows = [SPECIMENS_TITLE, toCsvRow([...SPECIMEN_HEADERS])];
    const labelSources: SpecimenLabelSource[] = [];
    for (const caseRecord of cases) {
        const contextRecord = contextMap.get(caseRecord.contextId);
        const siteRecord = contextRecord ? siteMap.get(contextRecord.siteId) : undefined;
        labelSources.push({
            caseId: caseRecord.caseId,
            caseName: caseRecord.caseName,
            siteName: siteRecord?.siteName || '',
            contextName: contextRecord?.contextName || ''
        });
        rows.push(toCsvRow([
            caseRecord.caseId,
            siteRecord?.siteId || '',
            contextRecord?.contextId || '',
            siteRecord?.siteName || '',
            contextRecord?.contextName || '',
            caseRecord.caseName,
            caseRecord.sex || '',
            caseRecord.ageGroup || '',
            caseRecord.fieldNotes || '',
            caseRecord.dateCreated,
            caseRecord.dateModified
        ]));
    }

    const inventories = cases.map(c => inventoryOf(c.segmentStates ?? {}));
    const segmentIds = Array.from(new Set(inventories.flatMap(inventory => [...inventory.keys()]))).sort(compareSegments);

    rows.push('', INVENTORY_TITLE, toCsvRow([...INVENTORY_HEADERS, ...getSpecimenLabels(labelSources)]));
    for (const segmentId of segmentIds) {
        rows.push(toCsvRow([...describeRow(segmentId), ...inventories.map(inventory => inventory.get(segmentId) ?? '')]));
    }
    return rows.join('\n');
}

export async function exportSingleCaseCSV(caseId: string): Promise<void> {
    try {
        const caseRecord = await db.cases.get(caseId);
        if (!caseRecord) {
            throw new Error(`Case with ID ${caseId} not found.`);
        }

        const contextRecord = await db.contexts.get(caseRecord.contextId);
        const siteRecord = contextRecord ? await db.sites.get(contextRecord.siteId) : undefined;

        const csv = buildCsv(
            [caseRecord],
            new Map(contextRecord ? [[contextRecord.contextId, contextRecord]] : []),
            new Map(siteRecord ? [[siteRecord.siteId, siteRecord]] : [])
        );
        const blob = new Blob([csv], { type: 'text/csv' });
        saveAs(blob, `osteomap_case_${caseRecord.caseName}.csv`);
    } catch (error) {
        console.error("Error exporting single case to CSV:", error);
        throw error;
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

        const blob = new Blob([buildCsv(cases, contextMap, siteMap)], { type: 'text/csv' });
        saveAs(blob, "osteomap_database.csv");
    } catch (error) {
        console.error("Error exporting database to CSV:", error);
        throw error;
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

function cell(row: string[], index: number): string {
    return (index >= 0 ? row[index] ?? '' : '').trim();
}

function isTitleRow(row: string[], title: string): boolean {
    return cell(row, 0).toUpperCase() === title && row.slice(1).every(value => !value.trim());
}

function splitTables(rows: string[][]): { specimenRows: string[][]; inventoryRows: string[][] } {
    const specimensStart = rows.findIndex(row => isTitleRow(row, SPECIMENS_TITLE));
    const inventoryStart = rows.findIndex(row => isTitleRow(row, INVENTORY_TITLE));

    if (specimensStart < 0) {
        throw new Error(`The CSV file is missing the ${SPECIMENS_TITLE} table.`);
    }

    const specimensEnd = inventoryStart > specimensStart ? inventoryStart : rows.length;
    const inventoryEnd = inventoryStart >= 0 && inventoryStart < specimensStart ? specimensStart : rows.length;

    return {
        specimenRows: rows.slice(specimensStart + 1, specimensEnd),
        inventoryRows: inventoryStart >= 0 ? rows.slice(inventoryStart + 1, inventoryEnd) : []
    };
}

function getSpecimenColumnIndexes(header: string[]) {
    const col = (name: string) => header.indexOf(name);

    const missing = REQUIRED_SPECIMEN_HEADERS.filter(name => col(name) < 0);
    if (missing.length) {
        throw new Error(`The ${SPECIMENS_TITLE} table is missing required columns: ${missing.join(', ')}.`);
    }

    return {
        caseId: col('Specimen ID'),
        siteId: col('Site ID'),
        contextId: col('Context ID'),
        siteName: col('Site'),
        contextName: col('Context'),
        caseName: col('Specimen'),
        sex: col('Sex'),
        ageGroup: col('Age Group'),
        fieldNotes: col('Field Notes'),
        dateCreated: col('Date Created'),
        dateModified: col('Date Modified')
    };
}

export interface ParsedImport {
    sites: SiteRecord[];
    contexts: ContextRecord[];
    cases: CaseRecord[];
    // Bone or zone ids in the file that none of the drawings has.
    unrecognisedSegments: string[];
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
    const { specimenRows, inventoryRows } = splitTables(parseCsvRow(fileText));

    if (specimenRows.length < 2) {
        throw new Error("The CSV file has no specimens to import.");
    }

    const idx = getSpecimenColumnIndexes(specimenRows[0].map(name => name.trim()));

    const siteMap = new Map<string, SiteRecord>();
    const contextMap = new Map<string, ContextRecord>();
    const caseMap = new Map<string, CaseRecord>();
    const generatedSiteIds = new Map<string, string>();
    const generatedContextIds = new Map<string, string>();
    const labelSources: SpecimenLabelSource[] = [];

    for (const row of specimenRows.slice(1)) {
        const caseName = cell(row, idx.caseName);
        if (!caseName) continue;

        const caseId = cell(row, idx.caseId);
        if (!caseId) {
            throw new Error(`Specimen "${caseName}" is missing its Specimen ID.`);
        }

        const siteName = cell(row, idx.siteName);
        const contextName = cell(row, idx.contextName);
        if (!siteName || !contextName) {
            throw new Error(`Specimen "${caseName}" needs both a Site and a Context.`);
        }

        const siteKey = normaliseName(siteName);
        const siteId = cell(row, idx.siteId)
            || generatedSiteIds.get(siteKey)
            || generatedSiteIds.set(siteKey, createId()).get(siteKey)!;
        const contextKey = `${siteId}::${normaliseName(contextName)}`;
        const contextId = cell(row, idx.contextId)
            || generatedContextIds.get(contextKey)
            || generatedContextIds.set(contextKey, createId()).get(contextKey)!;

        if (!siteMap.has(siteId)) {
            siteMap.set(siteId, { siteId, siteName });
        }
        if (!contextMap.has(contextId)) {
            contextMap.set(contextId, { contextId, contextName, siteId });
        }

        labelSources.push({ caseId, caseName, siteName, contextName });

        const now = new Date().toISOString();
        caseMap.set(caseId, {
            caseId,
            caseName,
            dateCreated: cell(row, idx.dateCreated) || now,
            dateModified: cell(row, idx.dateModified) || now,
            fieldNotes: cell(row, idx.fieldNotes),
            sex: cell(row, idx.sex),
            ageGroup: cell(row, idx.ageGroup) as CaseRecord['ageGroup'],
            segmentStates: {},
            contextId
        });
    }

    if (!caseMap.size) {
        throw new Error("The CSV file has no specimens to import.");
    }

    const unrecognised = new Set<string>();
    if (inventoryRows.length) {
        const [inventoryHeader, ...boneRows] = inventoryRows;
        const headers = inventoryHeader.map(name => name.trim().toLowerCase());
        const segmentIdColumn = headers.indexOf(SEGMENT_ID_HEADER.toLowerCase());
        const idColumn = segmentIdColumn >= 0 ? segmentIdColumn : headers[0] === LEGACY_BONE_HEADER.toLowerCase() ? 0 : -1;
        if (idColumn < 0) {
            throw new Error(`The ${INVENTORY_TITLE} table needs a "${SEGMENT_ID_HEADER}" column saying which bone or zone each row is.`);
        }

        const caseIdByLabel = new Map<string, string>();
        getSpecimenLabels(labelSources).forEach((label, i) => caseIdByLabel.set(normaliseName(label), labelSources[i].caseId));

        // The specimens' columns are the ones after the id.
        const specimenColumns = inventoryHeader.slice(idColumn + 1)
            .map((value, offset) => ({ label: value.trim(), index: idColumn + 1 + offset }))
            .filter(({ label }) => label)
            .map(({ label, index }) => {
                const caseId = caseIdByLabel.get(normaliseName(label)) ?? (caseMap.has(label) ? label : undefined);
                if (!caseId) {
                    throw new Error(`The ${INVENTORY_TITLE} table has a column "${label}" that doesn't match any specimen in the ${SPECIMENS_TITLE} table.`);
                }
                return { caseId, index };
            });

        for (const row of boneRows) {
            const segmentId = cell(row, idColumn);
            if (!segmentId) continue;

            for (const { caseId, index } of specimenColumns) {
                const state = cell(row, index).toLowerCase();
                if (!state) continue;
                const caseRecord = caseMap.get(caseId)!;
                if (!SEGMENT_STATES.includes(state as SegmentState)) {
                    throw new Error(`"${state}" is not a valid state for ${segmentId} on specimen "${caseRecord.caseName}" (use ${SEGMENT_STATES.join(', ')}).`);
                }
                caseRecord.segmentStates[segmentId] = state as SegmentState;
            }
        }

        // A file from an earlier version names bones by the ids they had then;
        // the records take the ids they have now. Any id no drawing has is kept
        // as it is, and the preview says so.
        const drawn = hierarchy().ids;
        for (const caseRecord of caseMap.values()) {
            caseRecord.segmentStates = currentSegmentStates(caseRecord.segmentStates);
            Object.keys(caseRecord.segmentStates).filter(id => !drawn.has(id)).forEach(id => unrecognised.add(id));
        }
    }

    return {
        sites: Array.from(siteMap.values()),
        contexts: Array.from(contextMap.values()),
        cases: Array.from(caseMap.values()),
        unrecognisedSegments: Array.from(unrecognised).sort()
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
