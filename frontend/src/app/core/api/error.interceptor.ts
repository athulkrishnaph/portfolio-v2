import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError } from './api-error';

/**
 * Converts every HTTP failure into an ApiError with a user-friendly message,
 * so the rest of the app has a single error type to handle.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
