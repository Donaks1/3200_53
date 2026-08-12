import Papa from 'papaparse';
import { db } from '../db';

export const exportToCSV = async () => {
  // We want to export Sites, Contexts, Skeletons, and Observations in a denormalized format
  const observations = await db.observations.toArray();
  const data = [];

  for (const obs of observations) {
    const skeleton = await db.skeletons.get(obs.skeletonId);
    if (!skeleton) continue;
    
    const context = await db.contexts.get(skeleton.contextId);
    if (!context) continue;

    const site = await db.sites.get(context.siteId);
    if (!site) continue;

    data.push({
      SiteCode: site.siteCode,
      ContextCode: context.contextCode,
      SkeletonCode: skeleton.skeletonCode,
      AgeGroup: skeleton.ageGroup,
      BiologicalSex: skeleton.biologicalSex,
      Date: skeleton.date,
      BoneId: obs.boneId,
      ZoneId: obs.zoneId,
      Side: obs.side,
      State: obs.state
    });
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'osteomap_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importFromCSV = async (file: File, onProgress: () => void) => {
  return new Promise<void>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Process row by row
          for (const row of results.data as any[]) {
            // Find or create Site
            let site = await db.sites.where('siteCode').equals(row.SiteCode).first();
            let siteId = site?.id;
            if (!siteId) {
              siteId = await db.sites.add({ siteCode: row.SiteCode });
            }

            // Find or create Context
            let context = await db.contexts.where({ siteId, contextCode: row.ContextCode }).first();
            let contextId = context?.id;
            if (!contextId) {
              contextId = await db.contexts.add({ siteId, contextCode: row.ContextCode });
            }

            // Find or create Skeleton
            let skeleton = await db.skeletons.where({ contextId, skeletonCode: row.SkeletonCode }).first();
            let skeletonId = skeleton?.id;
            if (!skeletonId) {
              skeletonId = await db.skeletons.add({
                contextId,
                skeletonCode: row.SkeletonCode,
                ageGroup: row.AgeGroup || 'Adult',
                biologicalSex: row.BiologicalSex || 'Indeterminate',
                date: row.Date || new Date().toISOString()
              });
            }

            // Find or update Observation
            const existingObs = await db.observations.where({ skeletonId, boneId: row.BoneId }).first();
            if (existingObs) {
              await db.observations.update(existingObs.id!, {
                state: row.State,
                zoneId: row.ZoneId,
                side: row.Side
              });
            } else {
              await db.observations.add({
                skeletonId,
                boneId: row.BoneId,
                zoneId: row.ZoneId,
                side: row.Side,
                state: row.State
              });
            }
          }
          onProgress();
          resolve();
        } catch (err) {
          console.error(err);
          reject(err);
        }
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};
