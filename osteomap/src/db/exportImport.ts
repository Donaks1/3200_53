import { saveAs } from "file-saver";
import { db } from "./db";
import { exportDB } from "dexie-export-import";

export async function exportDatabase(): Promise<void> {
    try {
        const blob = await exportDB(db);
        saveAs(blob, "osteomap_database.json");
    } catch (error) {
        console.error("Error exporting database:", error);
    }
}

export async function exportSingleCase(caseId: string): Promise<void> {
    try {
        const caseRecord = await db.cases.get(caseId);
        if (!caseRecord) {
            throw new Error(`Case with ID ${caseId} not found.`);
        }

        const contextRecord = await db.contexts.get(caseRecord.contextId);
        const siteRecord = contextRecord ? await db.sites.get(contextRecord.siteId) : undefined;

        const blob = await exportDB(db, {
            filter: (tableName, value) => {
                if (tableName === "cases") return value.caseId === caseId;
                if (tableName === "contexts") return value.contextId === caseRecord.contextId;
                if (tableName === "sites") return value.siteId === siteRecord?.siteId;
                return false;
            }
        });
        saveAs(blob, `osteomap_case_${caseId}.json`);
    } catch (error) {
        console.error("Error exporting single case:", error);
    }
}


export async function importDatabase(file: Blob): Promise<void> {
    try {
        await db.import(file, {
            clearTablesBeforeImport: false,
            overwriteValues: true,
        });
        console.log("Database imported successfully.");
    } catch (error) {
        console.error("Error importing database:", error);
    }
}


