'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useStorageState } from '../hooks/useStorageState';
import { uploadFile } from '../lib/upload';
import { RecoveryPanel } from './RecoveryPanel';
import { Navbar } from './Navbar';
import { formatBytes, formatRelativeTime, getRepositoryLastUpdated, matchesModifiedFilter } from '../lib/dateUtils';
import { detectFileType } from '../lib/utils';
import { matchesSearch } from '../lib/search';
import { getSearchResults, SearchResult } from '../lib/searchResults';
import { SearchResults } from './SearchResults';
import { useDialog } from '../hooks/useDialog';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, X, Mail, Activity, Upload, Trash2, Key, Folder, ShieldAlert } from 'lucide-react';
import { HeroChangelog } from './HeroChangelog';
import { FileBrowser } from './FileBrowser';
import { FilePreviewModal } from './FilePreviewModal';
import { AdminDashboard, AdminTab } from './AdminDashboard';
import { AccessControlModal } from './AccessControlModal';
import { FooterSummary } from './FooterSummary';
import { Breadcrumbs } from './Breadcrumbs';
import { ToastProvider, useToast } from './ToastProvider';
import { AnnouncementBanner } from './AnnouncementBanner';
import { CustomSelect } from './CustomSelect';
import {
  ALL_USER_ROLES,
  canDeleteContent as userCanDeleteContent,
  canEditRepository as userCanEditRepository,
  canManagePlatform as userCanManagePlatform,
  canReadItem,
  hasRepositoryAccess,
  canEditItem,
} from '../lib/authorization';
import { DEFAULT_REPOSITORY_ID } from '../lib/db';
import { VantorFile, VantorFolder, AuditLog, HeroChangelogData, UserRole, PermissionLevel, VantorRepository, VantorUser, Collaborator, ShareLink, Announcement, FileComment } from '../lib/types';

interface PersistedState {
  files: VantorFile[];
  folders: VantorFolder[];
  repositories: VantorRepository[];
  changelog: HeroChangelogData;
  changelogs?: Record<string, HeroChangelogData>;
  auditLogs: AuditLog[];
  users: VantorUser[];
  announcements?: Announcement[];
  shares?: ShareLink[];
  comments?: FileComment[];
  settings?: {
    theme?: 'dark' | 'light';
  };
}

type AppDialog =
  | {
    type: 'confirm';
    title: string;
    message: string;
    confirmLabel: string;
    tone?: 'danger' | 'primary';
    onConfirm: () => void;
  }
  | {
    type: 'rename';
    item: VantorFile | VantorFolder;
    isFolder: boolean;
    value: string;
  }
  | {
    type: 'createRepository';
    name: string;
    description: string;
  }
  | {
    type: 'renameRepository';
    repository: VantorRepository;
    name: string;
    description: string;
  }
  | {
    type: 'deleteRepository';
    repository: VantorRepository;
    confirmation: string;
  }
  | {
    type: 'move';
    item: VantorFile | VantorFolder;
    isFolder: boolean;
    destinationRepositoryId: string;
    destinationFolderId: string;
  }
  | {
    type: 'notice';
    title: string;
    message: string;
  };

interface DashboardClientProps {
  initialRepositoryId?: string;
  initialSearchQuery?: string;
  initialFolderId?: string;
  showRepositoryIndex?: boolean;
}

const createScopedChangelog = (title: string, subtitle: string): HeroChangelogData => ({
  title,
  subtitle,
  releases: [],
});

