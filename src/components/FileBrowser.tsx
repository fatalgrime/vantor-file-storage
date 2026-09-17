'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder,
  FileText,
  File,
  FileCode,
  FileArchive,
  FileCheck,
  Image as ImageIcon,
  MoreHorizontal,
  Download,
  Eye,
  Trash2,
  Edit,
  ShieldAlert,
  Copy,
  Lock,
  Users,
  CheckSquare,
  Square,
  ArrowUpDown,
  FolderInput
} from 'lucide-react';
import { VantorFile, VantorFolder, UserRole } from '../lib/types';
import { Pagination, PAGE_SIZE } from './Pagination';
import { formatRelativeTime, parseDate } from '../lib/dateUtils';

interface FileBrowserProps {
  folders: VantorFolder[];
  files: VantorFile[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  onClearFilters?: () => void;
  onOpenFolder: (folderId: string) => void;
  onPreviewFile: (file: VantorFile) => void;
  onDownloadFile: (file: VantorFile) => void;
  onCopyLink: (item: VantorFile | VantorFolder) => void;
  onEditItem: (item: VantorFile | VantorFolder, isFolder: boolean) => void;
  onManagePermissions: (item: VantorFile | VantorFolder, isFolder: boolean) => void;
  onDeleteItem: (id: string, isFolder: boolean) => void;
  onMoveItem: (item: VantorFile | VantorFolder, isFolder: boolean) => void;
  viewMode: 'list' | 'grid';
  currentRole: UserRole;
  canEdit: (item: VantorFile | VantorFolder) => boolean;
  canDelete: boolean;
  canManagePermissions: (item: VantorFile | VantorFolder) => boolean;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  folders,
  files,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  loading = false,
  emptyMessage = 'This folder is empty.',
  onClearFilters,
  onOpenFolder,
  onPreviewFile,
  onDownloadFile,
  onCopyLink,
  onEditItem,
  onManagePermissions,
  onDeleteItem,
  onMoveItem,
  viewMode,
  currentRole: _currentRole,
  canEdit,
  canDelete,
  canManagePermissions,
}) => {
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    x: number;
    y: number;
    isFolder: boolean;
  } | null>(null);
  const [sortField, setSortField] = useState<'name' | 'type' | 'size' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const totalItems = folders.length + files.length;


  const handleSort = (field: 'name' | 'type' | 'size' | 'modified') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedFolders = useMemo(() => {
    const copy = [...folders];
    copy.sort((a, b) => {
      let comp = 0;
      if (sortField === 'name') comp = a.name.localeCompare(b.name);
      else if (sortField === 'type') comp = 0;
      else if (sortField === 'size') comp = a.totalSize - b.totalSize;
      else if (sortField === 'modified') {
        const timeA = parseDate(a.updatedAt)?.getTime() || parseDate(a.createdAt)?.getTime() || 0;
        const timeB = parseDate(b.updatedAt)?.getTime() || parseDate(b.createdAt)?.getTime() || 0;
        comp = timeA - timeB;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
    return copy;
  }, [folders, sortField, sortOrder]);

  const sortedFiles = useMemo(() => {
    const copy = [...files];
    copy.sort((a, b) => {
      let comp = 0;
      if (sortField === 'name') comp = a.name.localeCompare(b.name);
      else if (sortField === 'type') comp = a.fileType.localeCompare(b.fileType);
      else if (sortField === 'size') comp = a.size - b.size;
      else if (sortField === 'modified') {
        const timeA = parseDate(a.updatedAt)?.getTime() || parseDate(a.createdAt)?.getTime() || 0;
        const timeB = parseDate(b.updatedAt)?.getTime() || parseDate(b.createdAt)?.getTime() || 0;
        comp = timeA - timeB;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
    return copy;
  }, [files, sortField, sortOrder]);

  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / PAGE_SIZE)));
  const start = (page - 1) * PAGE_SIZE;
  const pageFolders = sortedFolders.slice(start, start + PAGE_SIZE);
  const pageFiles = sortedFiles.slice(Math.max(0, start - sortedFolders.length), Math.max(0, start + PAGE_SIZE - sortedFolders.length));
  const pageIds = [...pageFolders, ...pageFiles].map((item) => item.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const resultKey = [...folders, ...files].map((item) => item.id).join('|');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { setPage(1); setActiveMenu(null); }, [resultKey, sortField, sortOrder]);
  useEffect(() => {
    if (!activeMenu) return;
    menuRef.current?.querySelector('button')?.focus();
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuTriggerRef.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [activeMenu]);

  const handleMenuToggle = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
    isFolder: boolean
  ) => {
    event.stopPropagation();

    if (activeMenu?.id === id) {
      setActiveMenu(null);
      return;
    }

    menuTriggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveMenu({
      id,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 192)),
      y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 320)),
      isFolder,
    });
  };

  const closeActionMenu = () => {
    setActiveMenu(null);
    if (menuTriggerRef.current?.isConnected) menuTriggerRef.current.focus();
  };

  const renderActionMenu = () => {
    if (!activeMenu) return null;

    const item = activeMenu.isFolder
      ? folders.find((folder) => folder.id === activeMenu.id)
      : files.find((file) => file.id === activeMenu.id);

    if (!item) return null;

    return createPortal(
      <div
        className="fixed z-[100] w-44 rounded-md border border-slate-700 bg-slate-900 py-1 text-left text-xs shadow-2xl"
        style={{ left: activeMenu.x, top: activeMenu.y }}
        ref={menuRef}
        role="group"
        aria-label={`Actions for ${item.name}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeActionMenu(); menuTriggerRef.current?.focus(); }
          if (event.key === 'Tab') { closeActionMenu(); menuTriggerRef.current?.focus(); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          }
        }}
      >
        {activeMenu.isFolder ? (
          <button
            onClick={() => { onOpenFolder(item.id); closeActionMenu(); }}
            className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
          >
            <Eye className="h-3.5 w-3.5 text-blue-400" />
            <span>Open folder</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => { onPreviewFile(item as VantorFile); closeActionMenu(); }}
              className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
            >
              <Eye className="h-3.5 w-3.5 text-blue-400" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => { onDownloadFile(item as VantorFile); closeActionMenu(); }}
              className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download</span>
            </button>
          </>
        )}

        <button
          onClick={() => { onCopyLink(item); closeActionMenu(); }}
          className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
        >
          <Copy className="h-3.5 w-3.5 text-slate-400" />
          <span>Copy link</span>
        </button>

        {(canEdit(item) || canDelete || canManagePermissions(item)) && (
          <>
            {canManagePermissions(item) && (
              <button
                onClick={() => { onManagePermissions(item, activeMenu.isFolder); closeActionMenu(); }}
                className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
              >
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Permissions</span>
              </button>
            )}
            {canEdit(item) && (
              <>
                <button
                  onClick={() => { onEditItem(item, activeMenu.isFolder); closeActionMenu(); }}
                  className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
                >
                  <Edit className="h-3.5 w-3.5 text-slate-400" />
                  <span>{activeMenu.isFolder ? 'Rename' : 'Edit metadata'}</span>
                </button>
                <button
                  onClick={() => { onMoveItem(item, activeMenu.isFolder); closeActionMenu(); }}
                  className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-slate-200"
                >
                  <FolderInput className="h-3.5 w-3.5 text-blue-400" />
                  <span>Move</span>
                </button>
              </>
            )}
            {canDelete && (
              <>
                <div className="my-1 border-t border-slate-800"></div>
                <button
                  onClick={() => { onDeleteItem(item.id, activeMenu.isFolder); closeActionMenu(); }}
                  className="w-full min-h-9 px-3 py-1.5 hover:bg-slate-800 flex items-center space-x-2 text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </>
        )}
      </div>,
      document.body
    );
  };

  // Helper icon selector based on file extension & type
  const getFileIcon = (file: VantorFile) => {
    const ext = file.extension.toLowerCase();
    if (ext === 'md' || file.fileType.includes('Markdown')) {
      return <FileText className="h-4 w-4 text-slate-100 flex-shrink-0" />;
    }
    if (['rbxm', 'bin', 'exe', 'dat'].includes(ext) || file.fileType.includes('Unknown')) {
      return <File className="h-4 w-4 text-slate-300 flex-shrink-0" />;
    }
    if (['svg', 'png', 'jpg', 'webp'].includes(ext)) {
      return <ImageIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />;
    }
    if (['json', 'ts', 'js', 'py'].includes(ext)) {
      return <FileCode className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
    }
    if (['zip', 'gz', 'tar', 'rar'].includes(ext)) {
      return <FileArchive className="h-4 w-4 text-amber-400 flex-shrink-0" />;
    }
    return <FileCheck className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  };

  const getPermissionBadge = (level: string) => {
    switch (level) {
      case 'admin_only':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-red-950/80 border border-red-800/60 px-1.5 py-0.5 text-[10px] font-mono text-red-300" title="Admin Only Access">
            <Lock className="h-2.5 w-2.5" />
            <span>Admin</span>
          </span>
        );
      case 'authenticated':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-blue-950/80 border border-blue-800/60 px-1.5 py-0.5 text-[10px] font-mono text-blue-300" title="Vantor Auth Users Only">
            <Users className="h-2.5 w-2.5" />
            <span>Auth</span>
          </span>
        );
      case 'role_restricted':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.5 text-[10px] font-mono text-amber-300" title="Role Restricted Access">
            <ShieldAlert className="h-2.5 w-2.5" />
            <span>Role</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) return <div role="status" aria-live="polite" className="rounded-lg border border-slate-800 p-8 text-center text-sm text-slate-400">Loading files and folders…</div>;
  if (totalItems === 0) return (
    <div role="status" className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
      <p>{emptyMessage}</p>
      {onClearFilters && <button className="storage-button mt-3" onClick={onClearFilters}>Clear search and filters</button>}
    </div>
  );

  return (
    <div className="file-browser w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs text-slate-400">
        <button className="storage-button" aria-pressed={allSelected} onClick={() => onToggleSelectAll(pageIds)}>{allSelected ? 'Deselect page' : 'Select page'}</button>
        <span role="status">{selectedIds.length} selected · {totalItems} items</span>
      </div>
      {viewMode === 'list' ? (
        /* List View Table matching user screenshot layout */
        <div className="overflow-x-auto rounded-lg border border-[#1e3059] bg-[#070c18]">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-[#1e3059] bg-[#090f21] text-slate-400 select-none">
                <th className="w-10 px-3 py-2.5 text-center">
                  <button aria-label="Select or deselect this page" aria-pressed={allSelected} onClick={() => onToggleSelectAll(pageIds)} className="text-slate-400 hover:text-white transition-colors">
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5 font-semibold text-slate-300">
                  <button onClick={() => handleSort('name')} className="flex items-center space-x-1 hover:text-white">
                    <span>Name</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </button>
                </th>
                <th className="w-10 px-2 py-2.5 text-center"></th>
                <th className="px-3 py-2.5 font-semibold text-slate-300">
                  <button onClick={() => handleSort('type')} className="flex items-center space-x-1 hover:text-white">
                    <span>File type</span>
                  </button>
                </th>
                <th className="px-3 py-2.5 font-semibold text-slate-300 text-right">
                  <button onClick={() => handleSort('size')} className="flex items-center space-x-1 hover:text-white ml-auto">
                    <span>Size</span>
                  </button>
                </th>
                <th className="px-3 py-2.5 font-semibold text-slate-300 text-right">
                  <button onClick={() => handleSort('modified')} className="flex items-center space-x-1 hover:text-white ml-auto">
                    <span>Modified</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3059]/40 text-slate-200">
              {/* Folder Rows */}
              {pageFolders.map((folder) => {
                const isSelected = selectedIds.includes(folder.id);
                return (
                  <tr
                    key={folder.id}
                    className={`vantor-table-row group select-none ${isSelected ? 'bg-blue-950/40' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <button aria-label={`Select ${folder.name}`} aria-pressed={isSelected} onClick={() => onToggleSelect(folder.id)} className="text-slate-400 hover:text-white">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-700 group-hover:text-slate-500" />
                        )}
                      </button>
                    </td>

                    {/* Name + Icon */}
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2.5">
                        <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20 flex-shrink-0" />
                        <button
                          onClick={() => onOpenFolder(folder.id)}
                          className="font-medium text-white hover:text-blue-400 hover:underline transition-colors text-left truncate max-w-xs sm:max-w-md"
                        >
                          {folder.name}
                        </button>
                        {getPermissionBadge(folder.permissionLevel)}
                      </div>
                    </td>

                    {/* Options Context Menu Button */}
                    <td className="px-2 py-2 text-center relative">
                      <button
                        aria-label={`Actions for ${folder.name}`}
                        aria-expanded={activeMenu?.id === folder.id}
                        onClick={(event) => handleMenuToggle(event, folder.id, true)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>

                    {/* File Type */}
                    <td className="px-3 py-2 text-slate-300 font-medium">Folder</td>

                    {/* Size */}
                    <td className="px-3 py-2 text-right text-slate-400 font-mono">{folder.formattedSize}</td>

                    {/* Modified */}
                    <td className="px-3 py-2 text-right text-slate-400">{formatRelativeTime(folder.updatedAt, folder.createdAt, { concise: true })}</td>
                  </tr>
                );
              })}

              {/* File Rows */}
              {pageFiles.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <tr
                    key={file.id}
                    className={`vantor-table-row group select-none ${isSelected ? 'bg-blue-950/40' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <button aria-label={`Select ${file.name}`} aria-pressed={isSelected} onClick={() => onToggleSelect(file.id)} className="text-slate-400 hover:text-white">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-700 group-hover:text-slate-500" />
                        )}
                      </button>
                    </td>

                    {/* Name + Icon */}
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2.5">
                        {getFileIcon(file)}
                        <button
                          onClick={() => onPreviewFile(file)}
                          className="font-medium text-white hover:text-blue-400 hover:underline transition-colors text-left truncate max-w-xs sm:max-w-md"
                        >
                          {file.name}
                        </button>
                        {getPermissionBadge(file.permissionLevel)}
                      </div>
                    </td>

                    {/* Context Action Button */}
                    <td className="px-2 py-2 text-center relative">
                      <button
                        aria-label={`Actions for ${file.name}`}
                        aria-expanded={activeMenu?.id === file.id}
                        onClick={(event) => handleMenuToggle(event, file.id, false)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>

                    {/* File Type */}
                    <td className="px-3 py-2 text-slate-300 font-medium">{file.fileType}</td>

                    {/* Size */}
                    <td className="px-3 py-2 text-right text-slate-400 font-mono">{file.formattedSize}</td>

                    {/* Modified */}
                    <td className="px-3 py-2 text-right text-slate-400">{formatRelativeTime(file.updatedAt, file.createdAt, { concise: true })}</td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageFolders.map((folder) => {
            const isSelected = selectedIds.includes(folder.id);
            return (
              <div
                key={folder.id}
                className={`relative rounded-xl border p-4 transition-all hover:border-blue-500/80 bg-[#070d1d] cursor-pointer group ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-950/20' : 'border-[#1e3059]'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenFolder(folder.id); } }} onClick={() => onOpenFolder(folder.id)}>
                    <Folder className="h-8 w-8 text-blue-500 fill-blue-500/20 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-white group-hover:text-blue-400 truncate">
                        {folder.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">{folder.itemCount} items · {folder.formattedSize}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button aria-label={`Actions for ${folder.name}`} aria-expanded={activeMenu?.id === folder.id} className="storage-icon-button" onClick={(event) => handleMenuToggle(event, folder.id, true)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <button aria-label={`Select ${folder.name}`} aria-pressed={isSelected} onClick={(e) => { e.stopPropagation(); onToggleSelect(folder.id); }}>
                      {isSelected ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4 text-slate-600" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {pageFiles.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            return (
              <div
                key={file.id}
                className={`relative rounded-xl border p-4 transition-all hover:border-blue-500/80 bg-[#070d1d] group ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-950/20' : 'border-[#1e3059]'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPreviewFile(file); } }} onClick={() => onPreviewFile(file)}>
                    {getFileIcon(file)}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-white group-hover:text-blue-400 truncate">
                        {file.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">{file.fileType} · {file.formattedSize}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button aria-label={`Actions for ${file.name}`} aria-expanded={activeMenu?.id === file.id} className="storage-icon-button" onClick={(event) => handleMenuToggle(event, file.id, false)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <button aria-label={`Select ${file.name}`} aria-pressed={isSelected} onClick={() => onToggleSelect(file.id)}>
                      {isSelected ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4 text-slate-600" />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>Modified: {formatRelativeTime(file.updatedAt, file.createdAt, { concise: true })}</span>
                  <button onClick={() => onDownloadFile(file)} className="text-blue-400 hover:underline flex items-center space-x-1">
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} total={totalItems} onChange={(next) => { setPage(next); setActiveMenu(null); }} />
      {renderActionMenu()}
    </div>
  );
};
