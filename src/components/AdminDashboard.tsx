'use client';

import React, { useState } from 'react';
import {
  X,
  Upload,
  FolderPlus,
  ShieldCheck,
  Activity,
  FileText,
  Folder,
  Sliders,
  Trash2,
  Clock,
  HardDrive,
  Users,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import { VantorFile, VantorFolder, AuditLog, PermissionLevel, UserRole, VantorUser } from '../lib/types';
import { ALL_USER_ROLES } from '../lib/authorization';
import { useToast } from './ToastProvider';
import { formatFriendlyDate } from '../lib/dateUtils';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  folders: VantorFolder[];
  files: VantorFile[];
  auditLogs: AuditLog[];
  users: VantorUser[];
  currentUserId: string;
  onUploadFile: (newFile: Partial<VantorFile>) => void;
  onCreateFolder: (newFolder: Partial<VantorFolder>) => void;
  onUpdateFileMetadata: (fileId: string, updates: Partial<VantorFile>) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateUser: (userId: string, updates: Partial<VantorUser>) => void;
  onDeleteUser: (userId: string) => void;
  onClearAuditLogs?: () => void;
  activeTabDefault?: 'upload' | 'folder' | 'files' | 'logs' | 'users';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  folders,
  files,
  auditLogs,
  users,
  currentUserId,
  onUploadFile,
  onCreateFolder,
  onUpdateFileMetadata,
  onDeleteFile,
  onDeleteFolder,
  onUpdateUser,
  onDeleteUser,
  onClearAuditLogs,
  activeTabDefault = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'folder' | 'files' | 'logs' | 'users'>(activeTabDefault);
  const { addToast } = useToast();

  // Form states for New File Upload
  const [fileName, setFileName] = useState('');
  const [fileCategory, setFileCategory] = useState('Documents & Assets');
  const [fileDescription, setFileDescription] = useState('');
  const [fileTags, setFileTags] = useState('release, stable');
  const [targetFolderId, setTargetFolderId] = useState<string>('root');
  const [filePermission, setFilePermission] = useState<PermissionLevel>('public');
  const [rawContent, setRawContent] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileMime, setFileMime] = useState('application/octet-stream');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Form states for New Folder Creation
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderPermission, setFolderPermission] = useState<PermissionLevel>('public');


  if (!isOpen) return null;

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    if (!rawContent) {
      addToast({ type: 'error', title: 'No file selected', message: 'Please select a file to upload.' });
      return;
    }

    const ext = fileName.includes('.') ? fileName.split('.').pop() || 'txt' : 'txt';
    const isMd = ext === 'md';

    onUploadFile({
      name: fileName.trim(),
      originalName: fileName.trim(),
      fileType: isMd ? 'Markdown document' : `${ext.toUpperCase()} File`,
      category: fileCategory,
      extension: ext,
      mimeType: fileMime,
      size: fileSize,
      formattedSize: fileSize > 1024 * 1024 ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : `${(fileSize / 1024).toFixed(1)} KB`,
      folderId: targetFolderId === 'root' ? null : targetFolderId,
      description: fileDescription || 'Vantor cloud secure asset file.',
      tags: fileTags.split(',').map((t) => t.trim()).filter(Boolean),
      content: rawContent,
      permissionLevel: filePermission,
      allowedRoles: ALL_USER_ROLES,
      allowedUserIds: [],
      uploadedBy: 'Admin (System Operator)',
      uploadedByRole: 'admin',
    });

    setSuccessMsg(`Successfully uploaded file "${fileName}"!`);
    setFileName('');
    setFileDescription('');
    setRawContent('');
    setFileSize(0);
    setFileMime('application/octet-stream');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setRawContent('');
      setFileSize(0);
      setFileMime('application/octet-stream');
      return;
    }

    // Enforce 2MB size limit to prevent breaking state payload limits
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum file size allowed is 2MB.' });
      e.target.value = '';
      return;
    }

    setIsProcessingFile(true);
    setFileName(file.name);
    setFileSize(file.size);
    setFileMime(file.type || 'application/octet-stream');

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawContent(event.target?.result as string);
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      addToast({ type: 'error', title: 'Read error', message: 'Failed to process the selected file.' });
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const setSuccessMsg = (msg: string) => {
    addToast({ type: 'success', title: msg });
  };

  const handleFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    onCreateFolder({
      name: folderName.trim(),
      parentId: null,
      description: folderDescription || 'New folder directory',
      permissionLevel: folderPermission,
      allowedRoles: ALL_USER_ROLES,
    });

    setSuccessMsg(`Successfully created folder "${folderName}"!`);
    setFolderName('');
    setFolderDescription('');
  };

  const calculateTotalSize = () => {
    const bytes = files.reduce((acc, f) => acc + f.size, 0) + folders.reduce((acc, f) => acc + f.totalSize, 0);
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-xl border border-[#1e3059] bg-[#070c18] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22]">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900/60 border border-blue-700/80 text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Vantor Admin Security Dashboard</h2>
              <p className="text-xs text-slate-400">System Management, Metadata Control & User Permissions</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-slate-800/80 bg-[#060a17] text-xs">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-4 w-4 text-blue-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Storage Used</span>
              <span className="font-mono font-bold text-white text-xs">{calculateTotalSize()} MB</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Total Files</span>
              <span className="font-mono font-bold text-white text-xs">{files.length} files</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Folder className="h-4 w-4 text-amber-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Folders</span>
              <span className="font-mono font-bold text-white text-xs">{folders.length} folders</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Users</span>
              <span className="font-mono font-bold text-white text-xs">{users.length} accounts</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 bg-[#080d1c] text-xs font-medium">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center space-x-2 transition-colors ${activeTab === 'upload' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload New File</span>
          </button>

          <button
            onClick={() => setActiveTab('folder')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center space-x-2 transition-colors ${activeTab === 'folder' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Create Folder</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center space-x-2 transition-colors ${activeTab === 'files' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Manage Existing Metadata</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center space-x-2 transition-colors ${activeTab === 'logs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Security Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center space-x-2 transition-colors ${activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>User Management</span>
          </button>
        </div>



        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* 1. UPLOAD FILE TAB */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">File Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Project_Document_v1.0.pdf or Readme.md"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={fileCategory}
                    onChange={(e) => setFileCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Documents & Assets">Documents & Assets</option>
                    <option value="Documentation">Documentation</option>
                    <option value="Brand Assets">Brand Assets</option>
                    <option value="System Logs">System Logs</option>
                    <option value="Source Code">Source Code</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Parent Folder</label>
                  <select
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="root">Root Directory (Vantor Cloud Storage Repository)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Access Control Policy</label>
                  <select
                    value={filePermission}
                    onChange={(e) => setFilePermission(e.target.value as PermissionLevel)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="public">Public (All Authenticated Users)</option>
                    <option value="authenticated">Authenticated Only</option>
                    <option value="role_restricted">Role Restricted (Engineers/Analysts)</option>
                    <option value="admin_only">Admin Only (Strict Confidential)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tags (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="e.g. documents, assets, security, stable"
                  value={fileTags}
                  onChange={(e) => setFileTags(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief summary of the file..."
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select File (Max 2MB)</label>
                <div className="relative w-full bg-[#040813] border border-slate-800 rounded-lg p-2 flex items-center justify-center">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-900/40 file:text-blue-300 hover:file:bg-blue-800/60 transition-colors"
                  />
                  {isProcessingFile && <span className="absolute right-3 text-xs text-blue-400">Processing...</span>}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-glow-blue transition-all flex items-center justify-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload File to Vantor Vault</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. CREATE FOLDER TAB */}
          {activeTab === 'folder' && (
            <form onSubmit={handleFolderSubmit} className="space-y-4 text-xs font-sans max-w-lg mx-auto py-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Folder Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter a folder name (e.g. Design Assets, v2.0 Release)"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Folder Description</label>
                <input
                  type="text"
                  placeholder="Purpose of this folder directory..."
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Access Control Level</label>
                <select
                  value={folderPermission}
                  onChange={(e) => setFolderPermission(e.target.value as PermissionLevel)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="public">Public Share</option>
                  <option value="authenticated">Authenticated Users</option>
                  <option value="admin_only">Admin Only</option>
                </select>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>Create Directory Folder</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. MANAGE FILES & FOLDERS METADATA TAB */}
          {activeTab === 'files' && (
            <div className="space-y-6 text-xs">
              {/* Folders Inventory */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <Folder className="h-4 w-4 text-amber-400" />
                  <span>Folder Directories ({folders.length})</span>
                </h4>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/40">
                  {folders.map((folder) => (
                    <div key={folder.id} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{folder.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({folder.itemCount} items · {folder.formattedSize})</span>
                          <span className="bg-amber-950 border border-amber-800 text-amber-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
                            {folder.permissionLevel}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{folder.description}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onDeleteFolder(folder.id)}
                          className="rounded p-1.5 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors flex items-center space-x-1"
                          title="Delete folder and contents"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-[11px]">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {folders.length === 0 && (
                    <div className="p-3 text-slate-500 text-center">No folders found.</div>
                  )}
                </div>
              </div>

              {/* Files Inventory */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>File Assets ({files.length})</span>
                </h4>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/40">
                  {files.map((file) => (
                    <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{file.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({file.formattedSize})</span>
                          <span className="bg-blue-950 border border-blue-800 text-blue-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
                            {file.permissionLevel}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{file.description}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onDeleteFile(file.id)}
                          className="rounded p-1.5 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors flex items-center space-x-1"
                          title="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-[11px]">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. USER MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-amber-100">
                <div className="flex items-start space-x-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                  <p>
                    Self-protection is enforced: current administrators cannot delete their own account, lock themselves, or remove their own admin role.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-800 bg-[#080d1c] text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Role</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Last active</th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map((managedUser) => {
                      const isSelf = managedUser.id === currentUserId;

                      return (
                        <tr key={managedUser.id} className="hover:bg-slate-900/60">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{managedUser.name}</div>
                            <div className="text-[11px] text-slate-400">{managedUser.email}</div>
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={managedUser.role}
                              disabled={isSelf}
                              onChange={(event) => onUpdateUser(managedUser.id, { role: event.target.value as UserRole })}
                              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="admin">Admin</option>
                              <option value="author">Author</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${managedUser.locked
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}>
                              {managedUser.locked ? 'Locked' : 'Active'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{formatFriendlyDate(managedUser.lastActive)}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => onUpdateUser(managedUser.id, { locked: !managedUser.locked })}
                                disabled={isSelf}
                                className="inline-flex items-center space-x-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {managedUser.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                <span>{managedUser.locked ? 'Unlock' : 'Lock'}</span>
                              </button>
                              <button
                                onClick={() => onDeleteUser(managedUser.id)}
                                disabled={isSelf}
                                className="inline-flex items-center space-x-1 rounded border border-red-800 bg-red-950/70 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. AUDIT LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200">Security Audit Trail History ({auditLogs.length})</h4>
                {onClearAuditLogs && auditLogs.length > 0 && (
                  <button
                    onClick={onClearAuditLogs}
                    className="flex items-center space-x-1 rounded bg-red-950/80 border border-red-800/80 px-2.5 py-1 text-red-300 hover:bg-red-900 hover:text-white transition-colors text-[11px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear Audit History</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-blue-400 font-mono text-[10px] font-bold flex-shrink-0">
                      {log.action.substring(0, 3)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{log.targetName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] mt-0.5">{log.details}</p>
                      <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400">
                        <span>By: <strong className="text-blue-300">{log.performedBy}</strong></span>
                        <span>•</span>
                        <span className="uppercase font-mono text-slate-500">Role: {log.role}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
