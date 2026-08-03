'use client';

import React from 'react';
import { ChevronRight, FolderTree } from 'lucide-react';

interface BreadcrumbsProps {
  items: { id: string | null; name: string }[];
  onNavigateFolder: (folderId: string | null) => void;
  isDark: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigateFolder, isDark }) => {
  return (
    <nav className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
      isDark ? 'border-[#1e3059] bg-[#070c18] text-slate-300' : 'border-gray-200 bg-white text-gray-600'
    }`}>
      <FolderTree className="h-4 w-4 flex-shrink-0 text-blue-400" />
      {items.map((item, idx) => (
        <React.Fragment key={item.id || 'root'}>
          {idx > 0 && <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />}
          <button
            onClick={() => onNavigateFolder(item.id)}
            className={`max-w-[16rem] truncate rounded px-1.5 py-0.5 text-left transition-colors hover:text-blue-400 ${
              idx === items.length - 1
                ? `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`
                : isDark ? 'text-slate-400' : 'text-gray-500'
            }`}
          >
            {item.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
