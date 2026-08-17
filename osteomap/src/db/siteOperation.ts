import { db } from "./db";
import type { SiteRecord } from "./types";

export async function createSite(siteName: string): Promise<SiteRecord> {
    const site: SiteRecord = {
        siteId: crypto.randomUUID(),
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
    //Should the delete operation also cascade to contexts and cases associated with the site? 
    // This is a design decision that needs to be made based on the application's requirements. 

    await db.sites.delete(siteId);
}