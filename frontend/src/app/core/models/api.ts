/** Every successful API response is wrapped as { "data": ... }. */
export interface ApiResponse<T> {
  data: T;
}

/** Body of every error response: { "error": { code, message, details? } }. */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Per-field messages for VALIDATION_FAILED, e.g. { title: 'Title is required' }. */
  details?: Record<string, string>;
}

/**
 * Dates are exchanged as 'YYYY-MM-DD' strings (never Date objects), which is
 * exactly what <input type="date"> reads and writes.
 */
export type IsoDate = string;
