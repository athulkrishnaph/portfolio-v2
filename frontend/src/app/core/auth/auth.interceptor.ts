import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../api/api-error';
import { AuthService } from './auth.service';

/**
 * Adds "Authorization: Bearer <token>" to requests for our own API.
 *
 * The token is only attached to relative '/api/' URLs, so it can never leak
 * to another website. If the API answers 401 to an authenticated request,
 * the session is over: the admin is sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isOwnApi = req.url.startsWith('/api/');

  if (!token || !isOwnApi) {
    return next(req);
  }

  const authorized = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        auth.expireSession();
      }
      return throwError(() => error);
    }),
  );
};
