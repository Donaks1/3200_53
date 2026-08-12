import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus } from 'lucide-react';

export const MetadataForm = ({ onSelectSkeleton }: { onSelectSkeleton: (id: number) => void }) => {
  const sites = useLiveQuery(() => db.sites.toArray());
  const contexts = useLiveQuery(() => db.contexts.toArray());
  const skeletons = useLiveQuery(() => db.skeletons.toArray());

  const [siteCode, setSiteCode] = useState('');
  const [contextCode, setContextCode] = useState('');
  const [skeletonCode, setSkeletonCode] = useState('');

  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
  const [selectedContextId, setSelectedContextId] = useState<number | ''>('');

  const handleCreateSite = async () => {
    if (!siteCode) return;
    const id = await db.sites.add({ siteCode });
    setSelectedSiteId(id);
    setSiteCode('');
  };

  const handleCreateContext = async () => {
    if (!contextCode || !selectedSiteId) return;
    const id = await db.contexts.add({ siteId: selectedSiteId as number, contextCode });
    setSelectedContextId(id);
    setContextCode('');
  };

  const handleCreateSkeleton = async () => {
    if (!skeletonCode || !selectedContextId) return;
    const id = await db.skeletons.add({
      contextId: selectedContextId as number,
      skeletonCode,
      ageGroup: 'Adult', // default
      biologicalSex: 'Indeterminate',
      date: new Date().toISOString()
    });
    onSelectSkeleton(id);
    setSkeletonCode('');
  };

  return (
    <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <label className="text-gray-600 font-medium">Site</label>
        <select 
          className="w-full border rounded p-2 bg-gray-50"
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(Number(e.target.value) || '')}
        >
          <option value="">Select a Site...</option>
          {sites?.map(s => <option key={s.id} value={s.id}>{s.siteCode}</option>)}
        </select>
        <div className="flex gap-2 items-center mt-1">
          <input 
            type="text" 
            placeholder="New site code" 
            className="border rounded p-2 flex-1 min-w-0"
            value={siteCode}
            onChange={e => setSiteCode(e.target.value)}
          />
          <button onClick={handleCreateSite} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 shrink-0" title="Add Site">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {selectedSiteId !== '' && (
        <div className="flex flex-col gap-1 mt-2">
          <label className="text-gray-600 font-medium">Context</label>
          <select 
            className="w-full border rounded p-2 bg-gray-50"
            value={selectedContextId}
            onChange={(e) => setSelectedContextId(Number(e.target.value) || '')}
          >
            <option value="">Select a Context...</option>
            {contexts?.filter(c => c.siteId === selectedSiteId).map(c => (
              <option key={c.id} value={c.id}>{c.contextCode}</option>
            ))}
          </select>
          <div className="flex gap-2 items-center mt-1">
            <input 
              type="text" 
              placeholder="New context code" 
              className="border rounded p-2 flex-1 min-w-0"
              value={contextCode}
              onChange={e => setContextCode(e.target.value)}
            />
            <button onClick={handleCreateContext} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 shrink-0" title="Add Context">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {selectedContextId !== '' && (
        <div className="flex flex-col gap-1 mt-2">
          <label className="text-gray-600 font-medium">Skeleton</label>
          <select 
            className="w-full border rounded p-2 bg-gray-50"
            onChange={(e) => onSelectSkeleton(Number(e.target.value))}
          >
            <option value="">Select a Skeleton...</option>
            {skeletons?.filter(s => s.contextId === selectedContextId).map(s => (
              <option key={s.id} value={s.id}>{s.skeletonCode}</option>
            ))}
          </select>
          <div className="flex gap-2 items-center mt-1">
            <input 
              type="text" 
              placeholder="New skeleton code" 
              className="border rounded p-2 flex-1 min-w-0"
              value={skeletonCode}
              onChange={e => setSkeletonCode(e.target.value)}
            />
            <button onClick={handleCreateSkeleton} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 shrink-0" title="Add Skeleton">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
