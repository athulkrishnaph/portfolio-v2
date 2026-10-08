import { Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { loadGoogleIdentity } from '../../../core/auth/google-identity';
import { Button } from '../../../shared/components/button/button';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { LoginStore } from './login.store';

/**
 * /admin/login. Sign-in logic lives in LoginStore; this class handles the
 * view: route params, the show-password toggle and placing Google's button.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FormField, FormInput, Button, Icon],
  providers: [LoginStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  /** Query params, bound by the router (withComponentInputBinding). */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly store = inject(LoginStore);
  protected readonly showPassword = signal(false);
  /** True once Google's (invisible) button is in place and clickable. */
  protected readonly googleReady = signal(false);
  private readonly googleButton = viewChild<ElementRef<HTMLElement>>('googleButton');

  constructor() {
    // Render Google's button once its container exists.
    effect(() => {
      const clientId = this.store.googleClientId();
      const host = this.googleButton()?.nativeElement;
      if (!clientId || !host) {
        return;
      }
      loadGoogleIdentity()
        .then((google) => {
          google.initialize({
            client_id: clientId,
            callback: ({ credential }) => this.store.signInWithGoogle(credential, this.returnUrl()),
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
        .catch(() => this.store.disableGoogle());
    });
  }
}
