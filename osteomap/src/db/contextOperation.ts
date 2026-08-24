import { db } from "./db";
import type { ContextRecord } from "./types";
import { createId } from "./id";

export async function createContext(contextName: string, siteId: string): Promise<ContextRecord> {
    const context: ContextRecord = {
        contextId: createId(),
        contextName,
        siteId,
    };
    await db.contexts.add(context);
    return context;
}

export async function getContextsBySiteId(siteId: string): Promise<ContextRecord[]> {
    return db.contexts.where("siteId").equals(siteId).toArray();
}

export async function getContextById(contextId: string): Promise<ContextRecord | undefined> {
    return db.contexts.get(contextId);
}

export async function updateContext(contextId: string, contextName: string): Promise<void> {
    await db.contexts.update(contextId, { contextName });
}

export async function deleteContext(contextId: string): Promise<void> {
  const cases = await db.cases.where('contextId').equals(contextId).toArray();
  await db.cases.bulkDelete(cases.map((c) => c.caseId));

  await db.contexts.delete(contextId);
}