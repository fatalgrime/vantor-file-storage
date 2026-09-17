'use client';

import React from 'react';

export const PAGE_SIZE = 50;

export function Pagination({ page, total, onChange, label = 'items' }: {
  page: number; total: number; onChange: (page: number) => void; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return (
    <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-slate-400">
      <span role="status">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} {label}</span>
      <div className="flex items-center gap-2">
        <button className="storage-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="storage-button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
