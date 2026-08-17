import { db } from "./db";
import type { ContextRecord } from "./types";

export async function createContext(contextName: string, siteId: string): Promise<ContextRecord> {
    const context: ContextRecord = {
        contextId: crypto.randomUUID(),
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
    await db.contexts.delete(contextId);
}
