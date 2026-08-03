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

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
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
