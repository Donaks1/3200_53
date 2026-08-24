import Dexie,{ type Table } from "dexie";
import type { SiteRecord, ContextRecord, CaseRecord } from "./types";

export class OsteoMapDB extends Dexie {
    sites!: Table<SiteRecord, string>;
    contexts!: Table<ContextRecord, string>;
    cases!: Table<CaseRecord, string>;

    constructor() {
        super("OsteoMapDB");
        this.version(1).stores({
            sites: "siteId, siteName",
            contexts: "contextId, contextName, siteId",
            cases: "caseId, dateCreated, dateModified, fieldNotes, sex, ageGroup, contextId",
        });

        // do not add edit version(1) instead add a new version(2) and add the new field
        //
        // this.version(2).stores({
        //   sites: 'siteId, siteCode',
        //   contexts: 'contextId, siteId, contextCode',
        //   cases: 'caseId, contextId, dateCreated, ageGroup, sex, lastModified, someNewField',
        // });
    }
}

export const db = new OsteoMapDB();