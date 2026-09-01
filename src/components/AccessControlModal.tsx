'use client';

import React, { useState } from 'react';
import {
  X,
  Lock,
  Globe,
  Users,
  ShieldAlert,
  Check,
  UserPlus,
  Trash2,
  Link as LinkIcon,
  Calendar,
  Key,
  Copy,
  Plus,
  Eye,
  Download,
  Flame
} from 'lucide-react';
import { VantorFile, VantorFolder, PermissionLevel, UserRole, VantorUser, Collaborator, ShareLink } from '../lib/types';
import { ALL_USER_ROLES } from '../lib/authorization';
import { useToast } from './ToastProvider';
import { CustomSelect } from './CustomSelect';

interface AccessControlModalProps {
  item: VantorFile | VantorFolder | null;
  isFolder: boolean;
  onClose: () => void;
  onSavePermissions: (
    id: string,
    permissionLevel: PermissionLevel,
    allowedRoles: UserRole[],
    isFolder: boolean,
    collaborators: Collaborator[],
    propagateToChildren: boolean
  ) => void;
  users: VantorUser[];
  currentUserId: string;
  shares: ShareLink[];
  onSaveShares: (shares: ShareLink[]) => void;
}

export const AccessControlModal: React.FC<AccessControlModalProps> = ({
  item,
  isFolder,
  onClose,
  onSavePermissions,
  users,
  currentUserId,
  shares,
  onSaveShares,
}) => {
  if (!item) return null;

  const [activeTab, setActiveTab] = useState<'policy' | 'share' | 'links'>('policy');
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>(item.permissionLevel);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(item.allowedRoles || ['admin']);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(item.collaborators || []);
  const [inviteUserId, setInviteUserId] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [propagateToChildren, setPropagateToChildren] = useState<boolean>(true);

  // Link Generation Form States
  const [linkLabel, setLinkLabel] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [oneTimeOnly, setOneTimeOnly] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expirationType, setExpirationType] = useState<'never' | '1h' | '1d' | '7d' | '30d' | 'custom'>('never');
  const [customExpirationDate, setCustomExpirationDate] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleToggleRole = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length === 1 && selectedRoles.includes('admin')) return;
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleInvite = () => {
    if (!inviteUserId) return;
    const targetUser = users.find((u) => u.id === inviteUserId);
    if (!targetUser) return;

    if (collaborators.some((c) => c.userId === inviteUserId)) return;

    const newCollaborator: Collaborator = {
      userId: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: inviteRole,
    };

    setCollaborators([...collaborators, newCollaborator]);
    setInviteUserId('');
  };

  const handleRemoveCollaborator = (userId: string) => {
    setCollaborators(collaborators.filter((c) => c.userId !== userId));
  };

  const handleSave = () => {
    onSavePermissions(item.id, permissionLevel, selectedRoles, isFolder, collaborators, propagateToChildren);
    addToast({
      type: 'success',
      title: 'Permissions saved',
      message: `Updated access permissions for "${item.name}".`,
    });
    onClose();
  };

  // Share Links Handlers
  const handleCreateShareLink = (e: React.FormEvent) => {
    e.preventDefault();

    // Generate unique random share link ID
    const shareId = 'share-' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);

    let expiresAt: string | undefined = undefined;
    const now = Date.now();
    if (expirationType === '1h') expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    else if (expirationType === '1d') expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    else if (expirationType === '7d') expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (expirationType === '30d') expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    else if (expirationType === 'custom' && customExpirationDate) {
      expiresAt = new Date(customExpirationDate).toISOString();
    }

    const newLink: ShareLink = {
      id: shareId,
      itemId: item.id,
      itemType: isFolder ? 'folder' : 'file',
      name: item.name,
      label: linkLabel.trim() || `${isFolder ? 'Folder' : 'File'} Share Link`,
      permission: allowDownload ? 'edit' : 'view',
      allowDownload,
      oneTimeOnly,
      selfDestructed: false,
      password: usePassword && password ? password : undefined,
      expiresAt,
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
      viewsCount: 0,
      downloadsCount: 0,
    };

    onSaveShares([...shares, newLink]);
    addToast({
      type: 'success',
      title: 'Share link generated',
      message: `Created ${oneTimeOnly ? 'one-time self-destruct ' : ''}share link "${newLink.label}".`,
    });

    // Reset Form
    setLinkLabel('');
    setAllowDownload(true);
    setOneTimeOnly(false);
    setUsePassword(false);
    setPassword('');
    setExpirationType('never');
    setCustomExpirationDate('');
  };

  const handleRevokeShareLink = (linkId: string) => {
    onSaveShares(shares.filter(s => s.id !== linkId));
    addToast({
      type: 'info',
      title: 'Share link revoked',
      message: 'The share link has been revoked and removed.',
    });
  };

  const handleCopyShareLink = (linkId: string) => {
    const url = `${window.location.origin}/share/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
    addToast({
      type: 'success',
      title: 'Share link copied',
      message: 'Secure share link copied to clipboard.',
    });
  };

  const inviteableUsers = users.filter(
    (u) => u.id !== currentUserId && !collaborators.some((c) => c.userId === u.id)
  );

  const activeShares = shares.filter(s => s.itemId === item.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl sm:max-w-2xl rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22] flex-shrink-0 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950 border border-amber-800 text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Access & Security Settings</h3>
              <p className="text-xs text-slate-400">
                Managing: <span className="text-blue-400 font-semibold">{item.name}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1e3059] bg-[#080e20] text-xs font-semibold flex-shrink-0">
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-5 py-3 border-b-2 transition-all ${activeTab === 'policy'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            General Policy
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`px-5 py-3 border-b-2 transition-all ${activeTab === 'share'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            Collaborators
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`px-5 py-3 border-b-2 transition-all ${activeTab === 'links'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            Shareable Links
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-5 text-xs text-slate-200 bg-[#070d1d]">
          {activeTab === 'policy' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Access Level Policy</label>
                <div className="space-y-2">
                  <div
                    onClick={() => setPermissionLevel('public')}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${permissionLevel === 'public'
                      ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                  >
                    <Globe className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-xs">Public</h4>
                      <p className="text-[11px] text-slate-400">All authenticated users can view and download.</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPermissionLevel('authenticated')}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${permissionLevel === 'authenticated'
                      ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                  >
                    <Users className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-xs">Authenticated Users</h4>
                      <p className="text-[11px] text-slate-400">Signed-in users with verified credentials.</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPermissionLevel('role_restricted')}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${permissionLevel === 'role_restricted'
                      ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                  >
                    <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-xs">Role Restricted</h4>
                      <p className="text-[11px] text-slate-400">Restricted to selected user roles below.</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPermissionLevel('private')}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${permissionLevel === 'private'
                      ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                  >
                    <Lock className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-xs">Admin Only</h4>
                      <p className="text-[11px] text-slate-400">Restricted exclusively to Platform Administrators.</p>
                    </div>
                  </div>
                </div>
              </div>

              {permissionLevel === 'role_restricted' && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Allowed User Roles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_USER_ROLES.map((role) => {
                      const isChecked = selectedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleToggleRole(role)}
                          className={`flex items-center space-x-2 rounded-lg border p-2 text-xs font-mono transition-colors ${isChecked
                            ? 'border-blue-500 bg-blue-950/60 text-blue-300'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center ${isChecked ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700'}`}>
                            {isChecked && <Check className="h-3 w-3" />}
                          </div>
                          <span className="capitalize">{role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 font-sans">Invite User to Collaborate</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-grow">
                    <CustomSelect
                      value={inviteUserId}
                      onChange={setInviteUserId}
                      placeholder="Choose a user..."
                      options={[
                        { value: '', label: 'Choose a user...', icon: <UserPlus className="h-3.5 w-3.5 text-slate-400" /> },
                        ...inviteableUsers.map((u) => ({
                          value: u.id,
                          label: `${u.name} (${u.email})`,
                          icon: <Users className="h-3.5 w-3.5 text-blue-400" />,
                        })),
                      ]}
                    />
                  </div>

                  <div className="w-28">
                    <CustomSelect
                      value={inviteRole}
                      onChange={(val: string) => setInviteRole(val as 'viewer' | 'editor')}
                      options={[
                        { value: 'viewer', label: 'Viewer', icon: <Eye className="h-3.5 w-3.5 text-slate-400" /> },
                        { value: 'editor', label: 'Editor', icon: <UserPlus className="h-3.5 w-3.5 text-emerald-400" /> },
                      ]}
                    />
                  </div>

                  <button
                    onClick={handleInvite}
                    disabled={!inviteUserId}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-white shadow-glow-blue flex items-center space-x-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Invite</span>
                  </button>
                </div>
              </div>

              {isFolder && (
                <label className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propagateToChildren}
                    onChange={(e) => setPropagateToChildren(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block font-semibold text-slate-200">Cascade Access Permissions</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Apply this collaborator configuration to all nested subfolders and files.</span>
                  </div>
                </label>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Active Collaborators ({collaborators.length})</label>
                {collaborators.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-slate-500">
                    No collaborators have been added yet.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800">
                    {collaborators.map((c) => (
                      <div key={c.userId} className="flex items-center justify-between p-2.5 bg-slate-950/20">
                        <div className="min-w-0">
                          <span className="block font-bold text-white truncate">{c.name}</span>
                          <span className="block text-[10px] text-slate-400 truncate">{c.email}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${c.role === 'editor'
                            ? 'bg-blue-950 border border-blue-800 text-blue-300'
                            : 'bg-slate-900 border border-slate-800 text-slate-300'
                            }`}>
                            {c.role}
                          </span>
                          <button
                            onClick={() => handleRemoveCollaborator(c.userId)}
                            className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-6">
              {/* Generate New Link Form */}
              <form onSubmit={handleCreateShareLink} className="bg-[#090f22]/90 p-5 border border-slate-800 rounded-xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <span>Generate Secure Share Link</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">Public / Protected URL</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Link Name / Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Review, External Partner Access"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-[#060a17] px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Expiration selection */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">Access Expiration</label>
                    <CustomSelect
                      value={expirationType}
                      onChange={(val: string) => setExpirationType(val as any)}
                      options={[
                        { value: 'never', label: 'Never Expires', icon: <Calendar className="h-3.5 w-3.5 text-blue-400" /> },
                        { value: '1h', label: '1 Hour', icon: <Calendar className="h-3.5 w-3.5 text-cyan-400" /> },
                        { value: '1d', label: '1 Day', icon: <Calendar className="h-3.5 w-3.5 text-emerald-400" /> },
                        { value: '7d', label: '7 Days', icon: <Calendar className="h-3.5 w-3.5 text-amber-400" /> },
                        { value: '30d', label: '30 Days', icon: <Calendar className="h-3.5 w-3.5 text-purple-400" /> },
                        { value: 'custom', label: 'Custom Date', icon: <Calendar className="h-3.5 w-3.5 text-rose-400" /> },
                      ]}
                    />
                  </div>

                  {/* Download Permissions Option */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">File Download Permission</label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a17] px-3.5 py-2 cursor-pointer hover:border-slate-700 transition-colors">
                      <span className="text-xs text-slate-300 font-medium">Allow File Downloads</span>
                      <input
                        type="checkbox"
                        checked={allowDownload}
                        onChange={(e) => setAllowDownload(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {expirationType === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">Custom Expiration Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={customExpirationDate}
                      onChange={(e) => setCustomExpirationDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-[#060a17] px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                )}

                {/* Security options: One-Time Self-Destruct & Password Protection */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a17] px-3 py-2 cursor-pointer hover:border-slate-700 transition-colors">
                      <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                        <Flame className="h-3.5 w-3.5 text-rose-400" />
                        <span>One-Time Self-Destruct</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={oneTimeOnly}
                        onChange={(e) => setOneTimeOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a17] px-3 py-2 cursor-pointer hover:border-slate-700 transition-colors">
                      <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                        <Key className="h-3.5 w-3.5 text-amber-400" />
                        <span>Enable Passcode Security</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={usePassword}
                        onChange={(e) => setUsePassword(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  {usePassword && (
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-3.5 w-3.5 text-amber-400" />
                      <input
                        type="password"
                        required
                        placeholder="Set required passcode to access link..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-amber-900/60 bg-[#060a17] pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center space-x-2 rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Generate Share Link</span>
                  </button>
                </div>
              </form>

              {/* Active Links List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Active Generated Links ({activeShares.length})</h4>
                </div>
                {activeShares.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-[#090f22]/40 p-6 text-center text-xs text-slate-400">
                    No public share links generated yet for this item.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {activeShares.map((link) => {
                      const isExpired = (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) || (link.oneTimeOnly && link.selfDestructed);
                      return (
                        <div key={link.id} className="p-3.5 bg-[#090f22]/80 border border-slate-800 rounded-xl flex flex-col space-y-2.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-white text-xs flex items-center space-x-1.5">
                                {link.oneTimeOnly && <span title="One-Time Self-Destruct Link"><Flame className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" /></span>}
                                <span>{link.label}</span>
                              </span>
                              <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-400">
                                <span className="flex items-center"><Eye className="h-3 w-3 mr-1 text-blue-400" /> {link.viewsCount} views</span>
                                {link.allowDownload && (
                                  <span className="flex items-center"><Download className="h-3 w-3 mr-1 text-emerald-400" /> {link.downloadsCount} downloads</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => handleCopyShareLink(link.id)}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors border border-slate-800"
                                title="Copy Share Link"
                              >
                                {copiedLinkId === link.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => handleRevokeShareLink(link.id)}
                                className="p-1.5 hover:bg-red-950/80 rounded-lg text-slate-400 hover:text-red-400 transition-colors border border-slate-800"
                                title="Revoke & Delete Link"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            {link.oneTimeOnly && (
                              <span className={`px-2 py-0.5 rounded-md font-medium flex items-center ${link.selfDestructed
                                ? 'bg-red-950 border border-red-900 text-red-400 line-through'
                                : 'bg-rose-950/90 border border-rose-800 text-rose-300'
                                }`}>
                                <Flame className="h-3 w-3 mr-1 text-rose-400 flex-shrink-0" />
                                {link.selfDestructed ? 'Self-Destructed (Used)' : 'One-Time Link'}
                              </span>
                            )}
                            {link.password && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800/80 text-amber-300 font-medium flex items-center">
                                <Key className="h-2.5 w-2.5 mr-1" /> Password Protected
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md font-medium ${link.allowDownload
                              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                              }`}>
                              {link.allowDownload ? 'Read & Download' : 'View Only'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md font-medium flex items-center ${isExpired
                              ? 'bg-red-950 border border-red-850 text-red-300'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                              }`}>
                              <Calendar className="h-2.5 w-2.5 mr-1" />
                              {link.expiresAt
                                ? (isExpired ? 'Expired' : `Expires: ${new Date(link.expiresAt).toLocaleDateString()}`)
                                : 'Never Expires'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 p-5 border-t border-[#1e3059] bg-[#090f22] flex-shrink-0 rounded-b-xl">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          {activeTab !== 'links' ? (
            <button
              onClick={handleSave}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-glow-blue transition-all"
            >
              Save Access Changes
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-glow-blue transition-all"
            >
              Close Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
