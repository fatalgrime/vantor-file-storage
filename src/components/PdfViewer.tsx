'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Loader2, Download } from 'lucide-react';
import { VantorFile } from '../lib/types';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface PdfViewerProps {
  file: VantorFile;
  canDownload: boolean;
  onDownload: (file: VantorFile) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, canDownload, onDownload }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [isFitWidth, setIsFitWidth] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pageRendering, setPageRendering] = useState<boolean>(false);

  // Load PDF.js from CDN
  useEffect(() => {
    let active = true;

    const initPdf = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        let pdfjs = window.pdfjsLib;

        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.async = true;
            script.onload = () => {
              const loadedPdfjs = window.pdfjsLib;
              if (loadedPdfjs) {
                loadedPdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                resolve();
              } else {
                reject(new Error('PDF.js lib not available on load.'));
              }
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js from CDN.'));
            document.body.appendChild(script);
          });
          pdfjs = window.pdfjsLib;
        }

        if (!active) return;
        if (!file.content && !file.url) {
          throw new Error('PDF file has no readable content.');
        }

        let pdfData: Uint8Array | ArrayBuffer;

        if (file.content) {
          // Convert base64 data to Uint8Array
          const base64Parts = file.content.split(',');
          const base64Data = base64Parts[1] || base64Parts[0];
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfData = bytes;
        } else {
          // Fetch the PDF from its remote URL (R2 / CDN)
          const response = await fetch(file.url!);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF from storage (HTTP ${response.status}).`);
          }
          pdfData = await response.arrayBuffer();
        }

        if (!active) return;

        const doc = await pdfjs.getDocument({ data: pdfData }).promise;
        if (!active) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        if (active) {
          setErrorMsg(err.message || 'Error loading PDF document.');
          setLoading(false);
        }
      }
    };

    initPdf();

    return () => {
      active = false;
    };
  }, [file.content, file.url]);

  // Handle rendering a page
  const renderPage = async (pageNumber: number, currentScale: number, fitWidth: boolean) => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      setPageRendering(true);
      const page = await pdfDoc.getPage(pageNumber);

      let finalScale = currentScale;

      if (fitWidth) {
        const containerWidth = Math.max(100, containerRef.current.clientWidth - 40); // Subtract padding
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        if (unscaledViewport.width > 0) {
          finalScale = containerWidth / unscaledViewport.width;
          setScale(Number(finalScale.toFixed(2)));
        }
      }

      const pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const viewport = page.getViewport({ scale: finalScale * pixelRatio });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Could not get 2D rendering context.');

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      setPageRendering(false);
    } catch (err) {
      console.error('Page render error:', err);
      setPageRendering(false);
    }
  };

  // Re-render page when PDF, page index, scale changes
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage, scale, isFitWidth);
    }
  }, [pdfDoc, currentPage, scale, isFitWidth]);

  // Adjust zoom on container resize if isFitWidth is active
  useEffect(() => {
    const handleResize = () => {
      if (isFitWidth && pdfDoc) {
        renderPage(currentPage, scale, true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, currentPage, scale, isFitWidth]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    }
  };

  const handleZoomOut = () => {
    setIsFitWidth(false);
    setScale((prev) => Math.max(0.5, prev - 0.2));
  };

  const handleZoomIn = () => {
    setIsFitWidth(false);
    setScale((prev) => Math.min(3.0, prev + 0.2));
  };

  const handleFitWidth = () => {
    setIsFitWidth(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-slate-400 bg-slate-950/20 rounded-lg border border-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <span className="text-xs font-mono">Loading PDF Reader & Assets...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center bg-red-950/20 rounded-lg border border-red-900/50">
        <span className="text-red-400 font-bold mb-2">Error Loading Document</span>
        <span className="text-xs text-red-300 font-mono max-w-md">{errorMsg}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Dynamic toolbar controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080d1a] border-b border-slate-800 px-4 py-2.5 flex-shrink-0 text-slate-200">
        {/* Navigation */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || pageRendering}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center space-x-1 font-mono text-xs">
            <select
              value={currentPage}
              onChange={handlePageSelect}
              disabled={pageRendering}
              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white outline-none cursor-pointer"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{totalPages}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || pageRendering}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || pageRendering}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <span className="font-mono text-xs min-w-[42px] text-center">{Math.round(scale * 100)}%</span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || pageRendering}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-slate-800"></div>

          <button
            onClick={handleFitWidth}
            className={`p-1 rounded border transition-colors flex items-center justify-center ${isFitWidth
              ? 'bg-blue-950 border-blue-800 text-blue-400'
              : 'bg-slate-850 border-slate-800 hover:bg-slate-800 text-slate-200'
              }`}
            title="Fit to Width"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Permission-aware download button */}
        {canDownload && (
          <button
            onClick={() => onDownload(file)}
            className="flex items-center space-x-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-md shadow-blue-950/20"
            title="Download PDF document"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}
      </div>

      {/* PDF Document Canvas Viewport */}
      <div className="flex-grow p-4 overflow-auto max-h-[60vh] flex items-start justify-center bg-slate-950/30">
        <div className="relative">
          {pageRendering && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10 rounded">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="rounded border border-slate-800/80 bg-white shadow-xl max-w-full transition-all duration-150"
          />
        </div>
      </div>
    </div>
  );
};
