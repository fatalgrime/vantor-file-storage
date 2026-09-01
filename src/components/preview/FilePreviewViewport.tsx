'use client';

import React from 'react';
import { VantorFile } from '../../lib/types';
import { ImageViewer } from './ImageViewer';
import { PdfDocumentViewer } from './PdfDocumentViewer';
import { MediaViewer } from './MediaViewer';
import { CodeViewer } from './CodeViewer';
import { CsvViewer } from './CsvViewer';
import { resolveImageSrc } from '../../lib/imageUtils';
import { FileText } from 'lucide-react';

interface FilePreviewViewportProps {
  file: VantorFile;
  canDownload: boolean;
  onDownload: (file: VantorFile) => void;
}

export const FilePreviewViewport: React.FC<FilePreviewViewportProps> = ({ file, canDownload, onDownload }) => {
  const ext = (file.extension || '').toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();

  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext) || mime.startsWith('image/');
  const isPdf = ext === 'pdf' || mime === 'application/pdf';
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) || mime.startsWith('audio/');
  const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) || mime.startsWith('video/');
  const isCode = ['json', 'ts', 'js', 'py', 'xml', 'css', 'html', 'sh', 'yaml', 'yml', 'tsx', 'jsx'].includes(ext);
  const isCsv = ext === 'csv' || mime === 'text/csv';
  const isMarkdown = ext === 'md';

  if (isImage) {
    const imgSrc = resolveImageSrc(file);
    return <ImageViewer src={imgSrc} fileName={file.name} mimeType={file.mimeType} />;
  }

  if (isPdf) {
    return <PdfDocumentViewer file={file} canDownload={canDownload} onDownload={onDownload} />;
  }

  if (isAudio || isVideo) {
    return <MediaViewer file={file} isAudio={isAudio} />;
  }

  if (isCode && file.content) {
    return <CodeViewer fileName={file.name} content={file.content} />;
  }

  if (isCsv && file.content) {
    return <CsvViewer fileName={file.name} content={file.content} />;
  }

  if (isMarkdown && (file.content || file.description)) {
    return (
      <div className="w-full bg-slate-950/60 rounded-xl p-6 border border-slate-800 text-slate-200 text-sm leading-relaxed overflow-y-auto max-h-[55vh] shadow-inner font-sans">
        {file.content || file.description}
      </div>
    );
  }

  // Fallback viewer for unformatted or non-previewable files
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 space-y-3">
      <FileText className="h-10 w-10 text-slate-600 mb-1" />
      <span className="font-semibold text-slate-300 text-sm">{file.name}</span>
      <span className="text-xs text-slate-500 font-mono">
        Preview is not available for .{file.extension || 'file'} format.
      </span>
      {canDownload && (
        <button
          onClick={() => onDownload(file)}
          className="mt-2 flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-blue-950/20"
        >
          Download File ({Math.round(file.size / 1024)} KB)
        </button>
      )}
    </div>
  );
};
