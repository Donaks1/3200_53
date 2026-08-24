import { db } from "./db";
import type { SiteRecord } from "./types";
import { createId } from "./id";

export async function createSite(siteName: string): Promise<SiteRecord> {
    const site: SiteRecord = {
        siteId: createId(),
        siteName,
    };
    await db.sites.add(site);
    return site;
}

export async function getAllSites(): Promise<SiteRecord[]> {
    return db.sites.toArray();
}

export async function getSiteById(siteId: string): Promise<SiteRecord | undefined> {
    return db.sites.get(siteId);
}

export async function updateSite(siteId: string, siteName: string): Promise<void> {
    await db.sites.update(siteId, { siteName });
}

export async function deleteSite(siteId: string): Promise<void> {
  const contexts = await db.contexts.where('siteId').equals(siteId).toArray();

  for (const context of contexts) {
    const cases = await db.cases.where('contextId').equals(context.contextId).toArray();
    await db.cases.bulkDelete(cases.map((c) => c.caseId));
  }

  await db.contexts.bulkDelete(contexts.map((c) => c.contextId));
  await db.sites.delete(siteId);
}