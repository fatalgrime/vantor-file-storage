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
  Info,
} from 'lucide-react';
import { VantorFile, UserRole, VantorFolder, VantorRepository } from '../lib/types';
import { canReadItem, ALL_USER_ROLES } from '../lib/authorization';
import { FilePreviewViewport } from './preview/FilePreviewViewport';

interface FilePreviewModalProps {
  file: VantorFile | null;
  onClose: () => void;
  onDownload: (file: VantorFile) => void;
  role?: UserRole;
  userId?: string;
  allFolders?: VantorFolder[];
  repository?: VantorRepository;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  role = 'admin',
  userId = '',
  allFolders = [],
  repository,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'security'>('preview');

  if (!file) return null;

  const canDownload = canReadItem(role, userId, file, allFolders, repository);

  const handleCopyLink = () => {
    const fakeUrl = `${window.location.origin}/share/${file.id}`;
    navigator.clipboard.writeText(fakeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContentPreview = () => {
    return <FilePreviewViewport file={file} canDownload={canDownload} onDownload={onDownload} />;
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
                className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-950/30"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-4 text-xs font-medium border-b-2 transition-all ${activeTab === 'preview'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            File Preview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-4 text-xs font-medium border-b-2 transition-all ${activeTab === 'details'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            Metadata & Properties
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-4 text-xs font-medium border-b-2 transition-all ${activeTab === 'security'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            Access Security Matrix
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {activeTab === 'preview' && renderContentPreview()}

          {activeTab === 'details' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-400">File Size:</span>
                  <span className="font-mono text-white font-semibold">{file.formattedSize}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-400">Created Date:</span>
                  <span className="font-mono text-white">{file.createdAt}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-400">Uploader ID:</span>
                  <span className="font-mono text-white">{file.uploadedBy}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-400">MIME Type:</span>
                  <span className="font-mono text-blue-300">{file.mimeType}</span>
                </div>
              </div>

              {file.description && (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                  <h5 className="font-semibold text-slate-200 mb-1">Description</h5>
                  <p className="text-slate-400 leading-relaxed">{file.description}</p>
                </div>
              )}

              {file.tags && file.tags.length > 0 && (
                <div className="flex items-center space-x-2 pt-2">
                  <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-400 font-semibold mr-2">Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {file.tags.map((tag, idx) => (
                      <span key={idx} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-lg border border-blue-800/60 bg-blue-950/30 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Lock className="h-4 w-4 text-blue-400" />
                  <h4 className="font-bold text-sm text-white">Current Access Policy: {file.permissionLevel}</h4>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {file.permissionLevel === 'public' && 'This file is accessible to anyone with a valid portal link.'}
                  {file.permissionLevel === 'authenticated' && 'Requires valid Vantor user authentication to access.'}
                  {file.permissionLevel === 'private' && 'Strictly restricted to users with explicit owner permissions.'}
                  {file.permissionLevel === 'role_restricted' && `Restricted to assigned organizational roles.`}
                </p>
              </div>
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
                <div className="flex items-start space-x-2.5">
                  <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-semibold text-amber-200">Shareable Links & Access</h5>
                    <p className="text-slate-300 leading-relaxed">
                      To create and manage shareable links for this file, click the share icon on the file action row in the dashboard.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-2">
                <h5 className="font-semibold text-slate-200">Authorized Roles Matrix</h5>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALL_USER_ROLES.map((roleItem: UserRole) => {
                    const isAllowed = file.allowedRoles.includes(roleItem) || file.permissionLevel === 'public';
                    return (
                      <span
                        key={roleItem}
                        className={`px-3 py-1 rounded border text-xs font-mono font-medium ${isAllowed
                          ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                          }`}
                      >
                        {roleItem}
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
