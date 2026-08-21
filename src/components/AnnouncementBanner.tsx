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
  ExternalLink
} from 'lucide-react';

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onOpenAdminDashboard?: (tab: 'announcements') => void;
  isAdmin?: boolean;
}

const typeStyles: Record<
  AnnouncementType,
  {
    badge: string;
    text: string;
    icon: React.ReactNode;
  }
> = {
  info: {
    badge: 'bg-blue-950/90 text-blue-300 border-blue-700/80',
    text: 'text-slate-200',
    icon: <Megaphone className="h-3.5 w-3.5 text-blue-400" />,
  },
  warning: {
    badge: 'bg-amber-950/90 text-amber-300 border-amber-700/80',
    text: 'text-slate-200',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  },
  alert: {
    badge: 'bg-rose-950/90 text-rose-300 border-rose-700/80',
    text: 'text-slate-200',
    icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />,
  },
  success: {
    badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80',
    text: 'text-slate-200',
    icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
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
    <div className="w-full">
      <div className="relative overflow-hidden rounded-lg border border-[#1e3059] bg-[#070c18] px-3.5 py-2.5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          {/* Content section */}
          <div className="flex items-center space-x-2.5 flex-1 min-w-0">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900/90">
              {style.icon}
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1 text-xs">
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide font-mono ${style.badge}`}>
                {currentAnnouncement.type}
              </span>

              <div className="flex items-center space-x-1.5 min-w-0 flex-wrap">
                <span className="font-bold text-white tracking-tight">
                  {currentAnnouncement.title}:
                </span>
                <span className="text-slate-300 font-normal">
                  {currentAnnouncement.content}
                </span>
              </div>

              {visibleAnnouncements.length > 1 && (
                <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {safeIndex + 1}/{visibleAnnouncements.length}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
            {currentAnnouncement.linkUrl && (
              <a
                href={currentAnnouncement.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 rounded-md border border-blue-500/60 bg-blue-600/20 px-2.5 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-600/30 transition-all"
              >
                <span>{currentAnnouncement.linkText || 'Details'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {visibleAnnouncements.length > 1 && (
              <div className="flex items-center space-x-0.5 border-l border-slate-800 pl-1.5">
                <button
                  onClick={handlePrev}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Previous"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Next"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleDismiss}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Dismiss announcement"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
