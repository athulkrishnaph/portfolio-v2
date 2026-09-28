import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { ProfileService } from '../services/profile.service';

/**
 * Builds the browser tab title from the route's `title` plus the owner's
 * name: "Projects · Alex Morgan". Pages with dynamic titles (a project page)
 * call setPageTitle themselves once their data has loaded.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly profile = inject(ProfileService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.setPageTitle(this.buildTitle(snapshot));
  }

  setPageTitle(page: string | undefined): void {
    const site = this.profile.siteName() || 'Portfolio';
    this.title.setTitle(page ? `${page} · ${site}` : site);
  }
}
