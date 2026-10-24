'use client';

import React, { useEffect, useState } from 'react';
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
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState('');
  const textPreview = isCode || isCsv || isMarkdown;
  useEffect(() => {
    setTextContent(null); setTextError('');
    if (!textPreview || file.content || !file.url) return;
    if (file.size > 2 * 1024 * 1024) { setTextError('Text preview is limited to 2 MB. Download the file to read it.'); return; }
    const controller = new AbortController();
    fetch(file.url, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Unable to load this preview. Reopen the file or share link to retry.');
      const text = await response.text();
      if (!controller.signal.aborted) setTextContent(text);
    }).catch(e => { if (!controller.signal.aborted) setTextError(e.message); });
    return () => controller.abort();
  }, [file.id, file.url, file.content, file.size, textPreview]);
  const content = file.content ?? textContent;
  if (textPreview && textError) return <p role="alert" className="p-6 text-red-300">{textError}</p>;
  if (textPreview && content === null && file.url) return <p role="status" className="p-6 text-slate-400">Loading preview…</p>;

  if (isImage) {
    const imgSrc = resolveImageSrc(file);
    return <ImageViewer src={imgSrc} fileName={file.name} mimeType={file.mimeType} />;
  }

  if (isPdf) {
    return <PdfDocumentViewer file={file} />;
  }

  if (isAudio || isVideo) {
    return <MediaViewer file={file} isAudio={isAudio} />;
  }

  if (isCode && content !== null && content !== undefined) {
    return <CodeViewer fileName={file.name} content={content} />;
  }

  if (isCsv && content !== null && content !== undefined) {
    return <CsvViewer fileName={file.name} content={content} />;
  }

  if (isMarkdown && content !== null && content !== undefined) {
    return (
      <div className="w-full bg-slate-950/60 rounded-xl p-6 border border-slate-800 text-slate-200 text-sm leading-relaxed overflow-y-auto max-h-[55vh] shadow-inner font-sans">
        {content}
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
