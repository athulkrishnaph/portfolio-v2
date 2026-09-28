import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/components/icon/icon';
import { ThemePicker } from '../../shared/components/theme-picker/theme-picker';
import { Sidebar } from '../sidebar/sidebar';

const COLLAPSED_KEY = 'portfolio.sidebarCollapsed';

/** Shell for every authenticated admin page: sidebar, top bar, content. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, Sidebar, Icon, ThemePicker],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);

  /** Mobile: whether the drawer is open. */
  protected readonly sidebarOpen = signal(false);
  /** Desktop: whether the sidebar is collapsed to icons (remembered between visits). */
  protected readonly sidebarCollapsed = signal(readCollapsed());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(this.sidebarCollapsed()));
      } catch {
        /* storage unavailable */
      }
    });
  }

  protected toggleCollapsed(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}
