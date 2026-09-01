'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Loader2 } from 'lucide-react';
import { normalizeImageOrientation } from '../../lib/imageUtils';

interface ImageViewerProps {
  src: string;
  fileName: string;
  mimeType?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, fileName, mimeType }) => {
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Normalize image orientation (EXIF + canvas auto-upright) on mount / src change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadNormalized = async () => {
      try {
        if (!src) {
          if (isMounted) setLoading(false);
          return;
        }
        const normalized = await normalizeImageOrientation(src, mimeType || 'image/jpeg');
        if (isMounted) {
          setDisplaySrc(normalized || src);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Image normalization error:', err);
        if (isMounted) {
          setDisplaySrc(src);
          setLoading(false);
        }
      }
    };

    loadNormalized();

    return () => {
      isMounted = false;
    };
  }, [src, mimeType]);

  // Reset zoom & pan when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [src]);

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(4.0, Math.max(0.25, prevZoom * zoomFactor));
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1 && rotation === 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click to toggle 2x zoom
  const handleDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.0);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4.0, Number((prev + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.25, Number((prev - 0.25).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-[#080d1a] border-b border-slate-800 px-4 py-2.5 flex-shrink-0 text-slate-200">
        <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]" title={fileName}>
          {fileName}
        </span>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            onClick={handleReset}
            className="font-mono text-xs min-w-[44px] text-center px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
            title="Reset Zoom & Pan"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 4.0}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-slate-800"></div>

          <button
            onClick={handleRotate}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-800 transition-colors text-slate-300 hover:text-white"
            title="Rotate 90° Right"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleReset}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-800 transition-colors text-slate-400 hover:text-slate-200"
            title="Reset View"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full flex items-center justify-center p-6 bg-slate-950/60 overflow-hidden max-h-[60vh] min-h-[350px] relative select-none ${
          zoom > 1 || rotation !== 0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <span className="text-xs font-mono">Processing image metadata...</span>
          </div>
        ) : (
          <div
            className="transition-transform duration-150 ease-out flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          >
            <img
              src={displaySrc || src}
              alt={fileName}
              onDoubleClick={handleDoubleClick}
              draggable={false}
              className="max-h-[50vh] max-w-full object-contain rounded shadow-2xl pointer-events-auto"
              style={{
                imageOrientation: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
