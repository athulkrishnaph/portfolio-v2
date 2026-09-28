import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon, IconName } from '../../shared/components/icon/icon';

interface AdminNavLink {
  label: string;
  path: string;
  icon: IconName;
}

/**
 * Admin navigation.
 * - Desktop: fixed column that can be collapsed to a narrow icon rail.
 * - Mobile: off-canvas drawer with a close button.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  /** Whether the mobile drawer is open (ignored on desktop). */
  readonly open = input(false);
  /** Desktop only: show icons without labels. */
  readonly collapsed = input(false);

  /** Emitted when a link is clicked so the parent can close the drawer. */
  readonly navigate = output<void>();
  /** Desktop collapse/expand button. */
  readonly toggleCollapsed = output<void>();
  /** Mobile close button. */
  readonly closeDrawer = output<void>();

  protected readonly links: AdminNavLink[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Profile', path: '/admin/profile', icon: 'user' },
    { label: 'Projects', path: '/admin/projects', icon: 'folder' },
    { label: 'Experience', path: '/admin/experience', icon: 'briefcase' },
    { label: 'Education', path: '/admin/education', icon: 'graduation' },
    { label: 'Certificates', path: '/admin/certificates', icon: 'award' },
    { label: 'Skills', path: '/admin/skills', icon: 'zap' },
  ];
}
