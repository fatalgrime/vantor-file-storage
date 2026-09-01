'use client';

import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Send,
  CornerDownRight,
  CheckCircle,
  Trash2,
  AtSign,
  Sparkles
} from 'lucide-react';
import { FileComment, VantorUser, UserRole } from '../lib/types';
import { formatRelativeTime } from '../lib/dateUtils';

interface FileCommentsSectionProps {
  fileId: string;
  comments: FileComment[];
  users: VantorUser[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole?: UserRole;
  onAddComment: (fileId: string, content: string, parentId?: string | null, mentions?: string[]) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

// Custom Markdown + @Mention Renderer
const MarkdownText: React.FC<{ text: string; users: VantorUser[] }> = ({ text, users }) => {
  const userNames = users.map(u => u.name).filter(Boolean);

  const renderFormattedLines = (str: string) => {
    const lines = str.split('\n');
    return lines.map((line, lIdx) => {
      const tokens: React.ReactNode[] = [];
      let lastIndex = 0;

      const regex = /(@[A-Za-z0-9_\s\.\-]+?)(?=[,\s\?\!]|$)|\*\*([^\*]+)\*\*|`([^`]+)`|\*([^\*]+)\*/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          tokens.push(line.substring(lastIndex, match.index));
        }

        const [fullMatch, mentionMatch, boldMatch, codeMatch, italicMatch] = match;

        if (mentionMatch) {
          const cleanName = mentionMatch.substring(1).trim();
          const isUserFound = userNames.some(u => u.toLowerCase() === cleanName.toLowerCase());
          tokens.push(
            <span
              key={`mention-${lIdx}-${match.index}`}
              className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-bold ${isUserFound
                ? 'bg-indigo-950/90 border border-indigo-700/80 text-indigo-300 shadow-sm'
                : 'bg-blue-950/60 border border-blue-800 text-blue-300'
                }`}
            >
              <AtSign className="h-3 w-3 mr-0.5 text-indigo-400" />
              {cleanName}
            </span>
          );
        } else if (boldMatch) {
          tokens.push(
            <strong key={`bold-${lIdx}-${match.index}`} className="font-bold text-white">
              {boldMatch}
            </strong>
          );
        } else if (codeMatch) {
          tokens.push(
            <code
              key={`code-${lIdx}-${match.index}`}
              className="bg-slate-900 border border-slate-800 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-[11px]"
            >
              {codeMatch}
            </code>
          );
        } else if (italicMatch) {
          tokens.push(
            <em key={`italic-${lIdx}-${match.index}`} className="italic text-slate-200">
              {italicMatch}
            </em>
          );
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < line.length) {
        tokens.push(line.substring(lastIndex));
      }

      return (
        <div key={lIdx} className={lIdx > 0 ? 'mt-1' : ''}>
          {tokens.length > 0 ? tokens : line}
        </div>
      );
    });
  };

  return <div className="text-xs text-slate-300 leading-relaxed font-sans">{renderFormattedLines(text)}</div>;
};

