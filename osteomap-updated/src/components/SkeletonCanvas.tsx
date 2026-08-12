import React, { useEffect, useRef, useState } from 'react';
import panzoom from '@panzoom/panzoom';
import { AdultFrontSvg } from './AdultFrontSvg';
import { AdultBackSvg } from './AdultBackSvg';
import { Maximize, ZoomIn, ZoomOut, FlipHorizontal, Camera } from 'lucide-react';
import { downloadCanvasImage } from '../utils/exportUtils';

interface SkeletonCanvasProps {
  onBoneTap: (id: string) => void;
  states: Record<string, string>;
  searchHighlight: string[];
}

export const SkeletonCanvas: React.FC<SkeletonCanvasProps> = ({ onBoneTap, states, searchHighlight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panzoomInstance = useRef<ReturnType<typeof panzoom> | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');

  useEffect(() => {
    if (containerRef.current) {
      const elem = containerRef.current;
      const parentRect = elem.parentElement?.getBoundingClientRect();
      const initialScale = parentRect ? Math.min((parentRect.width - 40) / 400, (parentRect.height - 40) / 800, 1) : 1;

      panzoomInstance.current = panzoom(elem, {
        maxScale: 5,
        minScale: 0.2,
        startScale: initialScale,
        step: 0.3,
      });

      // Simple momentum scrolling implementation
      let lastPoints: {x: number, y: number, time: number}[] = [];
      const handlePointerDown = (e: PointerEvent) => {
        lastPoints = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
      };
      const handlePointerMove = (e: PointerEvent) => {
        if (e.buttons > 0) {
          lastPoints.push({ x: e.clientX, y: e.clientY, time: performance.now() });
          if (lastPoints.length > 5) lastPoints.shift();
        }
      };
      const handlePointerUp = (e: PointerEvent) => {
        if (lastPoints.length < 2) return;
        const last = lastPoints[lastPoints.length - 1];
        const first = lastPoints[0];
        const dt = last.time - first.time;
        if (dt > 0 && (performance.now() - last.time) < 100) {
          const vx = (last.x - first.x) / dt;
          const vy = (last.y - first.y) / dt;
          if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
             const curPan = panzoomInstance.current!.getPan();
             const scale = panzoomInstance.current!.getScale();
             const newX = curPan.x + (vx * 100) / scale; 
             const newY = curPan.y + (vy * 100) / scale;
             
             panzoomInstance.current!.setOptions({ duration: 600, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)' });
             panzoomInstance.current!.pan(newX, newY, { animate: true });
             setTimeout(() => {
                 if (panzoomInstance.current) {
                     panzoomInstance.current.setOptions({ duration: 400, easing: 'ease-in-out' });
                 }
             }, 600);
          }
        }
        lastPoints = [];
      };

      const parent = elem.parentElement;
      if (parent) {
        parent.addEventListener('pointerdown', handlePointerDown);
        parent.addEventListener('pointermove', handlePointerMove);
        parent.addEventListener('pointerup', handlePointerUp);
        parent.addEventListener('pointercancel', handlePointerUp);
        parent.addEventListener('pointerleave', handlePointerUp);
      }

      // Enable mouse wheel zooming
      elem.parentElement?.addEventListener('wheel', panzoomInstance.current.zoomWithWheel);

      return () => {
        if (parent) {
          parent.removeEventListener('wheel', panzoomInstance.current!.zoomWithWheel);
          parent.removeEventListener('pointerdown', handlePointerDown);
          parent.removeEventListener('pointermove', handlePointerMove);
          parent.removeEventListener('pointerup', handlePointerUp);
          parent.removeEventListener('pointercancel', handlePointerUp);
          parent.removeEventListener('pointerleave', handlePointerUp);
        }
        panzoomInstance.current?.destroy();
      };
    }
  }, []);

  const handleZoomIn = () => panzoomInstance.current?.zoomIn();
  const handleZoomOut = () => panzoomInstance.current?.zoomOut();
  const handleReset = () => panzoomInstance.current?.reset();

  const handleExportActiveImage = async () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (svgEl) {
      const label = view === 'front' ? 'Anterior' : 'Posterior';
      await downloadCanvasImage(svgEl as SVGElement, `OsteoMap_Skeleton_${label}.png`);
    } else {
      alert('Could not locate active skeleton diagram.');
    }
  };

  const handleBoneTap = (id: string) => {
    // Basic zoom-in logic for hands/feet
    if (id.includes('hand_') || id.includes('foot_')) {
      const el = document.getElementById(id);
      if (el && panzoomInstance.current) {
        const bbox = el.getBoundingClientRect();
        const parentBbox = containerRef.current?.parentElement?.getBoundingClientRect();
        
        if (parentBbox) {
          // A rough programmatic zoom
          panzoomInstance.current.zoomToPoint(3, {
            clientX: bbox.x + bbox.width / 2,
            clientY: bbox.y + bbox.height / 2
          });
        }
      }
    }

    onBoneTap(id);
  };

  return (
    <div className="flex-1 relative w-full h-full overflow-hidden bg-gray-50 flex items-center justify-center select-none touch-none">
      {/* View Indicator Badge */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-30 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-xs px-3 py-1 rounded-full text-xs font-semibold text-gray-700 pointer-events-none">
        {view === 'front' ? 'Anterior View (Front)' : 'Posterior View (Back)'}
      </div>

      {/* Zoom and Image Export controls overlay */}
      <div className="absolute right-2 bottom-6 md:right-4 md:bottom-6 z-40 flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded shadow-md p-1 border border-gray-200">
        <button onClick={() => setView(v => v === 'front' ? 'back' : 'front')} className="p-2 hover:bg-gray-100 rounded text-blue-600 focus:outline-none" title="Flip View (Anterior/Posterior)">
          <FlipHorizontal size={24} />
        </button>
        <button onClick={handleExportActiveImage} className="p-2 hover:bg-gray-100 rounded text-emerald-600 focus:outline-none" title="Export Canvas as PNG Image">
          <Camera size={24} />
        </button>
        <div className="h-px bg-gray-200 my-1"></div>
        <button onClick={handleZoomIn} className="p-2 hover:bg-gray-100 rounded text-gray-700" title="Zoom In">
          <ZoomIn size={24} />
        </button>
        <button onClick={handleReset} className="p-2 hover:bg-gray-100 rounded text-gray-700" title="Reset View">
          <Maximize size={24} />
        </button>
        <button onClick={handleZoomOut} className="p-2 hover:bg-gray-100 rounded text-gray-700" title="Zoom Out">
          <ZoomOut size={24} />
        </button>
      </div>

      <div ref={containerRef} className="origin-center" style={{ width: '400px', height: '800px' }}>
        {view === 'front' ? (
          <AdultFrontSvg onBoneTap={handleBoneTap} states={states} searchHighlight={searchHighlight} />
        ) : (
          <AdultBackSvg onBoneTap={handleBoneTap} states={states} searchHighlight={searchHighlight} />
        )}
      </div>

      {/* Offscreen hidden SVG containers for full PDF report rendering */}
      <div className="hidden" aria-hidden="true">
        <div id="offscreen-front-svg">
          <AdultFrontSvg onBoneTap={() => {}} states={states} searchHighlight={searchHighlight} />
        </div>
        <div id="offscreen-back-svg">
          <AdultBackSvg onBoneTap={() => {}} states={states} searchHighlight={searchHighlight} />
        </div>
      </div>
    </div>
  );
};

