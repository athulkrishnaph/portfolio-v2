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
  template: `
    <main class="login">
      <div class="card login__card">
        <a class="login__brand" routerLink="/"><span aria-hidden="true">&lt;/&gt;</span> Portfolio admin</a>
        <h1 class="login__title">Sign in</h1>
        <p class="text-muted">Manage your portfolio content.</p>

        @if (reason() === 'expired' && !error()) {
          <div class="alert alert--info" role="status">
            <app-icon name="info" /> Your session has expired. Please sign in again.
          </div>
        }
        @if (error()) {
          <div class="alert alert--danger" role="alert"><app-icon name="info" /> {{ error() }}</div>
        }

        <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-form-field label="Email">
            <input appInput class="input" type="email" formControlName="email" autocomplete="username" />
          </app-form-field>
          <app-form-field label="Password">
            <div class="password">
              <input
                appInput
                class="input"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="btn btn--ghost btn--sm password__toggle"
                [attr.aria-pressed]="showPassword()"
                (click)="showPassword.set(!showPassword())"
              >
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </app-form-field>
          <button appButton type="submit" variant="primary" size="lg" [loading]="submitting()">Sign in</button>
        </form>

        <a class="login__back" routerLink="/"><app-icon name="arrow-left" [size]="14" /> Back to the site</a>
      </div>
    </main>
  `,
  styles: `
    .login {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: var(--space-4);
      background: radial-gradient(circle at 20% 10%, var(--color-primary-soft), transparent 50%), var(--color-bg);
    }
    .login__card {
      display: grid;
      gap: var(--space-4);
      width: min(420px, 100%);
      padding: var(--space-6);
    }
    .login__brand {
      font-weight: 700;
      color: var(--color-text);
    }
    .login__brand span {
      font-family: var(--font-mono);
      color: var(--color-primary);
    }
    .login__title {
      margin: 0;
      font-size: var(--text-3xl);
    }
    .login__card p {
      margin: 0;
    }
    .password {
      position: relative;
    }
    .password .input {
      padding-right: 72px;
    }
    .password__toggle {
      position: absolute;
      top: 4px;
      right: 4px;
    }
    .login__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
    }
  `,
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
