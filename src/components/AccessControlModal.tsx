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
  Download
} from 'lucide-react';
import { VantorFile, VantorFolder, PermissionLevel, UserRole, VantorUser, Collaborator, ShareLink } from '../lib/types';
import { ALL_USER_ROLES } from '../lib/authorization';

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
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expirationType, setExpirationType] = useState<'never' | '1h' | '1d' | '7d' | '30d' | 'custom'>('never');
  const [customExpirationDate, setCustomExpirationDate] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

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
    onClose();
  };

  // Share Links Handlers
  const handleCreateShareLink = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate unique random share link ID
    const shareId = 'share-' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
    
    let expiresAt: string | undefined = undefined;
    const now = Date.now();
    if (expirationType === '1h') expiresAt = new Date(now + 60*60*1000).toISOString();
    else if (expirationType === '1d') expiresAt = new Date(now + 24*60*60*1000).toISOString();
    else if (expirationType === '7d') expiresAt = new Date(now + 7*24*60*60*1000).toISOString();
    else if (expirationType === '30d') expiresAt = new Date(now + 30*24*60*60*1000).toISOString();
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
      password: usePassword && password ? password : undefined,
      expiresAt,
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
      viewsCount: 0,
      downloadsCount: 0,
    };

    onSaveShares([...shares, newLink]);
    
    // Reset Form
    setLinkLabel('');
    setAllowDownload(true);
    setUsePassword(false);
    setPassword('');
    setExpirationType('never');
    setCustomExpirationDate('');
  };

  const handleRevokeShareLink = (linkId: string) => {
    onSaveShares(shares.filter(s => s.id !== linkId));
  };

  const handleCopyShareLink = (linkId: string) => {
    const url = `${window.location.origin}/share/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const inviteableUsers = users.filter(
    (u) => u.id !== currentUserId && !collaborators.some((c) => c.userId === u.id)
  );

  const activeShares = shares.filter(s => s.itemId === item.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22] flex-shrink-0">
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
            className={`px-5 py-3 border-b-2 transition-all ${
              activeTab === 'policy'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            General Policy
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`px-5 py-3 border-b-2 transition-all ${
              activeTab === 'share'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Collaborators
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`px-5 py-3 border-b-2 transition-all ${
              activeTab === 'links'
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
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      permissionLevel === 'public'
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
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      permissionLevel === 'authenticated'
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
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      permissionLevel === 'role_restricted'
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
                    onClick={() => setPermissionLevel('admin_only')}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      permissionLevel === 'admin_only'
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
                          className={`flex items-center space-x-2 rounded-lg border p-2 text-xs font-mono transition-colors ${
                            isChecked
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
                <div className="flex gap-2">
                  <select
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    className="flex-grow rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="">Choose a user...</option>
                    {inviteableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>

                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}
                    className="w-24 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>

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
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            c.role === 'editor'
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
            <div className="space-y-5">
              {/* Generate New Link Form */}
              <form onSubmit={handleCreateShareLink} className="bg-slate-900/60 p-4 border border-slate-800/80 rounded-xl space-y-3">
                <h4 className="font-bold text-white text-xs flex items-center space-x-1.5">
                  <LinkIcon className="h-4 w-4 text-blue-400" />
                  <span>Generate Secure Share Link</span>
                </h4>
                
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">Link Name / Label</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Client Review, Public Access"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Expiration selection */}
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400">Access Expiration</label>
                    <select
                      value={expirationType}
                      onChange={(e) => setExpirationType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-850 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    >
                      <option value="never">Never Expires</option>
                      <option value="1h">1 Hour</option>
                      <option value="1d">1 Day</option>
                      <option value="7d">7 Days</option>
                      <option value="30d">30 Days</option>
                      <option value="custom">Custom Date</option>
                    </select>
                  </div>

                  {/* Permissions Selection */}
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400">Recipient Permissions</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowDownload}
                          onChange={(e) => setAllowDownload(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[11px] text-slate-300">Allow Downloads</span>
                      </label>
                    </div>
                  </div>
                </div>

                {expirationType === 'custom' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400">Custom Expiration Date/Time</label>
                    <input 
                      type="datetime-local"
                      required
                      value={customExpirationDate}
                      onChange={(e) => setCustomExpirationDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-850 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Password Protection */}
                <div className="space-y-2 pt-1 border-t border-slate-850/60">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={usePassword}
                      onChange={(e) => setUsePassword(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-300">Require Access Password</span>
                  </label>
                  {usePassword && (
                    <div className="relative">
                      <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                      <input 
                        type="password"
                        required
                        placeholder="Enter secure link password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-850 bg-slate-950 pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 py-2 text-xs font-semibold text-white transition-all shadow-glow-blue"
                >
                  <Plus className="h-4 w-4" />
                  <span>Generate Link</span>
                </button>
              </form>

              {/* Active Links List */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Active Generated Links ({activeShares.length})</label>
                {activeShares.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-slate-500">
                    No public share links generated yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeShares.map((link) => {
                      const isExpired = link.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
                      return (
                        <div key={link.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-white text-xs">{link.label}</span>
                              <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-400">
                                <span className="flex items-center"><Eye className="h-3 w-3 mr-0.5 text-blue-400" /> {link.viewsCount} views</span>
                                {link.allowDownload && (
                                  <span className="flex items-center"><Download className="h-3 w-3 mr-0.5 text-emerald-400" /> {link.downloadsCount} dl</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleCopyShareLink(link.id)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"
                                title="Copy Link"
                              >
                                {copiedLinkId === link.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => handleRevokeShareLink(link.id)}
                                className="p-1.5 hover:bg-red-950/60 rounded text-slate-400 hover:text-red-400 transition-colors"
                                title="Revoke Link"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {link.password && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 flex items-center">
                                <Key className="h-2.5 w-2.5 mr-0.5" /> Password
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded ${
                              link.allowDownload 
                                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300' 
                                : 'bg-slate-900 border border-slate-800 text-slate-400'
                            }`}>
                              {link.allowDownload ? 'Read & Download' : 'View Only'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded flex items-center ${
                              isExpired 
                                ? 'bg-red-950 border border-red-850 text-red-300' 
                                : link.expiresAt 
                                  ? 'bg-blue-950/80 border border-blue-900 text-blue-300' 
                                  : 'bg-slate-900 border border-slate-800 text-slate-400'
                            }`}>
                              <Calendar className="h-2.5 w-2.5 mr-0.5" />
                              {isExpired ? 'Expired' : link.expiresAt ? `Expires: ${new Date(link.expiresAt).toLocaleDateString()}` : 'Never Expires'}
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
        <div className="flex items-center justify-end space-x-3 p-5 border-t border-[#1e3059] bg-[#090f22] flex-shrink-0">
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
