import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Protects admin routes. Logged-out visitors are redirected to the login
 * page, which sends them back to the page they wanted afterwards.
 *
 * This is a UX feature only: the real protection is the Go API, which
 * rejects every admin write without a valid token.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Keeps logged-in admins away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/admin/dashboard']) : true;
};
