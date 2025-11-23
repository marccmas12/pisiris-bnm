/**
 * Status Transition Rules
 * Defines valid status transitions for tickets
 */

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  'created': ['reviewed', 'notified', 'deleted'],
  'reviewed': ['notified', 'closed', 'solved', 'deleted'],
  'deleted': ['reopened'],
  'notified': ['resolving', 'deleted'],
  'resolving': ['on_hold', 'closed', 'solved', 'deleted'],
  'on_hold': ['resolving', 'closed', 'solved', 'deleted'],
  'closed': ['reopened', 'deleted'],
  'solved': ['reopened', 'deleted'],
  'reopened': ['notified', 'closed', 'solved', 'deleted']
};

/**
 * Get valid next statuses for a given current status
 * @param currentStatusValue - The current status value (e.g., 'created', 'reviewed')
 * @returns Array of valid next status values
 */
export function getValidNextStatuses(currentStatusValue: string): string[] {
  if (!currentStatusValue) return [];
  const normalizedStatus = currentStatusValue.toLowerCase();
  return STATUS_TRANSITIONS[normalizedStatus] || [];
}

/**
 * Check if a status transition is valid
 * @param from - The current status value
 * @param to - The target status value
 * @returns True if the transition is valid, false otherwise
 */
export function isValidTransition(from: string, to: string): boolean {
  if (!from || !to) return false;
  const validNextStatuses = getValidNextStatuses(from);
  return validNextStatuses.includes(to.toLowerCase());
}

