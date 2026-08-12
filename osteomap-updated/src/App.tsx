import React, { useState, useEffect, useRef } from 'react';
import { MetadataForm } from './components/MetadataForm';
import { SkeletonCanvas } from './components/SkeletonCanvas';
import { exportToCSV, importFromCSV } from './utils/csv';
import { exportPDFReport } from './utils/exportUtils';
import { db, ObservationState } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Search, Database, Menu, X, FileText } from 'lucide-react';

const possibleBones = [
  'skull_front_cranium', 'sternum', 'ribs_L', 'ribs_R',
  'humerus_L_shaft', 'radius_L_shaft', 'ulna_L_shaft', 'hand_L',
  'humerus_R_shaft', 'radius_R_shaft', 'ulna_R_shaft', 'hand_R',
  'pelvis_L', 'pelvis_R',
  'femur_L_shaft', 'patella_L', 'tibia_L_shaft', 'fibula_L_shaft', 'foot_L',
  'femur_R_shaft', 'patella_R', 'tibia_R_shaft', 'fibula_R_shaft', 'foot_R'
];

export default function App() {
  const [activeSkeletonId, setActiveSkeletonId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch observations for active skeleton
  const activeObservations = useLiveQuery(
    () => activeSkeletonId ? db.observations.where({ skeletonId: activeSkeletonId }).toArray() : Promise.resolve([]),
    [activeSkeletonId]
  );

  // Derive states map from observations
  const statesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    activeObservations?.forEach(obs => {
      map[obs.boneId] = obs.state;
    });
    return map;
  }, [activeObservations]);

  // Derive search highlights
  const searchHighlights = React.useMemo(() => {
    if (!searchTerm) return [];
    return possibleBones.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm]);


  const cycleState = (currentState: string | undefined): ObservationState => {
    switch (currentState) {
      case 'complete': return 'absent';
      case 'absent': return 'fragmentary';
      case 'fragmentary': return 'complete';
      default: return 'complete';
    }
  };

  const handleBoneTap = async (boneId: string) => {
    if (!activeSkeletonId) {
      alert("Please select or create a skeleton first.");
      return;
    }

    const currentState = statesMap[boneId];
    const nextState = cycleState(currentState);

    const existingObs = await db.observations.where({ skeletonId: activeSkeletonId, boneId }).first();
    
    // basic parsing of bone ID to get zone/side
    let side = 'unknown';
    if (boneId.includes('_L')) side = 'left';
    if (boneId.includes('_R')) side = 'right';
    
    let zoneId = boneId; // simple fallback

    if (existingObs) {
      await db.observations.update(existingObs.id!, { state: nextState });
    } else {
      await db.observations.add({
        skeletonId: activeSkeletonId,
        boneId,
        zoneId,
        side,
        state: nextState
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importFromCSV(file, () => {
          alert('Import successful!');
          // Refresh if needed, useLiveQuery handles it usually
        });
      } catch (err) {
        alert('Failed to import CSV');
      }
    }
    // reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePersistStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      alert(`Storage persistence is ${isPersisted ? 'granted' : 'denied'}.`);
    } else {
      alert("Storage persistence not supported on this browser.");
    }
  };

  const handleExportPDF = async () => {
    if (!activeSkeletonId) {
      alert("Please select or create a skeleton first.");
      return;
    }
    setIsExportingPDF(true);
    try {
      const frontSvg = document.getElementById('offscreen-front-svg')?.querySelector('svg');
      const backSvg = document.getElementById('offscreen-back-svg')?.querySelector('svg');
      await exportPDFReport(activeSkeletonId, frontSvg as SVGElement, backSvg as SVGElement);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100 overflow-hidden font-sans">
      {/* Fixed Header */}
      <header className="bg-blue-900 text-white p-4 flex items-center justify-between shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 -ml-2 rounded hover:bg-blue-800 focus:outline-none"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-tight">OsteoMap</h1>
            <span className="text-xs text-blue-200">Field Recording Tool</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Search bones..."
              className="pl-8 pr-2 py-1 rounded text-black text-sm w-48 md:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />
            {isSearchFocused && searchTerm && searchHighlights.length > 0 && (
              <div className="absolute top-full mt-1 right-0 w-full bg-white rounded shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-50">
                {searchHighlights.map(boneId => (
                  <button
                    key={boneId}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setSearchTerm(boneId)}
                  >
                    {boneId}
                  </button>
                ))}
              </div>
            )}
            {isSearchFocused && searchTerm && searchHighlights.length === 0 && (
               <div className="absolute top-full mt-1 right-0 w-full bg-white rounded shadow-lg border border-gray-200 z-50 p-3 text-sm text-gray-500">
                No bones found.
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Left/Top Panel: Metadata & Controls */}
        <div className={`
          absolute md:static inset-y-0 left-0 z-[60] w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto transform transition-transform duration-300 ease-in-out h-full
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <MetadataForm onSelectSkeleton={(id) => {
            setActiveSkeletonId(id);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }} />
          
          <div className="p-4 flex flex-col gap-3">
            <h3 className="font-semibold text-gray-700 border-b pb-1">Reports & Export</h3>
            
            <button 
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center justify-center gap-2 bg-blue-600 border border-blue-700 text-white rounded p-2 font-medium hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <FileText size={18} /> {isExportingPDF ? 'Generating PDF...' : 'Export Field PDF Report'}
            </button>

            <button 
              onClick={exportToCSV}
              className="flex items-center justify-center gap-2 bg-gray-100 border border-gray-300 rounded p-2 text-gray-700 hover:bg-gray-200"
            >
              <Download size={18} /> Export CSV Data
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-gray-100 border border-gray-300 rounded p-2 text-gray-700 hover:bg-gray-200"
            >
              <Upload size={18} /> Import CSV
            </button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

            <button 
              onClick={handlePersistStorage}
              className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 rounded p-2 text-blue-700 hover:bg-blue-100 mt-2 text-xs"
            >
              <Database size={16} /> Request Persistent Storage
            </button>
          </div>
        </div>

        {/* Right/Main Panel: Canvas */}
        <div className="flex-1 relative flex flex-col min-w-0 min-h-0 overflow-hidden">
          <SkeletonCanvas 
            onBoneTap={handleBoneTap} 
            states={statesMap} 
            searchHighlight={searchHighlights} 
          />
          
          {/* Legend */}
          <div className="absolute left-2 bottom-6 md:left-4 md:bottom-6 z-40 border shadow-md p-2 rounded bg-white/90 backdrop-blur-sm text-[10px] sm:text-xs pointer-events-none">
            <h4 className="font-semibold mb-1 text-gray-700">Legend (Tap to cycle)</h4>
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 border border-green-700 inline-block shrink-0"></span> Complete</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 bg-transparent border border-dashed border-gray-400 inline-block opacity-50 shrink-0"></span> Absent</li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 border border-yellow-700 inline-block relative overflow-hidden bg-yellow-400 shrink-0">
                  <svg width="100%" height="100%"><rect width="100%" height="100%" fill="url(#diagonalHatch)"/></svg>
                </span> 
                Fragmentary
              </li>
            </ul>
          </div>

          {!activeSkeletonId && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded shadow-lg border max-w-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Get Started</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  To begin recording, you need to create a project hierarchy in the left panel:
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                  <li>Enter a <strong>New site code</strong> (e.g. UWA_001) and click <strong>+</strong></li>
                  <li>Enter a <strong>New context code</strong> (e.g. Trench A) and click <strong>+</strong></li>
                  <li>Enter a <strong>New skeleton code</strong> (e.g. SK_01) and click <strong>+</strong></li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

