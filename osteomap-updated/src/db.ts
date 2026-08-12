import Dexie, { type Table } from 'dexie';

export interface Site {
  id?: number;
  siteCode: string; // e.g. UWA_001
  description?: string;
}

export interface Context {
  id?: number;
  siteId: number;
  contextCode: string; // e.g. Trench A, Level 2
  description?: string;
}

export interface Skeleton {
  id?: number;
  contextId: number;
  skeletonCode: string; // e.g. SK_01
  ageGroup: string;
  biologicalSex: string;
  notes?: string;
  date: string;
}

export type ObservationState = 'complete' | 'absent' | 'fragmentary';

export interface Observation {
  id?: number;
  skeletonId: number;
  boneId: string;
  zoneId: string;
  side: string;
  state: ObservationState;
}

export class OsteoDatabase extends Dexie {
  sites!: Table<Site>;
  contexts!: Table<Context>;
  skeletons!: Table<Skeleton>;
  observations!: Table<Observation>;

  constructor() {
    super('OsteoMapDatabase');
    this.version(1).stores({
      sites: '++id, siteCode',
      contexts: '++id, siteId, contextCode',
      skeletons: '++id, contextId, skeletonCode',
      observations: '++id, skeletonId, [skeletonId+boneId], boneId, state'
    });
  }
}

export const db = new OsteoDatabase();
