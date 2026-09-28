import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { SocialLinks } from '../../shared/components/social-links/social-links';

/** Public site footer with the owner's name and social links (from the profile API). */
@Component({
  selector: 'app-footer',
  imports: [SocialLinks, RouterLink],
  template: `
    <footer class="footer">
      <div class="container footer__inner">
        <p class="footer__copy">
          &copy; {{ year }} {{ profile()?.fullName }} &middot;
          <a routerLink="/contact">Get in touch</a>
        </p>
        @if (profile()?.socialLinks?.length) {
          <app-social-links [links]="profile()!.socialLinks" />
        }
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: auto;
      border-top: 1px solid var(--color-border);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .footer__inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding-block: var(--space-5);
    }
    .footer p {
      margin: 0;
    }
  `,
})
export class Footer {
  protected readonly year = new Date().getFullYear();
  protected readonly profile = toSignal(
    inject(ProfileService)
      .get()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );
}
