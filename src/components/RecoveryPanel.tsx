'use client';
import { useState } from 'react';
export function RecoveryPanel({ trash, versions, onRestored, disabled }: { trash: any[]; versions: any[]; onRestored: () => Promise<void>; disabled: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function restore(kind: string, id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/storage-state/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Restore failed.');
      await onRestored();
    } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed.'); }
    finally { setBusy(false); }
  }
  const groups = [...new Map(trash.map(t => [t.batchId, t])).values()];
  return <details className="max-w-7xl w-full mx-auto px-6 py-4 text-sm text-slate-300">
    <summary className="cursor-pointer">Recovery and file history ({groups.length} deleted groups, {versions.length} file versions)</summary>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p className="text-xs my-3">Restoring a deleted group restores its folders and files together. Content versions restore earlier file bytes and metadata; metadata versions restore earlier names, descriptions, locations, and permissions.</p>
    <div className="max-h-80 overflow-y-auto space-y-2">
      {groups.map(e => <div key={e.id} className="flex justify-between gap-4"><span>Deleted: {e.record.name} — {new Date(e.deletedAt).toLocaleString()}</span><button disabled={disabled || busy} onClick={() => restore('trash', e.id)} className="storage-button">Restore group</button></div>)}
      {[...versions].reverse().map(e => <div key={e.id} className="flex justify-between gap-4"><span>{e.record.name} — {new Date(e.createdAt).toLocaleString()}</span><button disabled={disabled || busy} onClick={() => restore('versions', e.id)} className="storage-button">{e.kind === 'content' ? 'Restore file version' : 'Restore metadata'}</button></div>)}
    </div>
  </details>;
}
