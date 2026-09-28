import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorBody } from '../models';

/**
 * The single error type the rest of the app deals with. The error
 * interceptor converts every failed HTTP call into an ApiError, so
 * components never have to inspect HttpErrorResponse themselves.
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the server could not be reached. */
    readonly status: number,
    /** Machine-readable code from the API, e.g. PROJECT_NOT_FOUND. */
    readonly code: string,
    message: string,
    /** Per-field validation messages (only for VALIDATION_FAILED). */
    readonly details: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  /** Converts anything thrown by HttpClient (or elsewhere) into an ApiError. */
  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      const body = (error.error as { error?: ApiErrorBody } | null)?.error;
      if (body && typeof body.code === 'string') {
        return new ApiError(error.status, body.code, body.message, body.details ?? {});
      }
      if (error.status === 0) {
        return new ApiError(
          0,
          'NETWORK_ERROR',
          'Cannot reach the server. Check your connection and try again.',
        );
      }
      return new ApiError(error.status, 'HTTP_ERROR', `The request failed (HTTP ${error.status}).`);
    }
    return new ApiError(0, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
}