function DashboardClientInner({ initialRepositoryId, initialSearchQuery = '', initialFolderId, showRepositoryIndex = true }: DashboardClientProps) {
  const { addToast } = useToast();
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Database & Auth state
  const [files, setFiles] = useState<VantorFile[]>([]);
  const [folders, setFolders] = useState<VantorFolder[]>([]);
  const [repositories, setRepositories] = useState<VantorRepository[]>([]);
  const [currentRepositoryId, setCurrentRepositoryId] = useState('');
  const [changelog, setChangelog] = useState<HeroChangelogData>({ title: '', subtitle: '', releases: [] });
  const [changelogs, setChangelogs] = useState<Record<string, HeroChangelogData>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [managedUsers, setManagedUsers] = useState<VantorUser[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);


  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Vantor User';

  const [recovery, setRecovery] = useState<{ trash: any[]; versions: any[] }>({ trash: [], versions: [] });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const completedUploads = useRef(new WeakMap<Blob, { fileId: string; url: string; size: number; repositoryId: string; folderId: string | null }>());
  const applyServerState = (data: any) => {
    setFiles(data.files); setFolders(data.folders); setRepositories(data.repositories);
    setManagedUsers(data.users); setShares(data.shares); setComments(data.comments);
    setAuditLogs(data.auditLogs); setAnnouncements(data.announcements);
    setChangelog(data.changelog); setChangelogs(data.changelogs);
    const preference = localStorage.getItem('vantor-theme-' + user?.id);
    setTheme(preference === 'light' || preference === 'dark' ? preference : data.settings?.theme || 'dark');
    setRecovery({ trash: data.trash || [], versions: data.versions || [] });
  };
  const { persistState, initialize, reload, saveStatus, saveError } = useStorageState(applyServerState);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;

    const loadState = async () => {
      try {
        const response = await fetch('/api/storage-state');
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Failed to load database state.');
        }

        const data = await response.json() as PersistedState;
        initialize(data);
        applyServerState(data);
        const currentRepositories = data.repositories || [];
        const availableRepositories = currentRepositories;
        const requestedRepositoryExists = initialRepositoryId && availableRepositories.some((repository) => repository.id === initialRepositoryId);
        setCurrentRepositoryId(requestedRepositoryExists ? initialRepositoryId : availableRepositories[0]?.id || '');
        const self = data.users.find(u => u.id === user?.id);
        setCurrentRole(self?.role || 'viewer');
        setLoadError('');
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load database state.');
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [isSignedIn, user?.id, initialRepositoryId]);

  // Administrators can preview the interface as a lower role.
  const [currentRole, setCurrentRole] = useState<UserRole>('viewer');

  // Navigation & Directory state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Selection state
  const [storedSelectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering & View state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modifiedFilter, setModifiedFilter] = useState('ALL');
  const [dashboardViewMode, setDashboardViewMode] = useState<'list' | 'grid'>('grid');
  const [repositoryViewMode, setRepositoryViewMode] = useState<'list' | 'grid'>('list');

  // Modal states
  const [previewFile, setPreviewFile] = useState<VantorFile | null>(null);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [adminTabDefault, setAdminTabDefault] = useState<AdminTab>('upload');

  // Announcement Handlers
  const handleCreateAnnouncement = (newAnnouncement: Partial<Announcement>) => {
    if (!canManagePlatform) return;
    const created: Announcement = {
      id: `announcement-${Date.now()}`,
      title: newAnnouncement.title || 'Untitled Announcement',
      content: newAnnouncement.content || '',
      type: newAnnouncement.type || 'info',
      isActive: newAnnouncement.isActive ?? true,
      createdAt: new Date().toISOString(),
      createdBy: displayName || 'Admin Operator',
      linkUrl: newAnnouncement.linkUrl,
      linkText: newAnnouncement.linkText,
    };

    const nextAnnouncements = [created, ...announcements];
    const log: AuditLog = {
      id: 'log-' + crypto.randomUUID(),
      action: 'ANNOUNCEMENT_CREATE',
      targetName: created.title,
      targetType: 'announcement',
      performedBy: displayName,
      role: effectiveRole,
      timestamp: new Date().toISOString(),
      details: `Published sitewide announcement "${created.title}" [${created.type.toUpperCase()}]`,
    };

    const nextLogs = [log, ...auditLogs];
    setAnnouncements(nextAnnouncements);
    setAuditLogs(nextLogs);
    persistState({ announcements: nextAnnouncements, auditLogs: nextLogs }).catch(() => {});
  };

  const handleUpdateAnnouncement = (id: string, updates: Partial<Announcement>) => {
    if (!canManagePlatform) return;
    const nextAnnouncements = announcements.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
    const target = announcements.find((a) => a.id === id);

    const log: AuditLog = {
      id: 'log-' + crypto.randomUUID(),
      action: 'ANNOUNCEMENT_UPDATE',
      targetName: target?.title || id,
      targetType: 'announcement',
      performedBy: displayName,
      role: effectiveRole,
      timestamp: new Date().toISOString(),
      details: `Updated announcement status/details for "${target?.title || id}"`,
    };

    const nextLogs = [log, ...auditLogs];
    setAnnouncements(nextAnnouncements);
    setAuditLogs(nextLogs);
    persistState({ announcements: nextAnnouncements, auditLogs: nextLogs }).catch(() => {});
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!canManagePlatform) return;
    const target = announcements.find((a) => a.id === id);
    const nextAnnouncements = announcements.filter((a) => a.id !== id);

    const log: AuditLog = {
      id: 'log-' + crypto.randomUUID(),
      action: 'ANNOUNCEMENT_DELETE',
      targetName: target?.title || id,
      targetType: 'announcement',
      performedBy: displayName,
      role: effectiveRole,
      timestamp: new Date().toISOString(),
      details: `Deleted announcement "${target?.title || id}"`,
    };

    const nextLogs = [log, ...auditLogs];
    setAnnouncements(nextAnnouncements);
    setAuditLogs(nextLogs);
    persistState({ announcements: nextAnnouncements, auditLogs: nextLogs }).catch(() => {});
  };

  // Access Control Permission Modal state
  const [permissionTarget, setPermissionTarget] = useState<{
    item: VantorFile | VantorFolder;
    isFolder: boolean;
  } | null>(null);
  const [dialog, setDialog] = useState<AppDialog | null>(null);
  const dialogRef = useDialog(Boolean(dialog), () => setDialog(null));
  const helpRef = useDialog(isHelpOpen, () => setIsHelpOpen(false));

  const handleSetTheme = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    localStorage.setItem('vantor-theme-' + user?.id, nextTheme);
  };

  const currentRepository = useMemo(() => {
    return repositories.find((repository) => repository.id === currentRepositoryId);
  }, [repositories, currentRepositoryId]);

  const currentChangelogKey = currentFolderId
    ? `folder:${currentFolderId}`
    : showRepositoryIndex
      ? 'project'
      : `repository:${currentRepositoryId}`;

  const currentChangelog = useMemo(() => {
    if (currentChangelogKey === 'project') return changelog;

    const repoName = currentRepository?.name || 'Repository Workspace';
    return changelogs[currentChangelogKey] || createScopedChangelog(
      currentFolderId ? `${repoName} Folder Changelog` : `${repoName} Changelog`,
      currentFolderId
        ? 'Folder-specific release notes and content updates.'
        : 'Repository-specific release notes and content updates.'
    );
  }, [changelog, changelogs, currentChangelogKey, currentFolderId, currentRepository?.name]);

  const currentManagedUser = useMemo(() => {
    return managedUsers.find((managedUser) => managedUser.id === user?.id);
  }, [managedUsers, user?.id]);

  const greetingMessage = useMemo(() => {
    const username = user?.firstName || user?.fullName || currentManagedUser?.name || 'User';
    const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const greetings = [
      `Hello, ${username}`,
      `Hope you are having a great ${weekday}, ${username}`,
      `Welcome back, ${username}`,
      `Happy ${weekday}, ${username}`,
      `Good to see you, ${username}`,
      `Wishing you a wonderful ${weekday}, ${username}`,
    ];

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return greetings[dayOfYear % greetings.length];
  }, [user?.firstName, user?.fullName, currentManagedUser?.name]);

  const actualRole = currentManagedUser?.role || 'viewer';
  const canUseRoleSwitcher = actualRole === 'admin';
  const effectiveRole = canUseRoleSwitcher ? currentRole : actualRole;
  const currentUserId = user?.id || '';

  const canViewRepository = (repository: VantorRepository) => hasRepositoryAccess(effectiveRole, currentUserId, repository, files, folders);
  const canEditRepository = (repository: VantorRepository) => userCanEditRepository(effectiveRole, currentUserId, repository);
  const canDeleteContent = userCanDeleteContent(effectiveRole);
  const canManagePlatform = userCanManagePlatform(effectiveRole);

  // Comment Action Handlers
  const handleAddComment = (fileId: string, content: string, parentId?: string | null, mentions?: string[]) => {
    const newComment: FileComment = {
      id: 'comment-' + Math.random().toString(36).substring(2, 11),
      fileId,
      authorId: currentUserId || 'user-anonymous',
      authorName: displayName,
      authorEmail: user?.primaryEmailAddress?.emailAddress,
      authorRole: effectiveRole,
      content,
      createdAt: new Date().toISOString(),
      parentId: parentId || null,
      resolved: false,
      mentions: mentions || [],
    };

    const updatedComments = [newComment, ...comments];
    setComments(updatedComments);
    persistState({ comments: updatedComments }).catch((err) => console.error('Failed to save comment:', err));
    addToast({
      type: 'success',
      title: 'Comment posted',
      message: 'Your comment has been added to the discussion.',
    });
  };

  const handleResolveComment = (commentId: string) => {
    const updatedComments = comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c));
    setComments(updatedComments);
    persistState({ comments: updatedComments }).catch((err) => console.error('Failed to resolve comment:', err));
  };

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
    setComments(updatedComments);
    persistState({ comments: updatedComments }).catch((err) => console.error('Failed to delete comment:', err));
    addToast({
      type: 'info',
      title: 'Comment deleted',
      message: 'The comment was removed.',
    });
  };
  const canViewCurrentRepository = useMemo(() => {
    if (!currentRepository) return false;
    return canViewRepository(currentRepository);
  }, [currentRepository, effectiveRole, currentUserId, files, folders]);
  const canEditCurrentRepository = currentRepository && canViewCurrentRepository ? canEditRepository(currentRepository) : false;
  const visibleRepositories = useMemo(() => {
    return repositories.filter((repository) => canViewRepository(repository));
  }, [repositories, effectiveRole, currentUserId, files, folders]);

  const displayedRepositories = visibleRepositories;
  const searchResults = useMemo(() => showRepositoryIndex
    ? getSearchResults(searchQuery, repositories, files, folders, effectiveRole, currentUserId)
    : [], [showRepositoryIndex, searchQuery, repositories, files, folders, effectiveRole, currentUserId]);

  const handleOpenSearchResult = (result: SearchResult) => {
    if (result.kind === 'file') {
      setPreviewFile(result.item as VantorFile);
    } else {
      const suffix = result.kind === 'folder' ? `?folder=${encodeURIComponent(result.item.id)}` : '';
      router.push(`/dashboard/repositories/${encodeURIComponent(result.repository.id)}${suffix}`);
    }
  };

  const handleOpenFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
    setSelectedIds([]);
  };

  useEffect(() => {
    if (!showRepositoryIndex) return;
    if (visibleRepositories.some((repository) => repository.id === currentRepositoryId)) return;
    const nextRepositoryId = visibleRepositories[0]?.id || DEFAULT_REPOSITORY_ID;
    setCurrentRepositoryId(nextRepositoryId);
    setCurrentFolderId(null);
    setSelectedIds([]);
  }, [visibleRepositories, currentRepositoryId, showRepositoryIndex]);

  useEffect(() => {
    if (initialRepositoryId && repositories.some((repository) => repository.id === initialRepositoryId)) {
      setCurrentRepositoryId(initialRepositoryId);
    }
  }, [initialRepositoryId, repositories]);

  const repositoryFolders = useMemo(() => {
    return folders.filter((folder) => (folder.repositoryId || DEFAULT_REPOSITORY_ID) === currentRepositoryId && (currentRepository ? canViewRepository(currentRepository) : false));
  }, [folders, currentRepositoryId, currentRepository, effectiveRole, currentUserId]);

  const repositoryFiles = useMemo(() => {
    return files.filter((file) => (file.repositoryId || DEFAULT_REPOSITORY_ID) === currentRepositoryId && (currentRepository ? canViewRepository(currentRepository) : false));
  }, [files, currentRepositoryId, currentRepository, effectiveRole, currentUserId]);

  useEffect(() => {
    if (isLoading || !initialFolderId) return;
    const target = folders.find((folder) => folder.id === initialFolderId &&
      (folder.repositoryId || DEFAULT_REPOSITORY_ID) === initialRepositoryId);
    if (target && canReadItem(effectiveRole, currentUserId, target, folders, currentRepository)) {
      setCurrentFolderId(target.id);
    }
  }, [isLoading, initialFolderId, initialRepositoryId]);

  // Breadcrumb Trail Calculation
  const currentFolderPath = useMemo(() => {
    const trail: { id: string | null; name: string }[] = [{ id: null, name: currentRepository?.name || 'Repository' }];
    let cur = currentFolderId;
    const visited = new Set<string>();
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      const found = repositoryFolders.find((f) => f.id === cur);
      if (found) {
        trail.splice(1, 0, { id: found.id, name: found.name });
        cur = found.parentId;
      } else {
        break;
      }
    }
    return trail;
  }, [currentFolderId, repositoryFolders, currentRepository?.name]);

  // Current folder object
  const currentFolder = useMemo(() => {
    return repositoryFolders.find((f) => f.id === currentFolderId);
  }, [currentFolderId, repositoryFolders]);

  // Filtered files & folders
  const displayedFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return repositoryFolders.filter((f) => {
      // Parent folder match
      if (!query && f.parentId !== currentFolderId) return false;

      if (!canReadItem(effectiveRole, currentUserId, f, folders, currentRepository)) return false;

      if (!matchesSearch(f, query)) return false;

      // Type filter
      if (typeFilter !== 'ALL' && typeFilter !== 'Folder') return false;

      // Date modified filter
      if (!matchesModifiedFilter(f.updatedAt, f.createdAt, modifiedFilter)) return false;

      return true;
    });
  }, [repositoryFolders, currentFolderId, effectiveRole, currentUserId, searchQuery, typeFilter, modifiedFilter, folders, currentRepository]);

  const displayedFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return repositoryFiles.filter((f) => {
      // Folder ID match
      if (!query && f.folderId !== currentFolderId) return false;

      if (!canReadItem(effectiveRole, currentUserId, f, folders, currentRepository)) return false;

      if (!matchesSearch(f, query)) return false;

      // Type filter
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'Folder') return false;
        if (typeFilter === 'Markdown document' && f.fileType !== 'Markdown document') return false;
        if (typeFilter === 'Unknown file type' && f.fileType !== 'Unknown file type') return false;
        if (typeFilter === 'PDF Document' && f.fileType !== 'PDF Document') return false;
        if (typeFilter === 'SVG Vector Image' && f.fileType !== 'SVG Vector Image') return false;
        if (typeFilter === 'JSON Document' && f.fileType !== 'JSON Document') return false;
        if (typeFilter === 'ZIP Archive' && f.fileType !== 'ZIP Archive') return false;
      }

      // Date modified filter
      if (!matchesModifiedFilter(f.updatedAt, f.createdAt, modifiedFilter)) return false;

      return true;
    });
  }, [repositoryFiles, currentFolderId, effectiveRole, currentUserId, searchQuery, typeFilter, modifiedFilter, folders, currentRepository]);

  const selectedIds = useMemo(() => {
    const visibleIds = new Set([...displayedFolders, ...displayedFiles].map((item) => item.id));
    return showRepositoryIndex ? [] : storedSelectedIds.filter((id) => visibleIds.has(id));
  }, [storedSelectedIds, displayedFolders, displayedFiles, showRepositoryIndex]);

  useEffect(() => {
    setSelectedIds((previous) => previous.length === selectedIds.length ? previous : selectedIds);
  }, [selectedIds]);

  useEffect(() => { setSelectedIds([]); }, [currentRepositoryId, currentFolderId, effectiveRole, currentUserId]);

  // Overall totals for current view
  const currentTotalSizeFormatted = useMemo(() => {
    const targetFiles = showRepositoryIndex ? files : displayedFiles;
    const targetFolders = showRepositoryIndex ? folders : displayedFolders;
    const totalBytes = targetFiles.reduce((acc, f) => acc + f.size, 0) +
      targetFolders.reduce((acc, f) => acc + f.totalSize, 0);
    return formatBytes(totalBytes);
  }, [showRepositoryIndex, files, displayedFiles, folders, displayedFolders]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (pageIds: string[]) => {
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected
      ? selectedIds.filter((id) => !pageIds.includes(id))
      : [...new Set([...selectedIds, ...pageIds])]);
  };

  // Download logic
  const handleDownloadFile = (file: VantorFile) => {
    const url = '/api/public/files/' + encodeURIComponent(file.id) + '?download=1';
    const isTempBlob = false;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isTempBlob) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Add Audit Log
    addToast({ type: 'success', title: 'Download started', message: `"${file.name}" (${file.formattedSize})` });
  };

  const handleBatchDownload = () => {
    const selectedFileObjects = files.filter((f) => selectedIds.includes(f.id));
    selectedFileObjects.forEach((f) => handleDownloadFile(f));
  };

  const handleBatchDelete = () => {
    if (!canDeleteContent) return;
    if (selectedIds.length === 0) return;

    setDialog({
      type: 'confirm',
      title: 'Delete selected items',
      message: `Delete ${selectedIds.length} selected item(s)? Folders will also remove their contained files.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: performBatchDelete,
    });
  };

  const performBatchDelete = () => {
    const selectedFolderIds = selectedIds.filter((id) => folders.some((f) => f.id === id));
    const selectedFileIds = selectedIds.filter((id) => files.some((f) => f.id === id));
    const deletedFolders = folders.filter((folder) => selectedFolderIds.includes(folder.id));
    const deletedFiles = files.filter((file) =>
      selectedFileIds.includes(file.id) || selectedFolderIds.includes(file.folderId || '')
    );
    const nextFolders = folders.filter((folder) => !selectedFolderIds.includes(folder.id));
    const nextFiles = files.filter((file) =>
      !selectedFileIds.includes(file.id) && !selectedFolderIds.includes(file.folderId || '')
    );
    const newLogs = [
      ...deletedFolders.map((folder) => createAuditLog('DELETE', folder.name, 'folder', 'Deleted folder and subcontents')),
      ...deletedFiles.map((file) => createAuditLog('DELETE', file.name, 'file', 'Deleted file')),
    ];
    const nextLogs = [...newLogs, ...auditLogs];
    const nextRepositories = touchRepository(currentRepositoryId);

    setFolders(nextFolders);
    setFiles(nextFiles);
    setAuditLogs(nextLogs);
    setRepositories(nextRepositories);
    setSelectedIds([]);
    persistState({ folders: nextFolders, files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});

  };

  const handleCopyLink = async (item: VantorFile | VantorFolder) => {
    const existing = shares.find(s => s.itemId === item.id && !s.hasPassword && !s.password && !s.oneTimeOnly && !s.maxAccessCount && (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now()));
    let linkId: string;

    if (existing) {
      linkId = existing.id;
    } else {
      linkId = 'share-' + crypto.randomUUID();
      const newLink: ShareLink = {
        id: linkId,
        itemId: item.id,
        itemType: 'parentId' in item ? 'folder' : 'file',
        name: item.name,
        label: 'Quick Share Link',
        permission: 'edit',
        allowDownload: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUserId,
        viewsCount: 0,
        downloadsCount: 0,
      };

      const log = createAuditLog('PERMISSION_CHANGE', item.name, 'parentId' in item ? 'folder' : 'file', 'Auto-generated quick share link');
      const nextLogs = [log, ...auditLogs];
      setAuditLogs(nextLogs);
      const nextShares = [...shares, newLink];
      setShares(nextShares);
      try { await persistState({ shares: nextShares, auditLogs: nextLogs }); } catch (e) { addToast({ type: 'error', title: 'Share was not saved', message: e instanceof Error ? e.message : 'Try again.' }); return; }
    }

    const url = `${window.location.origin}/share/${linkId}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast({ type: 'success', title: 'Share link copied', message: `Secure link for "${item.name}" copied to clipboard.` });
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'The link could not be copied automatically.' });
    }
  };

  // CRUD Operations
  const handleUploadFile = async (newFileData: Partial<VantorFile> & { blob?: Blob; versionOf?: string }) => {
    const replacement = newFileData.versionOf ? files.find(f => f.id === newFileData.versionOf) : undefined;
    if (newFileData.versionOf && !replacement) throw new Error('The selected file is no longer available.');
    const destFolderId = replacement ? replacement.folderId : newFileData.folderId !== undefined ? newFileData.folderId : currentFolderId;
    const destFolder = destFolderId ? folders.find(f => f.id === destFolderId) : undefined;
    const targetRepoId = replacement?.repositoryId || destFolder?.repositoryId || currentRepositoryId || DEFAULT_REPOSITORY_ID;
    const destinationRepository = repositories.find(r => r.id === targetRepoId);
    const hasWriteAccess = replacement
      ? canEditItem(effectiveRole, currentUserId, replacement, folders, destinationRepository)
      : destFolder ? canEditItem(effectiveRole, currentUserId, destFolder, folders, destinationRepository)
      : Boolean(destinationRepository && userCanEditRepository(effectiveRole, currentUserId, destinationRepository));
    if (!hasWriteAccess) throw new Error('You do not have upload permission in this location.');
    if (!newFileData.blob) throw new Error('Select a file to upload.');
    let uploaded = completedUploads.current.get(newFileData.blob);
    if (!uploaded || uploaded.repositoryId !== targetRepoId || uploaded.folderId !== (destFolderId || null)) {
      const controller = new AbortController(); uploadController.current = controller;
      setUploadProgress(0);
      try {
        const result = await uploadFile(newFileData.blob, newFileData.name || 'file', targetRepoId, destFolderId || null, controller.signal, setUploadProgress);
        uploaded = { ...result, repositoryId: targetRepoId, folderId: destFolderId || null };
        completedUploads.current.set(newFileData.blob, uploaded);
      } finally { setUploadProgress(null); uploadController.current = null; }
    }

    const fileInfo = detectFileType(newFileData.name || 'Untitled File', newFileData.mimeType);

    const newFile: VantorFile = {
      id: uploaded.fileId,
      name: newFileData.name || 'Untitled File',
      originalName: newFileData.originalName || newFileData.name || 'Untitled File',
      fileType: fileInfo.fileType,
      category: newFileData.category || fileInfo.category,
      extension: fileInfo.extension,
      mimeType: fileInfo.mimeType,
      size: uploaded.size,
      formattedSize: newFileData.formattedSize || formatBytes(newFileData.size || 1024),
      folderId: destFolderId,
      description: newFileData.description || 'Uploaded asset',
      tags: newFileData.tags || ['upload'],
      content: undefined,
      url: uploaded.url,
      repositoryId: targetRepoId,
      permissionLevel: newFileData.permissionLevel || 'authenticated',
      allowedRoles: newFileData.allowedRoles || ALL_USER_ROLES,
      allowedUserIds: [],
      uploadedBy: displayName,
      uploadedByRole: effectiveRole,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextFiles = replacement ? files.map(f => f.id === replacement.id ? {
      ...f, uploadId: uploaded.fileId, size: uploaded.size, formattedSize: formatBytes(uploaded.size),
      mimeType: fileInfo.mimeType, extension: fileInfo.extension, fileType: fileInfo.fileType,
      originalName: newFileData.originalName || newFileData.name || f.originalName, updatedAt: new Date().toISOString(),
    } : f) : [newFile, ...files];
    const nextLogs = [createAuditLog('UPLOAD', newFile.name, 'file', `Uploaded file (${newFile.formattedSize})`), ...auditLogs];
    const nextRepositories = touchRepository(targetRepoId);

    // Keep full content in React state so preview works during this session
    setFiles(nextFiles);
    setAuditLogs(nextLogs);
    setRepositories(nextRepositories);

    try {
      await persistState({ files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories });
      completedUploads.current.delete(newFileData.blob);
      addToast({ type: 'success', title: replacement ? 'File version saved' : 'File uploaded', message: replacement ? `New content saved for "${replacement.name}".` : `"${newFile.name}" added to repository.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save file to database.';
      addToast({ type: 'error', title: 'Upload Failed', message: msg });
      throw error;
    }
  };

  const handleCreateFolder = async (newFolderData: Partial<VantorFolder>) => {
    const destFolderId = newFolderData.parentId !== undefined ? newFolderData.parentId : currentFolderId;
    const destFolder = destFolderId ? folders.find((f) => f.id === destFolderId) : undefined;
    const hasWriteAccess = destFolder
      ? canEditItem(effectiveRole, currentUserId, destFolder, folders, currentRepository)
      : (currentRepository ? canEditCurrentRepository : true);

    if (!hasWriteAccess) {
      addToast({ type: 'error', title: 'Access denied', message: 'You do not have editor permissions in this location.' });
      throw new Error('You do not have permission to create a folder here.');
    }

    const targetRepoId = currentRepositoryId || DEFAULT_REPOSITORY_ID;

    const newFolder: VantorFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderData.name || 'New Folder',
      parentId: destFolderId,
      description: newFolderData.description || 'Directory folder',
      permissionLevel: newFolderData.permissionLevel || 'public',
      allowedRoles: newFolderData.allowedRoles || ALL_USER_ROLES,
      itemCount: 0,
      totalSize: 0,
      formattedSize: '0 KB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: displayName,
      repositoryId: targetRepoId,
    };

    const nextFolders = [...folders, newFolder];
    const nextLogs = [createAuditLog('FOLDER_CREATE', newFolder.name, 'folder', `Created new folder directory`), ...auditLogs];
    const nextRepositories = touchRepository(targetRepoId);

    setFolders(nextFolders);
    setAuditLogs(nextLogs);
    setRepositories(nextRepositories);

    try {
      await persistState({ folders: nextFolders, auditLogs: nextLogs, repositories: nextRepositories });
      addToast({ type: 'success', title: 'Folder created', message: `"${newFolder.name}" directory created.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save folder to database.';
      addToast({ type: 'error', title: 'Creation Failed', message: msg });
      throw error;
    }
  };

  const getUpdatedLabel = () => {
    return new Date().toISOString();
  };

  const touchRepository = (repositoryId: string) => {
    const nowIso = new Date().toISOString();
    return repositories.map((repository) =>
      repository.id === repositoryId ? { ...repository, updatedAt: nowIso } : repository
    );
  };

  const handleSelectRepository = (repositoryId: string) => {
    setCurrentRepositoryId(repositoryId);
    setCurrentFolderId(null);
    setSelectedIds([]);
    setSearchQuery('');
    const query = searchQuery.trim();
    const repository = repositories.find((item) => item.id === repositoryId);
    const suffix = query && repository && !matchesSearch(repository, query) ? `?q=${encodeURIComponent(query)}` : '';
    router.push(`/dashboard/repositories/${repositoryId}${suffix}`);
  };

  const handleUpdateCurrentChangelog = (nextChangelog: HeroChangelogData) => {
    if (!canManagePlatform) return;

    if (currentChangelogKey === 'project') {
      setChangelog(nextChangelog);
      persistState({ changelog: nextChangelog }).catch(() => {});
      return;
    }

    const nextChangelogs = {
      ...changelogs,
      [currentChangelogKey]: nextChangelog,
    };
    setChangelogs(nextChangelogs);
    persistState({ changelogs: nextChangelogs }).catch(() => {});
  };

  const handleCreateRepository = () => {
    if (!canManagePlatform) return;
    setDialog({
      type: 'createRepository',
      name: '',
      description: '',
    });
  };

  const handleSaveRepository = () => {
    if (!dialog || dialog.type !== 'createRepository') return;
    if (!canManagePlatform) return;

    const name = dialog.name.trim();
    if (!name) return;

    const newRepository: VantorRepository = {
      id: `repo-${Date.now()}`,
      name,
      description: dialog.description.trim() || 'Repository workspace',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: displayName,
      assignedUserIds: [],
      assignedRoles: ['manager', 'member'],
    };
    const nextRepositories = [...repositories, newRepository];
    setRepositories(nextRepositories);
    setCurrentRepositoryId(newRepository.id);
    setCurrentFolderId(null);
    setSelectedIds([]);
    setSearchQuery('');
    setDialog(null);
    persistState({ repositories: nextRepositories }).catch(() => {});

  };

  const handleRenameRepository = (repository: VantorRepository) => {
    if (!canManagePlatform) return;
    setDialog({
      type: 'renameRepository',
      repository,
      name: repository.name,
      description: repository.description,
    });
  };

  const handleSaveRepositoryRename = () => {
    if (!dialog || dialog.type !== 'renameRepository') return;
    if (!canManagePlatform) return;

    const name = dialog.name.trim();
    if (!name) return;

    const nextRepositories = repositories.map((repository) =>
      repository.id === dialog.repository.id
        ? { ...repository, name, description: dialog.description.trim() || repository.description, updatedAt: getUpdatedLabel() }
        : repository
    );
    const nextLogs = [createAuditLog('METADATA_UPDATE', name, 'folder', `Updated repository metadata for "${dialog.repository.name}"`), ...auditLogs];
    setRepositories(nextRepositories);
    setAuditLogs(nextLogs);
    setDialog(null);
    persistState({ repositories: nextRepositories, auditLogs: nextLogs }).catch(() => {});
  };

  const handleRequestDeleteRepository = (repository: VantorRepository) => {
    if (!canManagePlatform) return;
    if (repositories.length <= 1) {
      setDialog({
        type: 'notice',
        title: 'Action blocked',
        message: 'At least one repository must remain available.',
      });
      return;
    }
    setDialog({
      type: 'deleteRepository',
      repository,
      confirmation: '',
    });
  };

  const handleConfirmDeleteRepository = () => {
    if (!dialog || dialog.type !== 'deleteRepository') return;
    if (!canManagePlatform || dialog.confirmation !== dialog.repository.name) return;

    const nextRepositories = repositories.filter((repository) => repository.id !== dialog.repository.id);
    const nextFiles = files.filter((file) => (file.repositoryId || DEFAULT_REPOSITORY_ID) !== dialog.repository.id);
    const nextFolders = folders.filter((folder) => (folder.repositoryId || DEFAULT_REPOSITORY_ID) !== dialog.repository.id);
    const nextLogs = [createAuditLog('DELETE', dialog.repository.name, 'folder', 'Deleted repository and all contained content'), ...auditLogs];
    const nextRepositoryId = nextRepositories[0]?.id || DEFAULT_REPOSITORY_ID;

    setRepositories(nextRepositories);
    setFiles(nextFiles);
    setFolders(nextFolders);
    setAuditLogs(nextLogs);
    setCurrentRepositoryId(nextRepositoryId);
    setCurrentFolderId(null);
    setSelectedIds([]);
    const deletedRepoName = dialog.repository.name;
    setDialog(null);
    if (!showRepositoryIndex) {
      router.push('/dashboard');
    }
    persistState({
      repositories: nextRepositories,
      files: nextFiles,
      folders: nextFolders,
      auditLogs: nextLogs,
    }).catch(() => {});

  };

  const handleUpdateManagedUser = (userId: string, updates: Partial<VantorUser>) => {
    if (!canManagePlatform) return;
    const targetUser = managedUsers.find((managedUser) => managedUser.id === userId);
    if (!targetUser) return;

    if (userId === user?.id && (updates.locked || updates.role !== undefined && updates.role !== 'admin')) {
      setDialog({
        type: 'notice',
        title: 'Action blocked',
        message: 'Administrators cannot lock their own account or remove their own admin access.',
      });
      return;
    }

    const nextUsers = managedUsers.map((managedUser) =>
      managedUser.id === userId ? { ...managedUser, ...updates } : managedUser
    );
    setManagedUsers(nextUsers);
    persistState({ users: nextUsers }).catch(() => {});
  };

  const handleDeleteManagedUser = (userId: string) => {
    if (!canManagePlatform) return;
    const targetUser = managedUsers.find((managedUser) => managedUser.id === userId);
    if (!targetUser) return;

    if (userId === user?.id) {
      setDialog({
        type: 'notice',
        title: 'Action blocked',
        message: 'Administrators cannot delete their own account.',
      });
      return;
    }

    setDialog({
      type: 'confirm',
      title: 'Delete user account',
      message: `Delete "${targetUser.name}"? This removes the user from the managed account list.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
      onConfirm: () => {
        const nextUsers = managedUsers.filter((managedUser) => managedUser.id !== userId);
        setManagedUsers(nextUsers);
        persistState({ users: nextUsers }).catch(() => {});
      },
    });
  };

  const handleDeleteItem = (id: string, isFolder: boolean) => {
    if (!canDeleteContent) return;
    const item = isFolder ? folders.find((f) => f.id === id) : files.find((f) => f.id === id);
    if (!item) return;

    setDialog({
      type: 'confirm',
      title: `Delete ${isFolder ? 'folder' : 'file'}`,
      message: isFolder
        ? `Delete "${item.name}" and all files inside it?`
        : `Delete "${item.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => performDeleteItem(id, isFolder),
    });
  };

  const performDeleteItem = (id: string, isFolder: boolean) => {
    if (isFolder) {
      const folderToDelete = folders.find((f) => f.id === id);
      const nextFolders = folders.filter((f) => f.id !== id);
      const nextFiles = files.filter((f) => f.folderId !== id);
      setFolders(nextFolders);
      setFiles(nextFiles);
      if (folderToDelete) {
        const nextRepositories = touchRepository(folderToDelete.repositoryId || DEFAULT_REPOSITORY_ID);
        const nextLogs = [createAuditLog('DELETE', folderToDelete.name, 'folder', `Deleted folder and subcontents`), ...auditLogs];
        setAuditLogs(nextLogs);
        setRepositories(nextRepositories);
        persistState({ folders: nextFolders, files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
      }
    } else {
      const fileToDelete = files.find((f) => f.id === id);
      const nextFiles = files.filter((f) => f.id !== id);
      setFiles(nextFiles);
      if (fileToDelete) {
        const nextRepositories = touchRepository(fileToDelete.repositoryId || DEFAULT_REPOSITORY_ID);
        const nextLogs = [createAuditLog('DELETE', fileToDelete.name, 'file', `Deleted file`), ...auditLogs];
        setAuditLogs(nextLogs);
        setRepositories(nextRepositories);
        persistState({ files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
      }
    }
  };

  const handleRenameItem = (item: VantorFile | VantorFolder, isFolder: boolean) => {
    const repositoryId = 'repositoryId' in item ? item.repositoryId || DEFAULT_REPOSITORY_ID : DEFAULT_REPOSITORY_ID;
    const repository = repositories.find((candidate) => candidate.id === repositoryId) || currentRepository;

    const hasEditAccess = canEditItem(effectiveRole, currentUserId, item, folders, repository);
    if (!hasEditAccess) {
      addToast({ type: 'error', title: 'Access denied', message: 'You do not have editor permissions for this item.' });
      return;
    }

    setDialog({
      type: 'rename',
      item,
      isFolder,
      value: item.name,
    });
  };

  const handleSaveRename = () => {
    if (!dialog || dialog.type !== 'rename') return;

    const nextName = dialog.value.trim();
    if (!nextName || nextName === dialog.item.name) {
      setDialog(null);
      return;
    }

    if (dialog.isFolder) {
      const nextFolders = folders.map((folder) =>
        folder.id === dialog.item.id ? { ...folder, name: nextName } : folder
      );
      const nextRepositories = touchRepository((dialog.item as VantorFolder).repositoryId || DEFAULT_REPOSITORY_ID);
      const nextLogs = [createAuditLog('RENAME', nextName, 'folder', `Renamed folder from "${dialog.item.name}" to "${nextName}"`), ...auditLogs];
      setFolders(nextFolders);
      setAuditLogs(nextLogs);
      setRepositories(nextRepositories);
      persistState({ folders: nextFolders, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
    } else {
      const nextFiles = files.map((file) =>
        file.id === dialog.item.id ? { ...file, name: nextName } : file
      );
      const nextRepositories = touchRepository((dialog.item as VantorFile).repositoryId || DEFAULT_REPOSITORY_ID);
      const nextLogs = [createAuditLog('RENAME', nextName, 'file', `Renamed file from "${dialog.item.name}" to "${nextName}"`), ...auditLogs];
      setFiles(nextFiles);
      setAuditLogs(nextLogs);
      setRepositories(nextRepositories);
      persistState({ files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
    }

    setDialog(null);

  };

  const getFolderPathString = (folder: VantorFolder, allFolders: VantorFolder[]): string => {
    const path: string[] = [folder.name];
    let current = folder;
    while (current.parentId) {
      const parent = allFolders.find((f) => f.id === current.parentId);
      if (!parent) break;
      path.unshift(parent.name);
      current = parent;
    }
    return '/' + path.join('/');
  };

  const getMoveDestinations = (item: VantorFile | VantorFolder, isFolder: boolean, targetRepoId?: string) => {
    const repoId = targetRepoId || item.repositoryId || DEFAULT_REPOSITORY_ID;
    const repoFolders = folders.filter((f) => (f.repositoryId || DEFAULT_REPOSITORY_ID) === repoId);

    if (!isFolder) {
      return repoFolders;
    }

    const itemRepoId = item.repositoryId || DEFAULT_REPOSITORY_ID;
    if (itemRepoId !== repoId) {
      return repoFolders;
    }

    // Exclude folder itself and all descendant folders
    const descendants = new Set<string>();
    const findDescendants = (folderId: string) => {
      repoFolders.forEach((f) => {
        if (f.parentId === folderId) {
          descendants.add(f.id);
          findDescendants(f.id);
        }
      });
    };
    findDescendants(item.id);

    return repoFolders.filter((f) => f.id !== item.id && !descendants.has(f.id));
  };

  const handleMoveItem = (item: VantorFile | VantorFolder, isFolder: boolean) => {
    const repositoryId = 'repositoryId' in item ? item.repositoryId || DEFAULT_REPOSITORY_ID : DEFAULT_REPOSITORY_ID;
    const repository = repositories.find((candidate) => candidate.id === repositoryId) || currentRepository;

    const hasEditAccess = canEditItem(effectiveRole, currentUserId, item, folders, repository);
    if (!hasEditAccess) {
      addToast({ type: 'error', title: 'Access denied', message: 'You do not have editor permissions for this item.' });
      return;
    }

    const currentParentId = isFolder
      ? (item as VantorFolder).parentId
      : (item as VantorFile).folderId;

    setDialog({
      type: 'move',
      item,
      isFolder,
      destinationRepositoryId: repositoryId,
      destinationFolderId: currentParentId || 'root',
    });
  };

  const handleSaveMove = () => {
    if (!dialog || dialog.type !== 'move') return;

    const destId = dialog.destinationFolderId === 'root' ? null : dialog.destinationFolderId;
    const targetRepoId = dialog.destinationRepositoryId;
    const targetRepo = repositories.find((r) => r.id === targetRepoId) || currentRepository;

    const destFolder = destId ? folders.find((f) => f.id === destId) : null;

    const hasDestWriteAccess = destFolder
      ? canEditItem(effectiveRole, currentUserId, destFolder, folders, targetRepo)
      : (targetRepo ? canEditRepository(targetRepo) : false);

    if (!hasDestWriteAccess) {
      addToast({ type: 'error', title: 'Access denied', message: 'You do not have editor permissions in the destination location.' });
      return;
    }

    const isFolder = dialog.isFolder;
    const item = dialog.item;
    const destName = destFolder ? destFolder.name : 'Root';
    const oldRepoId = 'repositoryId' in item ? item.repositoryId || DEFAULT_REPOSITORY_ID : DEFAULT_REPOSITORY_ID;

    if (isFolder) {
      const descendantFolderIds = new Set<string>();
      const findDescendants = (fId: string) => {
        folders.forEach((f) => {
          if (f.parentId === fId) {
            descendantFolderIds.add(f.id);
            findDescendants(f.id);
          }
        });
      };
      findDescendants(item.id);

      const nextFolders = folders.map((f) => {
        if (f.id === item.id) return { ...f, parentId: destId, repositoryId: targetRepoId };
        if (descendantFolderIds.has(f.id)) return { ...f, repositoryId: targetRepoId };
        return f;
      });

      const nextFiles = files.map((f) => {
        if (f.folderId && (f.folderId === item.id || descendantFolderIds.has(f.folderId))) {
          return { ...f, repositoryId: targetRepoId };
        }
        return f;
      });

      let nextRepositories = touchRepository(oldRepoId);
      if (oldRepoId !== targetRepoId) {
        nextRepositories = nextRepositories.map((r) =>
          r.id === targetRepoId ? { ...r, updatedAt: getUpdatedLabel() } : r
        );
      }

      const logMsg = oldRepoId !== targetRepoId
        ? `Moved folder to repository "${targetRepo?.name || 'Target'}" (${destName})`
        : `Moved folder to "${destName}"`;
      const nextLogs = [createAuditLog('METADATA_UPDATE', item.name, 'folder', logMsg), ...auditLogs];

      setFolders(nextFolders);
      setFiles(nextFiles);
      setAuditLogs(nextLogs);
      setRepositories(nextRepositories);
      persistState({ folders: nextFolders, files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
    } else {
      const nextFiles = files.map((f) =>
        f.id === item.id ? { ...f, folderId: destId, repositoryId: targetRepoId } : f
      );

      let nextRepositories = touchRepository(oldRepoId);
      if (oldRepoId !== targetRepoId) {
        nextRepositories = nextRepositories.map((r) =>
          r.id === targetRepoId ? { ...r, updatedAt: getUpdatedLabel() } : r
        );
      }

      const logMsg = oldRepoId !== targetRepoId
        ? `Moved file to repository "${targetRepo?.name || 'Target'}" (${destName})`
        : `Moved file to "${destName}"`;
      const nextLogs = [createAuditLog('METADATA_UPDATE', item.name, 'file', logMsg), ...auditLogs];

      setFiles(nextFiles);
      setAuditLogs(nextLogs);
      setRepositories(nextRepositories);
      persistState({ files: nextFiles, auditLogs: nextLogs, repositories: nextRepositories }).catch(() => {});
    }

    setDialog(null);

  };

  const handleSavePermissions = async (
    id: string,
    permissionLevel: PermissionLevel,
    allowedRoles: UserRole[],
    isFolder: boolean,
    collaborators: Collaborator[],
    propagateToChildren: boolean
  ) => {
    const targetObj = isFolder ? folders.find((f) => f.id === id) : files.find((f) => f.id === id);
    if (!targetObj) return;

    if (!canManagePlatform) throw new Error('Only administrators can change access policies.');

    let nextFolders = [...folders];
    let nextFiles = [...files];

    if (isFolder && propagateToChildren) {
      const descendants = new Set<string>();
      const findDescendants = (folderId: string) => {
        folders.forEach((f) => {
          if (f.parentId === folderId) {
            descendants.add(f.id);
            findDescendants(f.id);
          }
        });
      };
      findDescendants(id);

      nextFolders = nextFolders.map((f) =>
        f.id === id || descendants.has(f.id)
          ? { ...f, permissionLevel, allowedRoles, collaborators }
          : f
      );
      nextFiles = nextFiles.map((f) =>
        f.folderId === id || (f.folderId && descendants.has(f.folderId))
          ? { ...f, permissionLevel, allowedRoles, collaborators }
          : f
      );
    } else if (isFolder) {
      nextFolders = nextFolders.map((f) =>
        f.id === id ? { ...f, permissionLevel, allowedRoles, collaborators } : f
      );
    } else {
      nextFiles = nextFiles.map((f) =>
        f.id === id ? { ...f, permissionLevel, allowedRoles, collaborators } : f
      );
    }

    setFolders(nextFolders);
    setFiles(nextFiles);

    const logDetails = `Updated access level to ${permissionLevel.toUpperCase()} and collaborators list`;
    const log = createAuditLog('PERMISSION_CHANGE', targetObj.name, isFolder ? 'folder' : 'file', logDetails);
    const nextLogs = [log, ...auditLogs];
    setAuditLogs(nextLogs);

    await persistState({ folders: nextFolders, files: nextFiles, auditLogs: nextLogs });
  };

  const handleSaveShares = async (nextShares: ShareLink[]) => {
    setShares(nextShares);
    await persistState({ shares: nextShares });
  };

  const addAuditLog = (
    action: AuditLog['action'],
    targetName: string,
    targetType: 'file' | 'folder',
    details: string,
    repositoryId?: string
  ) => {
    const nextLogs = [createAuditLog(action, targetName, targetType, details, repositoryId), ...auditLogs];
    setAuditLogs(nextLogs);
    persistState({ auditLogs: nextLogs }).catch(() => {});
  };

  const createAuditLog = (
    action: AuditLog['action'],
    targetName: string,
    targetType: 'file' | 'folder',
    details: string,
    repositoryId?: string
  ) => {
    const newLog: AuditLog = {
      id: 'log-' + crypto.randomUUID(),
      action,
      targetName,
      targetType,
      performedBy: displayName,
      role: effectiveRole,
      timestamp: new Date().toISOString(),
      details,
      repositoryId: repositoryId || currentRepositoryId || DEFAULT_REPOSITORY_ID,
    };
    return newLog;
  };


  if (!isMounted || !isLoaded) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-slate-400 font-mono font-medium">Loading Vantor Storage...</span>
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-md rounded-xl border border-[#1e3059] bg-[#070c18] p-6 text-center shadow-2xl">
          <h1 className="text-xl font-bold text-white">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-300">Access to Vantor files and folders requires an authenticated Clerk session.</p>
          <SignInButton mode="modal">
            <button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300 ${isDark ? 'bg-[#060a17] text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top Navbar Component */}
      <Navbar
        showRepositoryIndex={showRepositoryIndex}
        searchQuery={searchQuery}
        setSearchQuery={(query) => { setSearchQuery(query); setSelectedIds([]); }}
        typeFilter={typeFilter}
        setTypeFilter={(value) => { setTypeFilter(value); setSelectedIds([]); }}
        modifiedFilter={modifiedFilter}
        setModifiedFilter={(value) => { setModifiedFilter(value); setSelectedIds([]); }}
        viewMode={showRepositoryIndex ? dashboardViewMode : repositoryViewMode}
        setViewMode={(mode) => {
          if (showRepositoryIndex) {
            setDashboardViewMode(mode);
          } else {
            setRepositoryViewMode(mode);
          }
        }}
        selectedCount={selectedIds.length}
        onBatchDownload={handleBatchDownload}
        onBatchDelete={handleBatchDelete}
        onOpenUploadModal={() => { setAdminTabDefault('upload'); setIsAdminDashboardOpen(true); }}
        onOpenCreateFolderModal={() => { setAdminTabDefault('folder'); setIsAdminDashboardOpen(true); }}
        onOpenAdminPanel={() => { setAdminTabDefault('upload'); setIsAdminDashboardOpen(true); }}
        currentRole={effectiveRole}
        setCurrentRole={setCurrentRole}
        canEditRepository={canEditCurrentRepository}
        canDeleteContent={canDeleteContent}
        canManagePlatform={canManagePlatform}
        canUseRoleSwitcher={canUseRoleSwitcher}
        onOpenHelp={() => setIsHelpOpen(true)}
        onReloadContent={() => window.location.reload()}
      />

      {/* Main Content Body */}
      {saveStatus === 'saving' && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[90] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 shadow-lg">
          Saving changes…
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {saveError && <div role="alert" className="text-sm text-red-300">{saveError} <button className="storage-button" onClick={() => reload().catch(e => setLoadError(e.message))}>Reload latest changes</button></div>}
        {loadError && (
          <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            <p>{loadError}</p>
            <button className="storage-button mt-3" onClick={() => window.location.reload()}>Retry loading</button>
          </div>
        )}
        {showRepositoryIndex && searchQuery.trim() && !isLoading && !loadError && (
          <SearchResults key={searchQuery.trim().toLowerCase()} results={searchResults} onOpen={handleOpenSearchResult} onClear={() => setSearchQuery('')} />
        )}
        {/* Sitewide Announcement Banner */}
        <AnnouncementBanner
          announcements={announcements}
          isAdmin={canManagePlatform}
          onOpenAdminDashboard={(tab) => {
            setAdminTabDefault(tab);
            setIsAdminDashboardOpen(true);
          }}
        />

        {/* Dynamic Welcome Greeting (Clean typography without container box) */}
        {showRepositoryIndex && (!searchQuery.trim() || isLoading) && !loadError && (
          <div className="pt-2 pb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">{greetingMessage}</h1>
          </div>
        )}

        {showRepositoryIndex && (!searchQuery.trim() || isLoading) && !loadError && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-white">Repositories</h1>
                <p className="text-xs text-slate-400">Browse repository workspaces and create new storage areas.</p>
              </div>
              {canManagePlatform && (
                <button
                  onClick={handleCreateRepository}
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  New Repository
                </button>
              )}
            </div>
            {isLoading ? (
              <div role="status" aria-label="Loading repositories" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="h-32 rounded-lg border border-slate-800 bg-slate-900/40 animate-pulse" />
                <div className="h-32 rounded-lg border border-slate-800 bg-slate-900/40 animate-pulse" />
                <div className="h-32 rounded-lg border border-slate-800 bg-slate-900/40 animate-pulse" />
              </div>
            ) : visibleRepositories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
                <p className="text-sm font-semibold text-slate-300">No repositories available</p>
                <p className="mt-1 text-xs text-slate-500">{canManagePlatform ? 'Create your first repository workspace to get started.' : 'Ask a repository manager to grant you access.'}</p>
                {canManagePlatform && (
                  <button
                    onClick={handleCreateRepository}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Create Repository
                  </button>
                )}
              </div>
            ) : dashboardViewMode === 'list' ? (
              <div className="overflow-x-auto rounded-lg border border-[#1e3059] bg-[#070c18]">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e3059] bg-[#090f21] text-slate-400 select-none">
                      <th className="px-4 py-2.5 font-semibold text-slate-300">Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-300">Description</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-300">Folders</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-300">Files</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-300">Last Activity</th>
                      {canManagePlatform && <th className="px-4 py-2.5 font-semibold text-slate-300 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3059]/40 text-slate-200">
                    {displayedRepositories.map((repository) => {
                      const repositoryFilesForCard = files.filter((file) => (file.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
                      const repositoryFoldersForCard = folders.filter((folder) => (folder.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
                      const repositoryFileCount = repositoryFilesForCard.length;
                      const repositoryFolderCount = repositoryFoldersForCard.length;
                      const repositoryItemNames = new Set([
                        ...repositoryFilesForCard.map((file) => file.name),
                        ...repositoryFoldersForCard.map((folder) => folder.name),
                      ]);
                      const recentRepositoryLogs = auditLogs.filter((log) => repositoryItemNames.has(log.targetName)).slice(0, 2);
                      const latestChange = recentRepositoryLogs[0]?.details || 'No recent changes';
                      const isActive = (repository as any).status !== 'inactive' && (repository as any).status !== 'archived' && (repository as any).isActive !== false;

                      return (
                        <tr
                          key={repository.id}
                          onClick={() => handleSelectRepository(repository.id)}
                          className="hover:bg-slate-800/20 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-semibold text-white flex items-center space-x-2">
                            <button className="truncate text-left hover:text-blue-400" onClick={(event) => { event.stopPropagation(); handleSelectRepository(repository.id); }}>{repository.name}</button>
                            {isActive && (
                              <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-white">Active</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{repository.description}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{repositoryFolderCount}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{repositoryFileCount}</td>
                          <td className="px-4 py-3 text-slate-300 max-w-[250px] truncate" title={latestChange}>{latestChange}</td>
                          {canManagePlatform && (
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleRenameRepository(repository)}
                                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleRequestDeleteRepository(repository)}
                                  className="rounded border border-red-800 bg-red-950/70 px-2.5 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-900"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {displayedRepositories.map((repository) => {
                  const repositoryFilesForCard = files.filter((file) => (file.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
                  const repositoryFoldersForCard = folders.filter((folder) => (folder.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
                  const repositoryFileCount = repositoryFilesForCard.length;
                  const repositoryFolderCount = repositoryFoldersForCard.length;
                  const repositoryItemNames = new Set([
                    ...repositoryFilesForCard.map((file) => file.name),
                    ...repositoryFoldersForCard.map((folder) => folder.name),
                  ]);
                  const recentRepositoryLogs = auditLogs.filter((log) => repositoryItemNames.has(log.targetName)).slice(0, 2);
                  const latestChange = recentRepositoryLogs[0]?.details || 'No recent changes';
                  const isActive = (repository as any).status !== 'inactive' && (repository as any).status !== 'archived' && (repository as any).isActive !== false;

                  return (
                    <div
                      key={repository.id}
                      onClick={() => handleSelectRepository(repository.id)}
                      className="rounded-lg border border-[#1e3059] bg-[#070c18] hover:border-blue-700/80 p-4 text-left transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-bold text-white"><button className="max-w-full truncate text-left hover:text-blue-400" onClick={(event) => { event.stopPropagation(); handleSelectRepository(repository.id); }}>{repository.name}</button></h2>
                          <p className="mt-1 text-xs text-slate-400">{repository.description}</p>
                        </div>
                        {isActive && (
                          <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">Active</span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                        <span>{repositoryFolderCount} folders</span>
                        <span>{repositoryFileCount} files</span>
                        <span>Updated {formatRelativeTime(getRepositoryLastUpdated(repository, files, folders, auditLogs), repository.createdAt)}</span>
                      </div>
                      <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
                        <span className="font-semibold text-slate-200">Activity:</span> {latestChange}
                      </div>
                      {canManagePlatform && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRenameRepository(repository);
                            }}
                            className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRequestDeleteRepository(repository);
                            }}
                            className="rounded border border-red-800 bg-red-950/70 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!showRepositoryIndex && (
          isLoading ? (
            <section role="status" aria-label="Loading repository" className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 animate-pulse">
              <div className="h-4 w-32 bg-slate-700 rounded mb-3"></div>
              <div className="h-8 w-64 bg-slate-700 rounded mb-3"></div>
              <div className="h-4 w-96 bg-slate-700 rounded"></div>
            </section>
          ) : currentRepository ? (
            canViewCurrentRepository ? (
              <section className="rounded-lg border border-[#1e3059] bg-[#070c18] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-blue-300">Repository</p>
                    <h1 className="mt-1 truncate text-xl font-bold text-white">{currentRepository.name}</h1>
                    <p className="mt-1 text-xs text-slate-400">{currentRepository.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span>Created by {currentRepository.createdBy}</span>
                      <span>Updated {formatRelativeTime(getRepositoryLastUpdated(currentRepository, files, folders, auditLogs), currentRepository.createdAt)}</span>
                    </div>
                  </div>
                  {canManagePlatform && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRenameRepository(currentRepository)}
                        className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        Settings
                      </button>
                      <button
                        onClick={() => handleRequestDeleteRepository(currentRepository)}
                        className="rounded border border-red-800 bg-red-950/70 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-red-900/60 bg-[#0c0914] p-8 text-center shadow-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-950/80 border border-red-800 text-red-400 mb-4">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-white">Access Denied</h2>
                <p className="mt-2 text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  You do not have permission to access this repository. Contact an administrator or repository manager to request access.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-md"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-400">
              Repository not found.
            </div>
          )
        )}

        {!showRepositoryIndex && currentRepository && canViewCurrentRepository && (
          <Breadcrumbs
            items={currentFolderPath}
            onNavigateFolder={handleOpenFolder}
            isDark={isDark}
          />
        )}

        {!showRepositoryIndex && currentRepository && canViewCurrentRepository && (
          <div className="space-y-3">
            {searchQuery.trim() && (
              <p role="status" className="text-xs text-slate-400">
                {displayedFiles.length + displayedFolders.length} results in this repository for “{searchQuery.trim()}”
              </p>
            )}
            <FileBrowser
              loading={isLoading}
              emptyMessage={loadError ? 'Unable to load files. Use Retry loading above.' : searchQuery.trim() || typeFilter !== 'ALL' || modifiedFilter !== 'ALL' ? 'No files or folders match your search and filters.' : 'This folder is empty.'}
              onClearFilters={searchQuery.trim() || typeFilter !== 'ALL' || modifiedFilter !== 'ALL' ? () => { setSearchQuery(''); setTypeFilter('ALL'); setModifiedFilter('ALL'); } : undefined}
              folders={displayedFolders}
              files={displayedFiles}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onOpenFolder={handleOpenFolder}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadFile={handleDownloadFile}
              onCopyLink={handleCopyLink}
              onEditItem={handleRenameItem}
              onManagePermissions={(item, isFolder) => setPermissionTarget({ item, isFolder })}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              viewMode={repositoryViewMode}
              currentRole={effectiveRole}
              canEdit={(item) => canEditItem(effectiveRole, currentUserId, item, folders, currentRepository)}
              canDelete={canDeleteContent}
              canManagePermissions={(item) => canEditItem(effectiveRole, currentUserId, item, folders, currentRepository) || canManagePlatform}
            />
          </div>
        )}
      </main>

      {/* Footer Summary Bar */}
      <FooterSummary
        fileCount={showRepositoryIndex ? files.length : (canViewCurrentRepository ? displayedFiles.length : 0)}
        folderCount={showRepositoryIndex ? folders.length : (canViewCurrentRepository ? displayedFolders.length : 0)}
        totalFormattedSize={showRepositoryIndex || canViewCurrentRepository ? currentTotalSizeFormatted : '0 B'}
      />

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
        role={effectiveRole}
        userId={currentUserId}
        userName={displayName}
        allFolders={folders}
        repository={repositories.find((repo) => repo.id === (previewFile?.repositoryId || DEFAULT_REPOSITORY_ID))}
        comments={comments}
        users={managedUsers}
        onAddComment={handleAddComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
      />

      {/* Admin / Manager Dashboard Drawer / Modal */}
      <AdminDashboard
        isOpen={isAdminDashboardOpen && (canManagePlatform || effectiveRole === 'manager')}
        role={effectiveRole}
        onClose={() => setIsAdminDashboardOpen(false)}
        folders={folders}
        files={files}
        auditLogs={auditLogs}
        users={managedUsers}
        announcements={announcements}
        repositories={repositories}
        currentRepositoryId={currentRepositoryId}
        showRepositoryIndex={showRepositoryIndex}
        currentUserId={user?.id || ''}
        onUploadFile={handleUploadFile}
        uploadProgress={uploadProgress}
        onCancelUpload={() => uploadController.current?.abort()}
        onCreateFolder={handleCreateFolder}
        onUpdateFileMetadata={(id, updates) => {
          if (!canManagePlatform) return;
          const nextFiles = files.map(f => f.id === id ? { ...f, ...updates } : f);
          setFiles(nextFiles);
          persistState({ files: nextFiles }).catch(() => {});
        }}
        onDeleteFile={(id) => handleDeleteItem(id, false)}
        onDeleteFolder={(id) => handleDeleteItem(id, true)}
        onUpdateUser={handleUpdateManagedUser}
        onDeleteUser={handleDeleteManagedUser}
        onCreateAnnouncement={handleCreateAnnouncement}
        onUpdateAnnouncement={handleUpdateAnnouncement}
        onDeleteAnnouncement={handleDeleteAnnouncement}
        onClearAuditLogs={() => {
          if (!canManagePlatform) return;
          setAuditLogs([]);
          persistState({ auditLogs: [] }).catch(() => {});
        }}
        activeTabDefault={adminTabDefault}
        recoveryPanel={canManagePlatform ? (
          <RecoveryPanel trash={recovery.trash} versions={recovery.versions} onRestored={reload} disabled={saveStatus === 'saving'} />
        ) : undefined}
      />

      {dialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Repository action" tabIndex={-1} className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-[#1e3059] bg-[#070c18] shadow-2xl relative">
            <div className="border-b border-[#1e3059] bg-[#090f22] px-5 py-4 rounded-t-xl">
              <h2 className="text-base font-bold text-white">
                {dialog.type === 'rename'
                  ? `Rename ${dialog.isFolder ? 'folder' : 'file'}`
                  : dialog.type === 'createRepository'
                    ? 'Create repository'
                    : dialog.type === 'renameRepository'
                      ? 'Rename repository'
                      : dialog.type === 'deleteRepository'
                        ? 'Delete repository'
                        : dialog.type === 'move'
                          ? `Move ${dialog.isFolder ? 'folder' : 'file'}`
                          : dialog.title}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {dialog.type === 'rename'
                  ? `Update the display name for "${dialog.item.name}".`
                  : dialog.type === 'createRepository'
                    ? 'Add a new repository workspace for files and folders.'
                    : dialog.type === 'renameRepository'
                      ? 'Update the repository name and description wherever they appear.'
                      : dialog.type === 'deleteRepository'
                        ? `Type "${dialog.repository.name}" to permanently delete this repository and its contents.`
                        : dialog.type === 'move'
                          ? `Select the destination folder within the repository for "${dialog.item.name}".`
                          : dialog.message}
              </p>
            </div>

            {['rename', 'createRepository', 'renameRepository', 'deleteRepository', 'move'].includes(dialog.type) && (
              <div className="space-y-4 px-5 py-4">
                {dialog.type === 'rename' && (
                  <label className="block text-xs font-semibold text-slate-300">
                    Name
                    <input
                      autoFocus
                      value={dialog.value}
                      onChange={(event) => setDialog({ ...dialog, value: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSaveRename();
                        if (event.key === 'Escape') setDialog(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </label>
                )}

                {dialog.type === 'createRepository' && (
                  <>
                    <label className="block text-xs font-semibold text-slate-300">
                      Repository name
                      <input
                        autoFocus
                        value={dialog.name}
                        onChange={(event) => setDialog({ ...dialog, name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleSaveRepository();
                          if (event.key === 'Escape') setDialog(null);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-300">
                      Description
                      <textarea
                        rows={3}
                        value={dialog.description}
                        onChange={(event) => setDialog({ ...dialog, description: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </label>
                  </>
                )}

                {dialog.type === 'renameRepository' && (
                  <>
                    <label className="block text-xs font-semibold text-slate-300">
                      Repository name
                      <input
                        autoFocus
                        value={dialog.name}
                        onChange={(event) => setDialog({ ...dialog, name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleSaveRepositoryRename();
                          if (event.key === 'Escape') setDialog(null);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-300">
                      Description
                      <textarea
                        rows={3}
                        value={dialog.description}
                        onChange={(event) => setDialog({ ...dialog, description: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </label>
                  </>
                )}

                {dialog.type === 'deleteRepository' && (
                  <label className="block text-xs font-semibold text-slate-300">
                    Confirm repository name
                    <input
                      autoFocus
                      value={dialog.confirmation}
                      onChange={(event) => setDialog({ ...dialog, confirmation: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleConfirmDeleteRepository();
                        if (event.key === 'Escape') setDialog(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-red-900 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                    />
                  </label>
                )}

                {dialog.type === 'move' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">Target Repository</label>
                      <CustomSelect
                        value={dialog.destinationRepositoryId}
                        onChange={(val: string) => setDialog({
                          ...dialog,
                          destinationRepositoryId: val,
                          destinationFolderId: 'root'
                        })}
                        options={visibleRepositories.map((repo) => ({
                          value: repo.id,
                          label: repo.name,
                          icon: <Folder className="h-3.5 w-3.5 text-blue-400" />
                        }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">Destination Folder</label>
                      <CustomSelect
                        value={dialog.destinationFolderId}
                        onChange={(val: string) => setDialog({ ...dialog, destinationFolderId: val })}
                        options={[
                          { value: 'root', label: '/ (Repository Root)', icon: <Folder className="h-3.5 w-3.5 text-blue-400" /> },
                          ...getMoveDestinations(dialog.item, dialog.isFolder, dialog.destinationRepositoryId).map((folder) => ({
                            value: folder.id,
                            label: getFolderPathString(folder, folders),
                            icon: <Folder className="h-3.5 w-3.5 text-amber-400" />
                          }))
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-[#060a17] px-5 py-3 rounded-b-xl">
              {dialog.type !== 'notice' && (
                <button
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
              <button
                disabled={dialog.type === 'deleteRepository' && dialog.confirmation !== dialog.repository.name}
                onClick={() => {
                  if (dialog.type === 'confirm') {
                    dialog.onConfirm();
                    setDialog(null);
                  } else if (dialog.type === 'rename') {
                    handleSaveRename();
                  } else if (dialog.type === 'createRepository') {
                    handleSaveRepository();
                  } else if (dialog.type === 'renameRepository') {
                    handleSaveRepositoryRename();
                  } else if (dialog.type === 'deleteRepository') {
                    handleConfirmDeleteRepository();
                  } else if (dialog.type === 'move') {
                    handleSaveMove();
                  } else {
                    setDialog(null);
                  }
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white ${(dialog.type === 'confirm' && dialog.tone === 'danger') || dialog.type === 'deleteRepository'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-blue-600 hover:bg-blue-500'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {dialog.type === 'confirm'
                  ? dialog.confirmLabel
                  : dialog.type === 'rename'
                    ? 'Save'
                    : dialog.type === 'createRepository'
                      ? 'Create'
                      : dialog.type === 'renameRepository'
                        ? 'Save'
                        : dialog.type === 'deleteRepository'
                          ? 'Delete repository'
                          : dialog.type === 'move'
                            ? 'Move'
                            : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Access Control Modal */}
      {permissionTarget && (
        <AccessControlModal
          item={permissionTarget.item}
          isFolder={permissionTarget.isFolder}
          onClose={() => setPermissionTarget(null)}
          onSavePermissions={handleSavePermissions}
          canManagePolicy={canManagePlatform}
          users={managedUsers}
          currentUserId={user?.id || ''}
          shares={shares}
          onSaveShares={handleSaveShares}
        />
      )}

      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Dialog Content */}
            <motion.div
              ref={helpRef} role="dialog" aria-modal="true" aria-label="Help" tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-blue-900/60 bg-[#090f22] p-6 shadow-2xl"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsHelpOpen(false)}
                className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close help dialog"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Vantor Storage System</h2>
                    <p className="text-xs text-slate-400 font-sans">Secure digital asset repository</p>
                  </div>
                </div>

                {/* Info Content */}
                <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans font-medium">
                  <p>
                    Vantor Storage is a centralized, secure storage and asset management platform designed for viewing, sharing, organizing, and storing files, folders, and all Vantor assets in one place.
                  </p>
                  <p>
                    Users must comply with all applicable federal and state laws, as well as Vantor policies, while using this system. All activity is subject to monitoring for security, compliance, and access control purposes. Unauthorized access, misuse, or attempted data exfiltration is strictly prohibited and will result in disciplinary action and/or legal consequences.
                  </p>
                </div>

                {/* Technical Contact Section */}
                {canManagePlatform && (
                  <div className="rounded-lg border border-blue-950 bg-blue-950/40 p-4 space-y-2 font-sans">
                    <h3 className="text-xs font-bold text-blue-300 flex items-center space-x-1.5 uppercase tracking-wide">
                      <Mail className="h-3.5 w-3.5" />
                      <span>Technical Support & Administration</span>
                    </h3>
                    <div className="text-xs text-slate-300">
                      <div className="font-semibold text-white">Department of Information Technology</div>
                      <a
                        href="mailto:it@vantor.group"
                        className="text-blue-400 hover:text-blue-300 hover:underline transition-colors mt-0.5 inline-block font-mono"
                      >
                        it@vantor.group
                      </a>
                    </div>
                  </div>
                )}

                {/* Footer Action */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setIsHelpOpen(false)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardClient(props: DashboardClientProps) {
  return (
    <ToastProvider>
      <DashboardClientInner {...props} />
    </ToastProvider>
  );
}
