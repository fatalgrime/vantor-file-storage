'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Lock, 
  Globe, 
  Users, 
  ShieldAlert, 
  Calendar, 
  User, 
  HardDrive, 
  Tag, 
  Eye, 
  Code
} from 'lucide-react';
import { VantorFile, UserRole, VantorFolder, VantorRepository } from '../lib/types';
import { canReadItem, ALL_USER_ROLES } from '../lib/authorization';
import { PdfViewer } from './PdfViewer';

interface FilePreviewModalProps {
  file: VantorFile | null;
  onClose: () => void;
  onDownload: (file: VantorFile) => void;
  role: UserRole;
  userId: string;
  allFolders: VantorFolder[];
  repository: VantorRepository | undefined;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  role,
  userId,
  allFolders,
  repository,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'security'>('preview');

  if (!file) return null;

  const canDownload = canReadItem(role, userId, file, allFolders, repository);

  const handleCopyLink = () => {
    const fakeUrl = `https://vantor.cloud/storage/files/${file.id}`;
    navigator.clipboard.writeText(fakeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContentPreview = () => {
    if (file.mimeType.startsWith('image/') && file.content?.startsWith('data:')) {
      return (
        <div className="flex items-center justify-center p-4 bg-slate-950/60 rounded-lg border border-slate-800">
          <img src={file.content} alt={file.name} className="max-w-full max-h-[60vh] object-contain rounded" />
        </div>
      );
    }

    if (file.extension === 'md') {
      return (
        <div className="prose prose-invert max-w-none text-slate-200 text-sm font-sans space-y-3 bg-slate-950/60 rounded-lg p-4 border border-slate-800">
          <div className="whitespace-pre-wrap font-sans leading-relaxed">
            {file.content || file.description}
          </div>
        </div>
      );
    }

    if (file.extension === 'pdf' || file.mimeType === 'application/pdf') {
      return (
        <div className="w-full flex items-center justify-center bg-slate-950/40 rounded-lg">
          <PdfViewer file={file} canDownload={canDownload} onDownload={onDownload} />
        </div>
      );
    }

    if (['json', 'ts', 'js', 'py', 'svg', 'xml'].includes(file.extension)) {
      return (
        <div className="bg-[#040813] rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800/80 leading-relaxed shadow-inner">
          <pre>{file.content || `// Source contents of ${file.name}`}</pre>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-950/50 rounded-lg border border-slate-800/80 text-center">
        <FileText className="h-12 w-12 text-blue-400 mb-3" />
        <h4 className="text-base font-bold text-white mb-1">{file.name}</h4>
        <p className="text-xs text-slate-400 max-w-md">{file.description}</p>
        <div className="mt-4 flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded">
            {file.formattedSize} · {file.mimeType}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22]">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{file.name}</h3>
              <p className="text-xs text-slate-400">{file.category} · {file.fileType}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canDownload && (
              <button
                onClick={() => onDownload(file)}
                className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="flex items-center space-x-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 bg-[#060a17] text-xs font-medium">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'preview' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            File Preview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'details' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Metadata Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Access Security & Permissions
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'preview' && renderContentPreview()}

          {activeTab === 'details' && (
            <div className="space-y-4 text-xs font-sans text-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><HardDrive className="h-3.5 w-3.5 mr-1 text-blue-400" /> Size:</span>
                  <p className="font-mono text-sm text-white font-semibold">{file.formattedSize} ({file.size.toLocaleString()} bytes)</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><User className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Uploaded By:</span>
                  <p className="font-medium text-sm text-white">{file.uploadedBy} ({file.uploadedByRole})</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><Calendar className="h-3.5 w-3.5 mr-1 text-purple-400" /> Created Date:</span>
                  <p className="font-mono text-xs text-white">{new Date(file.createdAt).toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><Download className="h-3.5 w-3.5 mr-1 text-cyan-400" /> Downloads:</span>
                  <p className="font-mono text-sm text-white font-semibold">{file.downloadCount} downloads</p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold">Description:</span>
                <p className="text-slate-300 leading-relaxed">{file.description}</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-center space-x-2">
                <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-slate-400 font-semibold mr-2">Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map((tag, idx) => (
                    <span key={idx} className="bg-slate-800 border border-slate-700 text-blue-300 px-2 py-0.5 rounded text-[11px] font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-lg border border-blue-800/60 bg-blue-950/30 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Lock className="h-4 w-4 text-blue-400" />
                  <h4 className="font-bold text-sm text-white">Current Access Policy: {file.permissionLevel.toUpperCase()}</h4>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {file.permissionLevel === 'public' && 'This file is accessible to all authenticated Vantor Cloud workspace users.'}
                  {file.permissionLevel === 'authenticated' && 'Requires valid Vantor user authentication via Clerk.'}
                  {file.permissionLevel === 'admin_only' && 'Strictly restricted to users with System Administrator privileges.'}
                  {file.permissionLevel === 'role_restricted' && `Restricted to assigned roles: ${file.allowedRoles.join(', ')}.`}
                </p>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-2">
                <h5 className="font-semibold text-slate-200">Authorized Roles Matrix</h5>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALL_USER_ROLES.map((role: UserRole) => {
                    const isAllowed = file.allowedRoles.includes(role) || file.permissionLevel === 'public';
                    return (
                      <span
                        key={role}
                        className={`px-3 py-1 rounded border text-xs font-mono font-medium ${
                          isAllowed
                            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                      >
                        {role}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
