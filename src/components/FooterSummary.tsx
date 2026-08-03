'use client';

import React from 'react';

interface FooterSummaryProps {
  fileCount: number;
  folderCount: number;
  totalFormattedSize: string;
}

export const FooterSummary: React.FC<FooterSummaryProps> = ({
  fileCount,
  folderCount,
  totalFormattedSize,
}) => {
  return (
    <footer className="relative mt-8 border-t border-[#1e3059]/60 bg-[#060a17] px-6 py-4">
      {/* Table Summary Bar (Matching screenshot footer exact counts "2 files · 2 folders", "42.8 MB") */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-sans text-slate-400">
        <div className="flex items-center space-x-2 font-medium">
          <span className="text-slate-300">
            {fileCount} {fileCount === 1 ? 'file' : 'files'} · {folderCount} {folderCount === 1 ? 'folder' : 'folders'}
          </span>
        </div>

        <div className="font-mono font-semibold text-slate-300">
          <span>{totalFormattedSize}</span>
        </div>
      </div>
    </footer>
  );
};
