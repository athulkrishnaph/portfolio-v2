import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/ui/theme.service';
import { ConfirmDialog } from './shared/components/confirm-dialog/confirm-dialog';
import { Toasts } from './shared/components/toasts/toasts';

/**
 * Root component: hosts the router plus the app-wide toast area and
 * confirmation dialog. Layouts are chosen per route.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, ConfirmDialog],
  template: `
    <router-outlet />
    <app-toasts />
    <app-confirm-dialog />
  `,
})
export class App {
  // Injected here so the saved light/dark choice is applied on startup.
  private readonly theme = inject(ThemeService);
}
