'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  Grid,
  List,
  Upload,
  FolderPlus,
  SlidersHorizontal,
  Lock,
  UserCheck,
  Sparkles,
  Trash2,
  HelpCircle,
  X,
  Mail
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserButton, useUser, SignInButton } from '@clerk/nextjs';
import { UserRole } from '../lib/types';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: string;
  setTypeFilter: (filter: string) => void;
  modifiedFilter: string;
  setModifiedFilter: (filter: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  selectedCount: number;
  onBatchDownload: () => void;
  onBatchDelete?: () => void;
  onOpenUploadModal: () => void;
  onOpenCreateFolderModal: () => void;
  onOpenAdminPanel: () => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  canEditRepository: boolean;
  canDeleteContent: boolean;
  canManagePlatform: boolean;
  canUseRoleSwitcher: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  modifiedFilter,
  setModifiedFilter,
  viewMode,
  setViewMode,
  selectedCount,
  onBatchDownload,
  onBatchDelete,
  onOpenUploadModal,
  onOpenCreateFolderModal,
  onOpenAdminPanel,
  currentRole,
  setCurrentRole,
  canEditRepository,
  canDeleteContent,
  canManagePlatform,
  canUseRoleSwitcher,
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { isSignedIn } = useUser();
  if (!isSignedIn) return null;

  const isDark = true;

  return (
    <header className={`sticky top-0 z-40 border-b transition-colors duration-300 ${isDark
        ? 'border-[#1e3059] bg-[#070c18]/95 backdrop-blur-md'
        : 'border-gray-200 bg-white/95 backdrop-blur-md shadow-sm'
      }`}>
      {/* Top Main Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center space-x-3 select-none cursor-pointer group">
          <img
            src="/logo.png"
            alt="Vantor logo"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="h-7 w-auto object-contain select-none pointer-events-auto"
          />
          <span className={`text-xs font-semibold tracking-widest uppercase ${isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-gray-500 group-hover:text-gray-800'} transition-colors`}>
            Storage
          </span>
        </Link>

        {/* Action Controls & Authentication */}
        <div className="flex items-center space-x-3">
          {/* Role Toggle Switcher */}
          {canUseRoleSwitcher && (
            <div className={`flex items-center space-x-1 rounded-lg border p-1 text-xs ${isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-gray-100 border-gray-200'
              }`}>
              <span className={`px-2 text-[11px] font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Role:</span>
              <button
                onClick={() => setCurrentRole('admin')}
                className={`flex items-center space-x-1 rounded px-2.5 py-1 font-medium transition-all ${currentRole === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                <Lock className="h-3 w-3" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => setCurrentRole('author')}
                className={`flex items-center space-x-1 rounded px-2.5 py-1 font-medium transition-all ${currentRole === 'author'
                    ? isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-gray-300 text-gray-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                <UserCheck className="h-3 w-3" />
                <span>Author</span>
              </button>
              <button
                onClick={() => setCurrentRole('viewer')}
                className={`flex items-center space-x-1 rounded px-2.5 py-1 font-medium transition-all ${currentRole === 'viewer'
                    ? isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-gray-300 text-gray-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                <UserCheck className="h-3 w-3" />
                <span>Viewer</span>
              </button>
            </div>
          )}

          {/* Admin Dashboard Action Button */}
          {canManagePlatform && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Admin Dashboard</span>
            </button>
          )}

          {/* Download Button */}
          <button
            onClick={onBatchDownload}
            disabled={selectedCount === 0}
            className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${selectedCount > 0
                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
                : isDark
                  ? 'bg-slate-900 border-slate-700/80 text-slate-400 opacity-60 cursor-not-allowed'
                  : 'bg-gray-100 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
              }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
          </button>

          {/* Batch Delete Button for Admin */}
          {canDeleteContent && selectedCount > 0 && onBatchDelete && (
            <button
              onClick={onBatchDelete}
              className="flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold border bg-red-950/80 border-red-700 text-red-200 hover:bg-red-900 hover:text-white transition-all shadow-md"
              title="Delete selected files/folders"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              <span>Delete ({selectedCount})</span>
            </button>
          )}

          {/* Quick Upload / Create Folder if Admin */}
          {canEditRepository && (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={onOpenUploadModal}
                className={`flex items-center space-x-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${isDark
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                    : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                  }`}
                title="Upload file"
              >
                <Upload className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <button
                onClick={onOpenCreateFolderModal}
                className={`flex items-center space-x-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${isDark
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                    : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                  }`}
                title="New folder"
              >
                <FolderPlus className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline">New Folder</span>
              </button>
            </div>
          )}

          {/* Help Information Toggle */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="rounded-lg p-2 transition-all border bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Help & Information"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Clerk User Button / Sign In */}
          <div className={`pl-2 border-l ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            {isSignedIn ? (
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: `w-8 h-8 rounded-full border-2 ${isDark ? 'border-blue-500/70' : 'border-blue-500'}`,
                    userButtonPopoverCard: '!bg-white border border-gray-200 shadow-xl',
                    userButtonPopoverActionButton: '!text-gray-700 hover:!bg-gray-100',
                    userButtonPopoverActionButtonText: '!text-gray-700 font-medium',
                    userButtonPopoverActionButtonIcon: '!text-gray-500',
                    userButtonPopoverFooter: 'hidden',
                    userPreviewTextContainer: '!text-gray-900',
                    userPreviewMainIdentifier: '!text-gray-900 font-semibold',
                    userPreviewSecondaryIdentifier: '!text-gray-500',
                  },
                }}
              />
            ) : (
              <SignInButton mode="modal">
                <button className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-md ${isDark
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>

      {/* Sub Navigation Bar: Filters, Search, View Switcher */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-6 py-2 transition-colors duration-300 ${isDark ? 'border-[#1e3059]/60 bg-[#090e1c]' : 'border-gray-100 bg-gray-50'
        }`}>
        {/* Left: Public Share & Filters */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1 text-xs font-medium border px-2.5 py-1 rounded-md ${isDark ? 'text-slate-300 bg-slate-900/90 border-slate-800' : 'text-gray-600 bg-white border-gray-200'
            }`}>
            <Lock className="h-3 w-3 text-blue-400" />
            <span>Public share</span>
            <span className={`ml-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>▼</span>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`appearance-none border text-xs font-medium rounded-md px-2.5 py-1 pr-6 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors ${isDark
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
            >
              <option value="ALL">Type: All</option>
              <option value="Folder">Folders</option>
              <option value="Markdown document">Markdown</option>
              <option value="PDF Document">PDF Documents</option>
              <option value="SVG Vector Image">Images</option>
              <option value="JSON Document">JSON / Configs</option>
              <option value="ZIP Archive">Archives</option>
            </select>
            <SlidersHorizontal className={`h-3 w-3 absolute right-2 top-1.5 pointer-events-none ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
          </div>

          {/* Modified Date Filter */}
          <div className="relative">
            <select
              value={modifiedFilter}
              onChange={(e) => setModifiedFilter(e.target.value)}
              className={`appearance-none border text-xs font-medium rounded-md px-2.5 py-1 pr-6 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors ${isDark
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
            >
              <option value="ALL">Modified: Any time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last week">Last week</option>
            </select>
          </div>
        </div>

        {/* Right: Search & View Mode Switcher */}
        <div className="flex items-center space-x-3">
          {/* Quick Search Field */}
          <div className="relative w-48 sm:w-64">
            <Search className={`h-3.5 w-3.5 absolute left-2.5 top-2 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search files or folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${isDark
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-gray-200 hover:border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2 top-1 text-xs ${isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
              >
                ✕
              </button>
            )}
          </div>

          {/* Grid / List View Toggle */}
          <div className={`flex items-center border rounded-md p-0.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-200'}`}>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-colors ${viewMode === 'list'
                  ? isDark ? 'bg-slate-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-700'
                }`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors ${viewMode === 'grid'
                  ? isDark ? 'bg-slate-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-700'
                }`}
              title="Grid View"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

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
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-lg overflow-hidden rounded-xl border border-blue-900/60 bg-[#090f22] p-6 shadow-2xl"
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
                <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
                  <p>
                    Vantor Storage is a centralized, high-security cloud asset management workspace. It provides secure file distribution, access controls, detailed change logging, and versioning for digital content across authorized repositories.
                  </p>
                  <p>
                    This console operates under rigid encryption protocols and restricts document sharing according to role-based access control policies. Unauthorized use or data exfiltration is strictly prohibited.
                  </p>
                </div>

                {/* Technical Contact Section */}
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
    </header>
  );
};
