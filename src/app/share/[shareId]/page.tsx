'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  X,
  Key,
  Download,
  Calendar,
  HardDrive,
  Eye,
  Folder,
  FileText,
  ArrowLeft,
  Shield,
  FileText as FileIcon,
  Check,
  Copy,
  ChevronRight as ChevronRightIcon,
  AlertCircle,
  Loader2,
  Flame
} from 'lucide-react';
import { VantorFile, VantorFolder, ShareLink } from '../../../lib/types';
import { useToast } from '../../../components/ToastProvider';
import { FilePreviewViewport } from '../../../components/preview/FilePreviewViewport';

export default function PublicSharePage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  const router = useRouter();
  const { addToast } = useToast();

  // Loading / Error states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Password screen
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const viewLoggedRef = useRef(false);

  // Share link meta
  const [linkLabel, setLinkLabel] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [isOneTimeOnly, setIsOneTimeOnly] = useState(false);
  const [itemType, setItemType] = useState<'file' | 'folder'>('file');

  // Payload data
  const [fileData, setFileData] = useState<VantorFile | null>(null);

  // Folder browser states
  const [rootFolder, setRootFolder] = useState<VantorFolder | null>(null);
  const [currentFolder, setCurrentFolder] = useState<VantorFolder | null>(null);
  const [folderFiles, setFolderFiles] = useState<VantorFile[]>([]);
  const [folderFolders, setFolderFolders] = useState<VantorFolder[]>([]);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);

  // Preview Modal for Folder Browser
  const [previewFile, setPreviewFile] = useState<VantorFile | null>(null);

  // Fetch initial details
  const fetchShareData = async (enteredPassword?: string, subfolderId?: string) => {
    try {
      setLoading(true);

      let url = `/api/public/share/${shareId}`;
      const queryParams: string[] = [];
      if (enteredPassword) queryParams.push(`password=${encodeURIComponent(enteredPassword)}`);
      if (subfolderId) queryParams.push(`subfolderId=${encodeURIComponent(subfolderId)}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => null);

      if (data?.passwordRequired) {
        setPasswordRequired(true);
        setLinkLabel(data.label || 'Secure Link');
        setItemType(data.itemType);
        setIsOneTimeOnly(Boolean(data.oneTimeOnly));
        if (enteredPassword || !res.ok || data?.error) {
          const msg = data?.error || 'Incorrect password. Please try again.';
          setAuthError(msg);
          addToast({
            type: 'error',
            title: 'Invalid Password',
            message: msg,
          });
        } else {
          setAuthError('');
        }
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to retrieve share contents.');
      }

      setErrorMsg('');
      setPasswordRequired(false);
      setAllowDownload(data.allowDownload);
      setIsOneTimeOnly(Boolean(data.oneTimeOnly));
      setItemType(data.itemType);

      if (data.itemType === 'file') {
        setFileData(data.file);
      } else {
        setRootFolder(data.rootFolder);
        setCurrentFolder(data.folder);
        setFolderFiles(data.files || []);
        setFolderFolders(data.folders || []);

        // Update breadcrumb trail path
        if (data.folder && data.rootFolder) {
          const trail = [{ id: data.rootFolder.id, name: data.rootFolder.name }];
          if (data.folder.id !== data.rootFolder.id) {
            trail.push({ id: data.folder.id, name: data.folder.name });
          }
          setFolderPath(trail);
        }
      }

      // Log view count increment (silently)
      if (!viewLoggedRef.current) {
        viewLoggedRef.current = true;
        await fetch(`/api/public/share/${shareId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: enteredPassword, action: 'view' }),
        }).catch(e => console.error("Metrics view error", e));
      }

      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error connecting to storage gateway.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shareId) {
      fetchShareData();
    }
  }, [shareId]);

  // Handle password submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!password.trim()) {
      addToast({
        type: 'warning',
        title: 'Password Required',
        message: 'Please enter a password to decrypt this file.',
      });
      return;
    }

    // Test login
    fetchShareData(password.trim());
  };

  // Download Trigger
  const triggerDownload = async (fileToDownload: VantorFile) => {
    if (!allowDownload) return;

    try {
      // Record download count metric
      await fetch(`/api/public/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'download' }),
      }).catch(e => console.error("Metrics download error", e));

      // Initiate download
      let dlUrl = '';
      let isTempBlob = false;

      if (fileToDownload.content?.startsWith('data:')) {
        dlUrl = fileToDownload.content;
      } else if (fileToDownload.url) {
        dlUrl = fileToDownload.url;
      } else if (fileToDownload.content) {
        const blob = new Blob([fileToDownload.content], { type: fileToDownload.mimeType });
        dlUrl = URL.createObjectURL(blob);
        isTempBlob = true;
      } else {
        const blob = new Blob([fileToDownload.description || ''], { type: fileToDownload.mimeType || 'text/plain' });
        dlUrl = URL.createObjectURL(blob);
        isTempBlob = true;
      }

      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = fileToDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (isTempBlob) {
        setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
      }
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  // Navigating inside Shared Folders
  const handleOpenSubfolder = (folderId: string) => {
    fetchShareData(password, folderId);
  };

  // Navigating back
  const handleNavigateBack = () => {
    if (folderPath.length > 1) {
      const parentFolderId = rootFolder?.id || '';
      handleOpenSubfolder(parentFolderId);
    }
  };

  // Render individual file previews inside the Portal page
  const renderSharedFilePreview = (file: VantorFile) => {
    return <FilePreviewViewport file={file} canDownload={allowDownload} onDownload={triggerDownload} />;
  };

  // LOADING SCREEN
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-slate-400 font-mono font-medium">Securing connection to Vantor Storage...</span>
        </div>
      </div>
    );
  }

  // ERROR SCREEN
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-md rounded-xl border border-red-900/50 bg-red-950/15 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-950 border border-red-900/80 text-red-400 mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold text-white">Access Link Unusable</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="mt-5 w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-750 transition-all"
          >
            Go to Portal Login
          </button>
        </div>
      </div>
    );
  }

  // PASSWORD GATE SCREEN
  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-md rounded-xl border border-[#1e3059] bg-[#070c18] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400 mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold text-white">{linkLabel}</h1>
          <p className="mt-1.5 text-xs text-slate-400">This share link is password-protected. Enter the password below to decrypt and view the shared {itemType}.</p>

          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                placeholder="Enter password to decrypt..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError('');
                }}
                className={`w-full rounded-lg border bg-slate-900 pl-10 pr-3 py-2 text-xs text-white outline-none transition-colors ${authError
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white transition-all shadow-glow-blue"
            >
              Unlock Shared Asset
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN PUBLIC CONTENT VIEWER
  return (
    <div className="min-h-screen bg-[#060a17] text-slate-100 flex flex-col font-sans select-none pointer-events-auto">
      {/* Top Header branding */}
      <header className="border-b border-[#1e3059] bg-[#070c18]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Vantor logo" className="h-7 w-auto object-contain" />
          <div className="h-4 w-px bg-slate-800"></div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Share Portal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 py-8 flex flex-col items-center">
        {isOneTimeOnly && (
          <div className="w-full max-w-3xl mb-6 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-center shadow-lg shadow-rose-950/20">
            <div className="flex items-center justify-center space-x-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
              <Flame className="h-4 w-4 text-rose-400" />
              <span>One-Time Self-Destruct Link</span>
            </div>
            <p className="mt-1 text-xs text-rose-200/80">
              This link is single-use only. Accessing or downloading this asset will permanently burn and destroy this access link.
            </p>
          </div>
        )}

        {itemType === 'file' && fileData && (
          <div className="w-full max-w-3xl space-y-5 text-center">
            {/* Header info */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white truncate px-2">{fileData.name}</h2>
              <p className="text-xs text-slate-400 font-mono">
                {fileData.fileType} · {fileData.formattedSize}
              </p>
            </div>

            {/* Standalone File Viewer */}
            <div className="bg-[#070d1d] border border-[#1e3059] rounded-xl p-5 shadow-2xl relative">
              {renderSharedFilePreview(fileData)}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {allowDownload ? (
                <button
                  onClick={() => triggerDownload(fileData)}
                  className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Download file ({fileData.formattedSize})</span>
                </button>
              ) : (
                <div className="flex items-center space-x-1.5 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-slate-400 font-medium">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Download Disabled (View Only Link)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {itemType === 'folder' && currentFolder && (
          <div className="w-full space-y-4">
            {/* Folder Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070c18] border border-[#1e3059] p-4 rounded-xl">
              <div>
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Shared Folder Browser</p>
                <h1 className="text-lg font-bold text-white flex items-center space-x-2 mt-0.5">
                  <Folder className="h-5 w-5 text-emerald-500" />
                  <span>{currentFolder.name}</span>
                </h1>
                {currentFolder.description && (
                  <p className="text-xs text-slate-400 mt-1">{currentFolder.description}</p>
                )}
              </div>

              {!allowDownload && (
                <span className="flex items-center space-x-1 text-[10px] bg-amber-950/80 border border-amber-900 text-amber-400 px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  <span>View Only Browser</span>
                </span>
              )}
            </div>

            {/* Folder Navigation Trail */}
            {folderPath.length > 1 && (
              <button
                onClick={handleNavigateBack}
                className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Parent Directory</span>
              </button>
            )}

            {/* Folder Grid Contents */}
            <div className="bg-[#070d1d] border border-[#1e3059] rounded-xl overflow-hidden shadow-2xl">
              <div className="grid grid-cols-1 divide-y divide-slate-850">
                {/* Header labels */}
                <div className="grid grid-cols-12 px-6 py-2.5 bg-[#090f22] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-8 md:col-span-6">Name</span>
                  <span className="col-span-4 md:col-span-3">Size</span>
                  <span className="hidden md:block col-span-3 text-right">Action</span>
                </div>

                {/* Subfolders list */}
                {folderFolders.map((sub: VantorFolder) => (
                  <div
                    key={sub.id}
                    onClick={() => handleOpenSubfolder(sub.id)}
                    className="grid grid-cols-12 px-6 py-3 items-center hover:bg-slate-800/30 cursor-pointer text-xs"
                  >
                    <div className="col-span-8 md:col-span-6 flex items-center space-x-2.5 min-w-0">
                      <Folder className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{sub.name}</span>
                    </div>
                    <span className="col-span-4 md:col-span-3 font-mono text-[10px] text-slate-400">--</span>
                    <div className="hidden md:flex col-span-3 justify-end">
                      <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ))}

                {/* Files list */}
                {folderFiles.map((f: VantorFile) => (
                  <div
                    key={f.id}
                    onClick={() => setPreviewFile(f)}
                    className="grid grid-cols-12 px-6 py-3 items-center hover:bg-slate-800/30 cursor-pointer text-xs"
                  >
                    <div className="col-span-8 md:col-span-6 flex items-center space-x-2.5 min-w-0">
                      <FileIcon className="h-4.5 w-4.5 text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{f.name}</span>
                    </div>
                    <span className="col-span-4 md:col-span-3 font-mono text-[10px] text-slate-400">{f.formattedSize}</span>
                    <div className="hidden md:flex col-span-3 justify-end items-center space-x-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPreviewFile(f)}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Preview
                      </button>
                      {allowDownload && (
                        <button
                          onClick={() => triggerDownload(f)}
                          className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 transition-colors"
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {folderFolders.length === 0 && folderFiles.length === 0 && (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    This directory is empty.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER SUMMARY */}
      <footer className="border-t border-[#1e3059] bg-[#070c18] py-4 text-center text-[10px] text-slate-500 font-mono flex-shrink-0">
        Powered by Vantor Storage (storage.vantor.group) • All Rights Reserved.
      </footer>

      {/* EMBEDDED FILE PREVIEW MODAL FOR FOLDER BROWSER */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22] flex-shrink-0">
              <div>
                <h3 className="font-bold text-base text-white">{previewFile.name}</h3>
                <p className="text-xs text-slate-400">{previewFile.fileType} · {previewFile.formattedSize}</p>
              </div>
              <div className="flex items-center space-x-2">
                {allowDownload && (
                  <button
                    onClick={() => triggerDownload(previewFile)}
                    className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#060a17] text-center">
              {renderSharedFilePreview(previewFile)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
