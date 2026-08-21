import { VantorFile, VantorFolder, VantorRepository, AuditLog } from './types';
import { DEFAULT_REPOSITORY_ID } from './db';

/**
 * Parses an ISO date string or Date object into a valid Date object.
 * Returns null if the input is invalid or a non-standard relative string.
 */
export function parseDate(dateInput: string | Date | undefined | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'string') {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  return null;
}

/**
 * Formats an ISO date string or Date object into a user-friendly format:
 * - 'Today' if the date is today
 * - 'Yesterday' if the date is yesterday
 * - 'MM/DD/YYYY' for any other date
 * 
 * If the input is empty or invalid, returns the original input string.
 */
export function formatFriendlyDate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  const date = parseDate(dateInput);
  if (!date) {
    return String(dateInput);
  }

  const now = new Date();

  // Set time to midnight for simple date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (compareDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (compareDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
}

/**
 * Formats a timestamp into an accurate relative or formatted date/time string:
 * - "today at hh:mm AM/PM" if updated today
 * - "yesterday at hh:mm AM/PM" if updated yesterday
 * - "X days ago" if updated 2 to 6 days ago
 * - "MMM d, yyyy" if older
 */
export function formatRelativeTime(
  timestamp?: string | Date | null,
  fallbackCreatedAt?: string | Date | null
): string {
  let date = parseDate(timestamp);
  if (!date && fallbackCreatedAt) {
    date = parseDate(fallbackCreatedAt);
  }

  if (!date) {
    if (typeof timestamp === 'string' && timestamp.trim()) {
      return timestamp;
    }
    return 'Recently';
  }

  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfNow - startOfDate) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) {
    return `today at ${timeStr}`;
  } else if (dayDiff === 1) {
    return `yesterday at ${timeStr}`;
  } else if (dayDiff > 1 && dayDiff < 7) {
    return `${dayDiff} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Computes the actual most recent update ISO timestamp for a repository by taking
 * the maximum timestamp among:
 * - Repository updatedAt / createdAt
 * - All files belonging to repository (updatedAt / createdAt)
 * - All folders belonging to repository (updatedAt / createdAt)
 * - Audit logs for items in repository
 */
export function getRepositoryLastUpdated(
  repository: VantorRepository,
  files: VantorFile[],
  folders: VantorFolder[],
  auditLogs: AuditLog[]
): string {
  let latestTime = 0;
  let latestIsoString = repository.updatedAt || repository.createdAt || new Date().toISOString();

  const repoFiles = files.filter((f) => (f.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
  const repoFolders = folders.filter((f) => (f.repositoryId || DEFAULT_REPOSITORY_ID) === repository.id);
  const itemNames = new Set([
    ...repoFiles.map((f) => f.name),
    ...repoFolders.map((f) => f.name),
  ]);

  const candidates: (string | undefined)[] = [
    repository.updatedAt,
    repository.createdAt,
    ...repoFiles.map((f) => f.updatedAt),
    ...repoFiles.map((f) => f.createdAt),
    ...repoFolders.map((f) => f.updatedAt),
    ...repoFolders.map((f) => f.createdAt),
    ...auditLogs.filter((log) => itemNames.has(log.targetName)).map((log) => log.timestamp),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseDate(candidate);
    if (parsed) {
      const time = parsed.getTime();
      if (time > latestTime) {
        latestTime = time;
        latestIsoString = parsed.toISOString();
      }
    }
  }

  return latestIsoString;
}

/**
 * Checks whether an item's updated/created date matches the selected modified filter ('ALL', 'today', 'yesterday', 'last week').
 */
export function matchesModifiedFilter(
  updatedAt?: string,
  createdAt?: string,
  filter?: string
): boolean {
  if (!filter || filter === 'ALL') return true;

  const date = parseDate(updatedAt) || parseDate(createdAt);
  if (!date) {
    if (filter === 'today' && updatedAt?.toLowerCase().includes('today')) return true;
    if (filter === 'yesterday' && updatedAt?.toLowerCase().includes('yesterday')) return true;
    return false;
  }

  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfNow - startOfDate) / (1000 * 60 * 60 * 24));

  if (filter === 'today') {
    return dayDiff === 0;
  }
  if (filter === 'yesterday') {
    return dayDiff === 1;
  }
  if (filter === 'last week') {
    return dayDiff >= 0 && dayDiff <= 7;
  }

  return true;
}

/**
 * Formats a byte number into a human-readable size string.
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0.0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // If the computed index is beyond sizes length, bound it
  const index = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
}

