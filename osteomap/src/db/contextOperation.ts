import { db } from "./db";
import type { ContextRecord } from "./types";
import { createId } from "./id";
import { DuplicateNameError, sameName } from "./names";

// Context names are unique within their site. As with sites, a rename that
// only changes capitals or spacing is always allowed.
async function contextNameTaken(siteId: string, name: string, exceptContextId?: string): Promise<boolean> {
    const contexts = await db.contexts.where("siteId").equals(siteId).toArray();
    return contexts.some((context) => context.contextId !== exceptContextId && sameName(context.contextName, name));
}

export async function createContext(contextName: string, siteId: string): Promise<ContextRecord> {
    const name = contextName.trim();
    if (!name) throw new Error("A context needs a name.");

    return db.transaction("rw", db.contexts, async () => {
        if (await contextNameTaken(siteId, name)) throw new DuplicateNameError("context", name);
        const context: ContextRecord = {
            contextId: createId(),
            contextName: name,
            siteId,
        };
        await db.contexts.add(context);
        return context;
    });
}

export async function getContextsBySiteId(siteId: string): Promise<ContextRecord[]> {
    return db.contexts.where("siteId").equals(siteId).toArray();
}

export async function getContextById(contextId: string): Promise<ContextRecord | undefined> {
    return db.contexts.get(contextId);
}

export async function updateContext(contextId: string, contextName: string): Promise<void> {
    const name = contextName.trim();
    if (!name) throw new Error("A context needs a name.");

    await db.transaction("rw", db.contexts, async () => {
        const context = await db.contexts.get(contextId);
        if (!context) return;
        if (!sameName(context.contextName, name) && await contextNameTaken(context.siteId, name, contextId)) {
            throw new DuplicateNameError("context", name);
        }
        await db.contexts.update(contextId, { contextName: name });
    });
}

export async function deleteContext(contextId: string): Promise<void> {
  const cases = await db.cases.where('contextId').equals(contextId).toArray();
  await db.cases.bulkDelete(cases.map((c) => c.caseId));

  await db.contexts.delete(contextId);
}
