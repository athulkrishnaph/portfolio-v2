import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
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
