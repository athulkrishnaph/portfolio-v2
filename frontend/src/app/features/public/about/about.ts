import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProfileService } from '../../../core/services/profile.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { SocialLinks } from '../../../shared/components/social-links/social-links';
import { Spinner } from '../../../shared/components/spinner/spinner';

/** Full bio, photo and quick facts from the profile. */
@Component({
  selector: 'app-about',
  imports: [RouterLink, Icon, SocialLinks, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      @if (profile.loading()) {
        <app-spinner label="Loading…" />
      } @else if (profile.error(); as error) {
        <app-error-state [error]="error" (retry)="profile.reload()" />
      } @else if (profile.data(); as p) {
        <div class="about">
          <aside class="about__aside">
            @if (p.imageUrl) {
              <img class="about__photo" [src]="p.imageUrl" [alt]="'Photo of ' + p.fullName" />
            }
            <div class="card card--padded about__facts">
              <h2 class="about__facts-title">Quick facts</h2>
              <ul>
                @if (p.location) {
                  <li><app-icon name="map-pin" /> {{ p.location }}</li>
                }
                @if (p.email) {
                  <li><app-icon name="mail" /> <a [href]="'mailto:' + p.email">{{ p.email }}</a></li>
                }
                @if (p.resumeUrl) {
                  <li>
                    <app-icon name="download" />
                    <a [href]="p.resumeUrl" target="_blank" rel="noopener">Download resume</a>
                  </li>
                }
              </ul>
              @if (p.socialLinks.length) {
                <app-social-links [links]="p.socialLinks" />
              }
            </div>
          </aside>

          <div>
            <span class="eyebrow">// about me</span>
            <h1>{{ p.fullName }}</h1>
            @if (p.headline) {
              <p class="about__headline">{{ p.headline }}</p>
            }
            <p class="about__bio prose">{{ p.bio }}</p>
            <div class="about__actions">
              <a class="btn btn--primary" routerLink="/experience">My experience</a>
              <a class="btn btn--secondary" routerLink="/projects">See projects</a>
            </div>
          </div>
        </div>
      } @else {
        <app-empty-state icon="user" title="Profile coming soon" message="This section hasn't been filled in yet." />
      }
    </section>
  `,
  styles: `
    .about {
      display: grid;
      gap: var(--space-7);
    }
    @media (min-width: 1024px) {
      .about {
        grid-template-columns: 320px 1fr;
        align-items: start;
      }
    }
    .about__aside {
      display: grid;
      gap: var(--space-5);
    }
    .about__photo {
      width: 100%;
      max-width: 320px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
    }
    .about__facts-title {
      font-size: var(--text-lg);
    }
    .about__facts ul {
      display: grid;
      gap: var(--space-3);
      margin: 0 0 var(--space-4);
      padding: 0;
      list-style: none;
      font-size: var(--text-sm);
    }
    .about__facts li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      overflow-wrap: anywhere;
    }
    .about__headline {
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-primary);
    }
    .about__bio {
      font-size: var(--text-lg);
      color: var(--color-text-muted);
    }
    .about__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-5);
    }
  `,
})
export class About {
  private readonly profileService = inject(ProfileService);
  protected readonly profile = new Loader(() => this.profileService.get());
}
