import Dexie,{ type Table } from "dexie";
import type { SiteRecord, ContextRecord, CaseRecord } from "./types";
import { currentSegmentStates } from "../pages/segmentNames";

const STORES = {
    sites: "siteId, siteName",
    contexts: "contextId, contextName, siteId",
    cases: "caseId, dateCreated, dateModified, fieldNotes, sex, ageGroup, contextId",
};

export class OsteoMapDB extends Dexie {
    sites!: Table<SiteRecord, string>;
    contexts!: Table<ContextRecord, string>;
    cases!: Table<CaseRecord, string>;

    constructor() {
        super("OsteoMapDB");
        this.version(1).stores(STORES);

        // Version 2 standardised the bone and zone ids (see the naming section
        // of CONTRIBUTING.md). Marks saved before then move to the new ids the
        // first time the app opens the database.
        this.version(2).stores(STORES).upgrade((tx) =>
            tx.table<CaseRecord, string>("cases").toCollection().modify((caseRecord) => {
                caseRecord.segmentStates = currentSegmentStates(caseRecord.segmentStates ?? {});
            })
        );

        // do not edit an existing version, instead add a new version(3) with
        // the change (and an upgrade() for any data that has to move)
        //
        // this.version(3).stores({
        //   sites: 'siteId, siteCode',
        //   contexts: 'contextId, siteId, contextCode',
        //   cases: 'caseId, contextId, dateCreated, ageGroup, sex, lastModified, someNewField',
        // });
    }
}

export const db = new OsteoMapDB();
