import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SocialLink } from '../../../core/models';
import { Icon, platformIcon } from '../icon/icon';

/** Row of icon links to the owner's profiles (GitHub, LinkedIn, ...). */
@Component({
  selector: 'app-social-links',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="social" [class.social--labels]="showLabels()">
      @for (link of links(); track link.platform) {
        <li>
          <a
            class="social__link"
            [href]="link.url"
            target="_blank"
            rel="noopener noreferrer"
            [attr.aria-label]="showLabels() ? null : link.platform"
            [title]="link.platform"
          >
            <app-icon [name]="iconFor(link.platform)" [size]="20" />
            @if (showLabels()) {
              <span>{{ link.platform }}</span>
            }
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    .social {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .social__link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      transition:
        color var(--transition-fast),
        background var(--transition-fast);
    }
    .social__link:hover {
      color: var(--color-primary);
      background: var(--color-surface-2);
      text-decoration: none;
    }
    .social--labels .social__link {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      font-size: var(--text-sm);
      font-weight: 500;
    }
  `,
})
export class SocialLinks {
  readonly links = input.required<SocialLink[]>();
  readonly showLabels = input(false);

  protected readonly iconFor = platformIcon;
}
