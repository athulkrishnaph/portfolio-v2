import { Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { loadGoogleIdentity } from '../../../core/auth/google-identity';
import { revealErrors } from '../../../core/utils/forms';
import { Button } from '../../../shared/components/button/button';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';

/** /admin/login. Redirects to ?returnUrl (or the dashboard) after signing in. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FormField, FormInput, Button, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  /** Query params, bound by the router (withComponentInputBinding). */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);

  /** Set when the server has Google sign-in enabled; shows the Google button. */
  protected readonly googleClientId = signal('');
  protected readonly googleBusy = signal(false);
  /** True once Google's (invisible) button is in place and clickable. */
  protected readonly googleReady = signal(false);
  private readonly googleButton = viewChild<ElementRef<HTMLElement>>('googleButton');

  constructor() {
    this.auth.options().subscribe({
      next: (o) => this.googleClientId.set(o.googleClientId),
      error: () => {
        /* options unavailable: the password login still works */
      },
    });

    // Render Google's button once its container exists.
    effect(() => {
      const clientId = this.googleClientId();
      const host = this.googleButton()?.nativeElement;
      if (!clientId || !host) {
        return;
      }
      loadGoogleIdentity()
        .then((google) => {
          google.initialize({
            client_id: clientId,
            callback: ({ credential }) => this.signInWithGoogle(credential),
            ux_mode: 'popup',
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          host.replaceChildren();
          // Invisible (see login.html); sized to cover our button. Google
          // allows 200–400px.
          google.renderButton(host, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: Math.max(200, Math.min(host.clientWidth || 340, 400)),
          });
          this.googleReady.set(true);
        })
        .catch(() => this.googleClientId.set(''));
    });
  }

  private signInWithGoogle(credential: string): void {
    this.googleBusy.set(true);
    this.error.set('');
    this.auth.loginWithGoogle(credential).subscribe({
      next: () => {
        this.googleBusy.set(false);
        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (err: unknown) => {
        this.googleBusy.set(false);
        this.error.set(ApiError.from(err).message);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(ApiError.from(err).message);
      },
    });
  }

  /** Only allow redirects inside the admin area (no open redirect to other sites). */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/admin') && !url.startsWith('/admin/login') ? url : '/admin/dashboard';
  }
}
