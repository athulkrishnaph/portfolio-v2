import { Component, inject, signal } from '@angular/core';

import { ProfileService } from '../../../core/services/profile.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { SocialLinks } from '../../../shared/components/social-links/social-links';
import { Spinner } from '../../../shared/components/spinner/spinner';

/**
 * Contact details from the profile. Email opens the visitor's mail app
 * (mailto:), so no mail server is needed.
 */
@Component({
  selector: 'app-contact',
  imports: [Icon, SocialLinks, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      <header class="page-intro">
        <span class="eyebrow">// contact</span>
        <h1>Let's talk</h1>
        <p>
          Whether it's a job opportunity, a freelance project or a quick question — I'd love to hear
          from you.
        </p>
      </header>

      @if (profile.loading()) {
        <app-spinner label="Loading…" />
      } @else if (profile.error(); as error) {
        <app-error-state [error]="error" (retry)="profile.reload()" />
      } @else if (profile.data(); as p) {
        <div class="grid grid--2">
          @if (p.email) {
            <div class="card card--padded contact">
              <span class="contact__icon"><app-icon name="mail" [size]="22" /></span>
              <h2 class="contact__title">Email</h2>
              <p class="contact__value">{{ p.email }}</p>
              <div class="contact__actions">
                <a class="btn btn--primary" [href]="'mailto:' + p.email">Send an email</a>
                <button type="button" class="btn btn--secondary" (click)="copy(p.email)">
                  <app-icon [name]="copied() ? 'check' : 'copy'" [size]="16" />
                  {{ copied() ? 'Copied' : 'Copy address' }}
                </button>
              </div>
            </div>
          }
          <div class="card card--padded contact">
            <span class="contact__icon"><app-icon name="globe" [size]="22" /></span>
            <h2 class="contact__title">Elsewhere</h2>
            @if (p.location) {
              <p class="contact__value">
                <app-icon name="map-pin" [size]="16" /> Based in {{ p.location }}
              </p>
            }
            @if (p.socialLinks.length) {
              <app-social-links [links]="p.socialLinks" [showLabels]="true" />
            } @else {
              <p class="text-muted">No social profiles listed.</p>
            }
          </div>
        </div>
      } @else {
        <app-empty-state icon="mail" title="Contact details coming soon" />
      }
    </section>
  `,
  styles: `
    .contact {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .contact__icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .contact__title {
      margin: 0;
      font-size: var(--text-xl);
    }
    .contact__value {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--text-lg);
      overflow-wrap: anywhere;
    }
    .contact__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }
  `,
})
export class Contact {
  private readonly profileService = inject(ProfileService);
  private readonly notifications = inject(NotificationService);

  protected readonly profile = new Loader(() => this.profileService.get());
  protected readonly copied = signal(false);

  protected async copy(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.notifications.error('Could not copy. Please select the address and copy it manually.');
    }
  }
}
