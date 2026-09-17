'use client';

import React, { useState } from 'react';
import { FileText, Folder, FolderTree } from 'lucide-react';
import { SearchResult } from '../lib/searchResults';
import { Pagination, PAGE_SIZE } from './Pagination';

export function SearchResults({ results, onOpen, onClear }: {
  results: SearchResult[]; onOpen: (result: SearchResult) => void; onClear: () => void;
}) {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(results.length / PAGE_SIZE)));
  return (
    <section aria-label="Search results" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" role="status">{results.length} search results</h2>
        <button className="storage-button" onClick={onClear}>Clear search</button>
      </div>
      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No matching repositories, files, or folders. Try a different name or keyword.</p>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
          {results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((result) => {
            const Icon = result.kind === 'file' ? FileText : result.kind === 'folder' ? Folder : FolderTree;
            return (
              <li key={`${result.kind}-${result.item.id}`}>
                <button className="flex w-full items-center gap-3 bg-slate-950/40 p-4 text-left hover:bg-slate-800/50" onClick={() => onOpen(result)}>
                  <Icon className="h-5 w-5 shrink-0 text-blue-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{result.item.name}</span>
                    <span className="block break-words text-xs text-slate-400">{result.path}</span>
                  </span>
                  <span className="text-xs capitalize text-slate-400">{result.kind}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} total={results.length} onChange={setPage} label="results" />
    </section>
  );
}
