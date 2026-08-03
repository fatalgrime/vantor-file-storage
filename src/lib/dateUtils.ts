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
