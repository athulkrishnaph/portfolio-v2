import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { ThemePicker } from '../../shared/components/theme-picker/theme-picker';
import { Icon } from '../../shared/components/icon/icon';

interface NavLink {
  label: string;
  path: string;
}

/** Top navigation for the public site, with a collapsible mobile menu. */
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, Icon, ThemePicker],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  /** The brand shows the owner's name; errors just fall back to "Portfolio". */
  protected readonly profile = toSignal(
    inject(ProfileService)
      .get()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  // Site structure (not portfolio content), so it is fine to define here.
  protected readonly links: NavLink[] = [
    { label: 'About', path: '/about' },
    { label: 'Skills', path: '/skills' },
    { label: 'Projects', path: '/projects' },
    { label: 'Experience', path: '/experience' },
    { label: 'Education', path: '/education' },
    { label: 'Certificates', path: '/certificates' },
    { label: 'Contact', path: '/contact' },
  ];

  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