export const FileCommentsSection: React.FC<FileCommentsSectionProps> = ({
  fileId,
  comments,
  users,
  currentUserId,
  currentUserName,
  currentUserRole = 'admin',
  onAddComment,
  onResolveComment,
  onDeleteComment,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // @Mention popup state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [activeInputType, setActiveInputType] = useState<'main' | 'reply'>('main');

  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Filter comments for this file
  const fileComments = comments.filter((c) => c.fileId === fileId);
  const rootComments = fileComments.filter((c) => !c.parentId);

  // Filter users for @mention suggestion popup
  const filteredMentionUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    u.email.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Detect @ character in input to trigger mention popup
  const handleInputChange = (
    val: string,
    setText: React.Dispatch<React.SetStateAction<string>>,
    inputType: 'main' | 'reply'
  ) => {
    setText(val);
    setActiveInputType(inputType);

    const lastAtIndex = val.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const charAfterAt = val.substring(lastAtIndex + 1);
      if (!charAfterAt.includes(' ')) {
        setShowMentionPopup(true);
        setMentionFilter(charAfterAt);
        return;
      }
    }
    setShowMentionPopup(false);
  };

  const handleSelectMentionUser = (user: VantorUser) => {
    const isMain = activeInputType === 'main';
    const currentVal = isMain ? newCommentText : replyText;
    const setText = isMain ? setNewCommentText : setReplyText;

    const lastAtIndex = currentVal.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const prefix = currentVal.substring(0, lastAtIndex);
      const updated = `${prefix}@${user.name} `;
      setText(updated);
    } else {
      setText(currentVal + `@${user.name} `);
    }
    setShowMentionPopup(false);

    setTimeout(() => {
      if (isMain) mainInputRef.current?.focus();
      else replyInputRef.current?.focus();
    }, 50);
  };

  const handleSubmitMainComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const mentions = users
      .filter((u) => newCommentText.toLowerCase().includes(`@${u.name.toLowerCase()}`))
      .map((u) => u.id);

    onAddComment(fileId, newCommentText.trim(), null, mentions);
    setNewCommentText('');
    setShowMentionPopup(false);
  };

  const handleSubmitReply = (parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const mentions = users
      .filter((u) => replyText.toLowerCase().includes(`@${u.name.toLowerCase()}`))
      .map((u) => u.id);

    onAddComment(fileId, replyText.trim(), parentId, mentions);
    setReplyText('');
    setReplyingToId(null);
    setShowMentionPopup(false);
  };

  return (
    <div className="space-y-6 select-none pointer-events-auto">
      {/* Header info */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4 text-blue-400" />
          <h4 className="font-bold text-white text-xs uppercase tracking-wide">
            Discussion & Feedback ({fileComments.length})
          </h4>
        </div>
        <span className="text-[11px] text-slate-400 font-mono flex items-center">
          <Sparkles className="h-3 w-3 mr-1 text-amber-400" /> Supports Markdown & @mentions
        </span>
      </div>

      {/* Main Comment Input Form */}
      <div className="relative">
        <form onSubmit={handleSubmitMainComment} className="space-y-2">
          <div className="relative">
            <textarea
              ref={mainInputRef}
              rows={3}
              placeholder="Write a comment or thread... Use @Name to mention colleagues or **bold** for markdown."
              value={newCommentText}
              onChange={(e) => handleInputChange(e.target.value, setNewCommentText, 'main')}
              className="w-full rounded-xl border border-slate-800 bg-[#060a17] p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all resize-none"
            />

            {/* Mention suggestion popup */}
            {showMentionPopup && activeInputType === 'main' && filteredMentionUsers.length > 0 && (
              <div className="absolute left-3 bottom-12 z-30 w-64 rounded-xl border border-indigo-800 bg-[#0a1024] p-2 shadow-2xl space-y-1">
                <div className="text-[10px] font-bold text-indigo-400 px-2 py-1 uppercase tracking-wider flex items-center">
                  <AtSign className="h-3 w-3 mr-1" /> Mention Workspace User
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {filteredMentionUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectMentionUser(u)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-indigo-950/80 text-xs text-white transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-200 block">{u.name}</span>
                        <span className="text-[10px] text-slate-400 block">{u.email}</span>
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span>Formatting:</span>
              <code className="bg-slate-900 border border-slate-800 px-1 text-[10px] rounded text-slate-300">**bold**</code>
              <code className="bg-slate-900 border border-slate-800 px-1 text-[10px] rounded text-slate-300">`code`</code>
              <code className="bg-slate-900 border border-slate-800 px-1 text-[10px] rounded text-indigo-300">@mention</code>
            </div>

            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white transition-all shadow-glow-blue"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Post Comment</span>
            </button>
          </div>
        </form>
      </div>

      {/* Comments List */}
      <div className="space-y-4 pt-2">
        {rootComments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-850 bg-slate-950/20 p-8 text-center text-xs text-slate-400">
            No comments yet on this file. Start the conversation above!
          </div>
        ) : (
          rootComments.map((comment) => {
            const replies = fileComments.filter((r) => r.parentId === comment.id);
            const canManage = comment.authorId === currentUserId || currentUserRole === 'admin';

            return (
              <div
                key={comment.id}
                className={`p-4 rounded-xl border transition-all ${comment.resolved
                  ? 'bg-slate-950/30 border-slate-850 opacity-75'
                  : 'bg-[#090f22]/90 border-slate-800 shadow-md'
                  }`}
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold text-xs">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-white">{comment.authorName}</span>
                        {comment.authorRole && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                            {comment.authorRole}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Resolve button */}
                    <button
                      onClick={() => onResolveComment(comment.id)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors border ${comment.resolved
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      title={comment.resolved ? 'Reopen discussion thread' : 'Mark thread as resolved'}
                    >
                      <CheckCircle className="h-3 w-3" />
                      <span>{comment.resolved ? 'Resolved' : 'Resolve'}</span>
                    </button>

                    {/* Delete button */}
                    {canManage && (
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Body */}
                <div className="mt-3 pl-9">
                  <MarkdownText text={comment.content} users={users} />

                  {/* Reply button trigger */}
                  <div className="mt-2.5 flex items-center space-x-3">
                    <button
                      onClick={() => {
                        if (replyingToId === comment.id) {
                          setReplyingToId(null);
                        } else {
                          setReplyingToId(comment.id);
                          setReplyText('');
                        }
                      }}
                      className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                    >
                      <CornerDownRight className="h-3 w-3" />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>

                {/* Nested Replies */}
                {replies.length > 0 && (
                  <div className="mt-3 ml-9 pt-3 border-t border-slate-850 space-y-3">
                    {replies.map((reply) => {
                      const canDeleteReply = reply.authorId === currentUserId || currentUserRole === 'admin';
                      return (
                        <div key={reply.id} className="bg-[#060a17] p-3 rounded-lg border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {reply.authorName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-[11px] text-slate-200">{reply.authorName}</span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>

                            {canDeleteReply && (
                              <button
                                onClick={() => onDeleteComment(reply.id)}
                                className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="pl-7">
                            <MarkdownText text={reply.content} users={users} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply Composer Box */}
                {replyingToId === comment.id && (
                  <form
                    onSubmit={(e) => handleSubmitReply(comment.id, e)}
                    className="mt-3 ml-9 p-3 bg-[#060a17] border border-blue-900/60 rounded-xl space-y-2"
                  >
                    <div className="relative">
                      <textarea
                        ref={replyInputRef}
                        rows={2}
                        placeholder={`Reply to ${comment.authorName}... Use @Name to tag.`}
                        value={replyText}
                        onChange={(e) => handleInputChange(e.target.value, setReplyText, 'reply')}
                        className="w-full rounded-lg border border-slate-800 bg-[#090f22] p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all resize-none"
                      />

                      {/* Reply mention popup */}
                      {showMentionPopup && activeInputType === 'reply' && filteredMentionUsers.length > 0 && (
                        <div className="absolute left-2 bottom-10 z-30 w-60 rounded-xl border border-indigo-800 bg-[#0a1024] p-2 shadow-2xl space-y-1">
                          <div className="text-[10px] font-bold text-indigo-400 px-2 py-1 uppercase tracking-wider flex items-center">
                            <AtSign className="h-3 w-3 mr-1" /> Mention User
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {filteredMentionUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleSelectMentionUser(u)}
                                className="w-full flex items-center justify-between px-2 py-1 rounded text-left hover:bg-indigo-950/80 text-xs text-white transition-colors"
                              >
                                <span className="font-bold text-slate-200">{u.name}</span>
                                <span className="text-[9px] text-slate-400">{u.email}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setReplyingToId(null)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="px-3.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all"
                      >
                        Post Reply
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
