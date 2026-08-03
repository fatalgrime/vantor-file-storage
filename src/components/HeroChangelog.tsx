'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Edit3, Plus, Check, ChevronDown, ChevronUp, FileCode, Trash2 } from 'lucide-react';
import { HeroChangelogData, UserRole } from '../lib/types';

interface HeroChangelogProps {
  changelog: HeroChangelogData;
  onUpdateChangelog: (data: HeroChangelogData) => void;
  currentRole: UserRole;
  currentFolderName?: string;
}

export const HeroChangelog: React.FC<HeroChangelogProps> = ({
  changelog,
  onUpdateChangelog,
  currentRole,
  currentFolderName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [title, setTitle] = useState(changelog.title);
  const [subtitle, setSubtitle] = useState(changelog.subtitle);
  const [newVersion, setNewVersion] = useState('');
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    setTitle(changelog.title);
    setSubtitle(changelog.subtitle);
  }, [changelog.title, changelog.subtitle]);

  const handleSaveTitle = () => {
    onUpdateChangelog({ ...changelog, title, subtitle });
    setIsEditing(false);
  };

  const handleAddReleaseItem = () => {
    if (!newItem.trim()) return;
    const updatedReleases = [...changelog.releases];
    if (updatedReleases.length > 0) {
      updatedReleases[0].items.push(newItem.trim());
    } else {
      updatedReleases.push({
        date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
        version: newVersion || 'v1.11.3',
        items: [newItem.trim()]
      });
    }
    onUpdateChangelog({ ...changelog, releases: updatedReleases });
    setNewItem('');
  };

  const handleCreateRelease = () => {
    const version = newVersion.trim();
    const item = newItem.trim();
    if (!version || !item) return;

    onUpdateChangelog({
      ...changelog,
      releases: [
        {
          date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
          version,
          items: [item],
        },
        ...changelog.releases,
      ],
    });
    setNewVersion('');
    setNewItem('');
  };

  const handleUpdateRelease = (
    releaseIndex: number,
    updates: Partial<HeroChangelogData['releases'][number]>
  ) => {
    const updatedReleases = changelog.releases.map((release, index) =>
      index === releaseIndex ? { ...release, ...updates } : release
    );
    onUpdateChangelog({ ...changelog, releases: updatedReleases });
  };

  const handleUpdateReleaseItem = (releaseIndex: number, itemIndex: number, value: string) => {
    const updatedReleases = changelog.releases.map((release, index) => {
      if (index !== releaseIndex) return release;
      return {
        ...release,
        items: release.items.map((item, noteIndex) => noteIndex === itemIndex ? value : item),
      };
    });
    onUpdateChangelog({ ...changelog, releases: updatedReleases });
  };

  const handleDeleteReleaseItem = (releaseIndex: number, itemIndex: number) => {
    const updatedReleases = changelog.releases.map((release, index) => {
      if (index !== releaseIndex) return release;
      return {
        ...release,
        items: release.items.filter((_, noteIndex) => noteIndex !== itemIndex),
      };
    });
    onUpdateChangelog({ ...changelog, releases: updatedReleases });
  };

  const handleDeleteRelease = (releaseIndex: number) => {
    onUpdateChangelog({
      ...changelog,
      releases: changelog.releases.filter((_, index) => index !== releaseIndex),
    });
  };

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-glow-card transition-all">
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 opacity-90"></div>

      <div className="px-6 py-5">
        {/* Header Title Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900/50 border border-blue-700/60 text-blue-400 shadow-inner">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-blue-500 rounded px-3 py-1 text-lg font-bold text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs font-medium text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveTitle}
                    className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-500 flex items-center space-x-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                  <span>{currentFolderName ? `${changelog.title} / ${currentFolderName}` : changelog.title}</span>
                  {currentRole === 'admin' && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-slate-400 hover:text-blue-400 transition-colors p-1"
                      title="Edit title"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </h1>
              )}
              <p className="text-xs text-slate-400 font-medium mt-0.5">{changelog.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-blue-950/80 border border-blue-800/60 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-blue-300">
              <Sparkles className="mr-1 h-3 w-3 text-cyan-400" />
              VERIFIED RELEASE
            </span>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:text-white transition-colors"
              title={isCollapsed ? "Expand Changelog" : "Collapse Changelog"}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Pinned Release Changelog Section (Matching screenshot typography & spacing) */}
        {!isCollapsed && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <h2 className="text-lg font-extrabold text-white tracking-tight mb-3">Changelog</h2>

            <div className="space-y-4 font-sans text-sm text-slate-200">
              {changelog.releases.map((rel, rIdx) => (
                <div key={rIdx} className="space-y-1">
                  {currentRole === 'admin' && isEditing ? (
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={rel.date}
                          onChange={(e) => handleUpdateRelease(rIdx, { date: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <input
                          value={rel.version}
                          onChange={(e) => handleUpdateRelease(rIdx, { version: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleDeleteRelease(rIdx)}
                          className="inline-flex items-center justify-center rounded border border-red-800 bg-red-950/60 px-2 py-1 text-xs text-red-200 hover:bg-red-900"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {rel.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex items-center gap-2">
                            <input
                              value={item}
                              onChange={(e) => handleUpdateReleaseItem(rIdx, iIdx, e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => handleDeleteReleaseItem(rIdx, iIdx)}
                              className="rounded p-1.5 text-red-300 hover:bg-red-950/70"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                        <span className="text-blue-400">{rel.date}</span>
                        <span className="text-slate-400">-</span>
                        <span>Release {rel.version}</span>
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs sm:text-sm pl-2 leading-relaxed">
                        {rel.items.map((item, iIdx) => (
                          <li key={iIdx} className="marker:text-blue-500">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))}
              {changelog.releases.length === 0 && (
                <p className="text-xs text-slate-500">No changelog entries yet.</p>
              )}
            </div>

            {/* Admin Add Note Bar */}
            {currentRole === 'admin' && (
              <div className="mt-4 grid gap-2 pt-3 border-t border-slate-800/50 sm:grid-cols-[140px_1fr_auto_auto]">
                <input
                  type="text"
                  placeholder="Version"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRelease()}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Release note..."
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddReleaseItem()}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddReleaseItem}
                  className="flex items-center space-x-1 rounded-lg bg-blue-600/90 hover:bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Note</span>
                </button>
                <button
                  onClick={handleCreateRelease}
                  disabled={!newVersion.trim() || !newItem.trim()}
                  className="flex items-center justify-center space-x-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Release</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
