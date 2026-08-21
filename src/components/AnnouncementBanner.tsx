'use client';

import React, { useState } from 'react';
import { Announcement, AnnouncementType } from '../lib/types';
import {
  Megaphone,
  AlertTriangle,
  Info,
  CheckCircle,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onOpenAdminDashboard?: (tab: 'announcements') => void;
  isAdmin?: boolean;
}

const typeStyles: Record<
  AnnouncementType,
  {
    bg: string;
    border: string;
    badge: string;
    text: string;
    icon: React.ReactNode;
    glow: string;
  }
> = {
  info: {
    bg: 'from-blue-950/80 via-[#071330]/90 to-indigo-950/80',
    border: 'border-blue-500/40 hover:border-blue-500/70',
    badge: 'bg-blue-900/80 text-blue-300 border-blue-600/60',
    text: 'text-blue-200',
    icon: <Megaphone className="h-4 w-4 text-blue-400" />,
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
  },
  warning: {
    bg: 'from-amber-950/80 via-[#1e1503]/90 to-yellow-950/80',
    border: 'border-amber-500/40 hover:border-amber-500/70',
    badge: 'bg-amber-900/80 text-amber-300 border-amber-600/60',
    text: 'text-amber-200',
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
  },
  alert: {
    bg: 'from-red-950/80 via-[#1f070e]/90 to-rose-950/80',
    border: 'border-rose-500/40 hover:border-rose-500/70',
    badge: 'bg-rose-900/80 text-rose-300 border-rose-600/60',
    text: 'text-rose-200',
    icon: <ShieldAlert className="h-4 w-4 text-rose-400" />,
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
  },
  success: {
    bg: 'from-emerald-950/80 via-[#031c14]/90 to-teal-950/80',
    border: 'border-emerald-500/40 hover:border-emerald-500/70',
    badge: 'bg-emerald-900/80 text-emerald-300 border-emerald-600/60',
    text: 'text-emerald-200',
    icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
  },
};

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcements,
  onOpenAdminDashboard,
  isAdmin = false,
}) => {
  const activeAnnouncements = announcements.filter((a) => a.isActive);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const visibleAnnouncements = activeAnnouncements.filter(
    (a) => !dismissedIds.includes(a.id)
  );

  if (visibleAnnouncements.length === 0) return null;

  const safeIndex = Math.min(currentIndex, visibleAnnouncements.length - 1);
  const currentAnnouncement = visibleAnnouncements[safeIndex] || visibleAnnouncements[0];

  if (!currentAnnouncement) return null;

  const style = typeStyles[currentAnnouncement.type] || typeStyles.info;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % visibleAnnouncements.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + visibleAnnouncements.length) % visibleAnnouncements.length);
  };

  const handleDismiss = () => {
    setDismissedIds((prev) => [...prev, currentAnnouncement.id]);
    if (safeIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="w-full transition-all duration-300">
      <div
        className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${style.bg} ${style.border} ${style.glow} p-4 backdrop-blur-md transition-all duration-300`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Main content section */}
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
              {style.icon}
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
                >
                  {currentAnnouncement.type}
                </span>

                <h3 className="text-sm font-bold text-white truncate tracking-tight">
                  {currentAnnouncement.title}
                </h3>

                {visibleAnnouncements.length > 1 && (
                  <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700">
                    {safeIndex + 1} of {visibleAnnouncements.length}
                  </span>
                )}
              </div>

              <p className={`text-xs ${style.text} leading-relaxed line-clamp-2 sm:line-clamp-none`}>
                {currentAnnouncement.content}
              </p>
            </div>
          </div>

          {/* Action buttons & navigation controls */}
          <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
            {currentAnnouncement.linkUrl && (
              <a
                href={currentAnnouncement.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20 transition-all shadow-sm"
              >
                <span>{currentAnnouncement.linkText || 'View Details'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {isAdmin && onOpenAdminDashboard && (
              <button
                onClick={() => onOpenAdminDashboard('announcements')}
                className="inline-flex items-center space-x-1 rounded-lg border border-blue-500/50 bg-blue-600/30 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-600/50 transition-all"
                title="Manage Announcements"
              >
                <Sparkles className="h-3 w-3 text-blue-400" />
                <span className="hidden md:inline">Manage</span>
              </button>
            )}

            {visibleAnnouncements.length > 1 && (
              <div className="flex items-center space-x-1 border-l border-white/10 pl-2">
                <button
                  onClick={handlePrev}
                  className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  title="Previous announcement"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  title="Next announcement"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleDismiss}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors ml-1"
              title="Dismiss announcement banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
