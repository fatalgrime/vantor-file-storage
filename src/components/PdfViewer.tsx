'use client';

import React from 'react';
import { VantorFile } from '../lib/types';
import { PdfDocumentViewer } from './preview/PdfDocumentViewer';

// Compatibility for consumers of the original viewer; rendering lives in one place.
export function PdfViewer({ file }: {
  file: VantorFile;
  canDownload: boolean;
  onDownload: (file: VantorFile) => void;
}) {
  return <PdfDocumentViewer file={file} />;
}
