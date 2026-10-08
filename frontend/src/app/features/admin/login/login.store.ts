import { Injectable, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { revealErrors } from '../../../core/utils/forms';

/**
 * State and actions of the admin login page: the password form, Google
 * sign-in, errors and the redirect afterwards. Provided by Login, so it
 * lives as long as the page.
 */
@Injectable()
export class LoginStore {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly error = signal('');

  /** Set when the server has Google sign-in enabled; shows the Google button. */
  readonly googleClientId = signal('');
  readonly googleBusy = signal(false);

  constructor() {
    this.auth.options().subscribe({
      next: (o) => this.googleClientId.set(o.googleClientId),
      error: () => {
        /* options unavailable: the password login still works */
      },
    });
  }

  /** Email + password sign-in; then goes to returnUrl (or the dashboard). */
  submit(returnUrl: string | undefined): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(safeReturnUrl(returnUrl));
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(ApiError.from(err).message);
      },
    });
  }

  /** Sign-in with the ID token ("credential") from Google's button. */
  signInWithGoogle(credential: string, returnUrl: string | undefined): void {
    this.googleBusy.set(true);
    this.error.set('');
    this.auth.loginWithGoogle(credential).subscribe({
      next: () => {
        this.googleBusy.set(false);
        void this.router.navigateByUrl(safeReturnUrl(returnUrl));
      },
      error: (err: unknown) => {
        this.googleBusy.set(false);
        this.error.set(ApiError.from(err).message);
      },
    });
  }

  /** Google's script could not load: hide the Google option. */
  disableGoogle(): void {
    this.googleClientId.set('');
  }
}

/** Only allow redirects inside the admin area (no open redirect to other sites). */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/admin') && !url.startsWith('/admin/login') ? url : '/admin/dashboard';
}
