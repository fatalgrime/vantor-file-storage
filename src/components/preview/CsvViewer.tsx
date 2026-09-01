'use client';

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface CsvViewerProps {
  fileName: string;
  content: string;
}

export const CsvViewer: React.FC<CsvViewerProps> = ({ fileName, content }) => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const rowsPerPage = 10;

  // Clean Windows carriage returns \r
  const cleanedContent = content.replace(/\r/g, '');
  const lines = cleanedContent.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0] ? lines[0].split(',') : [];
  const rows = lines.slice(1).map((l) => l.split(','));

  const filteredRows = rows.filter((r) =>
    r.some((cell) => cell.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <div className="flex flex-col space-y-3 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080d1a] border border-slate-800 rounded-lg p-3">
        <span className="font-mono text-xs text-slate-300 font-semibold">{fileName}</span>
        <div className="relative flex-grow max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search table rows..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-600 transition-colors font-mono"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[50vh] border border-slate-800 rounded-lg shadow-inner">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800 uppercase tracking-wider">
            <tr>
              {header.map((col, idx) => (
                <th key={idx} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {col.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-[#040813] text-slate-300 font-mono">
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-850/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 whitespace-nowrap text-slate-200">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={header.length || 1} className="px-4 py-8 text-center text-slate-500 italic">
                  No matching CSV rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
        <span>
          Showing {filteredRows.length > 0 ? page * rowsPerPage + 1 : 0} -{' '}
          {Math.min((page + 1) * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 rounded bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
