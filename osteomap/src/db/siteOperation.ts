import { db } from "./db";
import type { SiteRecord } from "./types";
import { createId } from "./id";
import { DuplicateNameError, sameName } from "./names";

// Site names are unique across the whole database. A rename that only changes
// capitals or spacing is always allowed, so records named alike before this
// rule existed can still be edited.
async function siteNameTaken(name: string, exceptSiteId?: string): Promise<boolean> {
    const sites = await db.sites.toArray();
    return sites.some((site) => site.siteId !== exceptSiteId && sameName(site.siteName, name));
}

export async function createSite(siteName: string): Promise<SiteRecord> {
    const name = siteName.trim();
    if (!name) throw new Error("A site needs a name.");

    return db.transaction("rw", db.sites, async () => {
        if (await siteNameTaken(name)) throw new DuplicateNameError("site", name);
        const site: SiteRecord = {
            siteId: createId(),
            siteName: name,
        };
        await db.sites.add(site);
        return site;
    });
}

export async function getAllSites(): Promise<SiteRecord[]> {
    return db.sites.toArray();
}

export async function getSiteById(siteId: string): Promise<SiteRecord | undefined> {
    return db.sites.get(siteId);
}

export async function updateSite(siteId: string, siteName: string): Promise<void> {
    const name = siteName.trim();
    if (!name) throw new Error("A site needs a name.");

    await db.transaction("rw", db.sites, async () => {
        const site = await db.sites.get(siteId);
        if (site && !sameName(site.siteName, name) && await siteNameTaken(name, siteId)) {
            throw new DuplicateNameError("site", name);
        }
        await db.sites.update(siteId, { siteName: name });
    });
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
