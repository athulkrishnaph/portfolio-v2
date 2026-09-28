import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Certificate } from '../../../core/models';
import { MonthYearPipe } from '../../pipes/date-range.pipe';
import { Icon } from '../icon/icon';

/** Card for one certificate: optional image, title, issuer, date, credential link. */
@Component({
  selector: 'app-certificate-card',
  imports: [Icon, MonthYearPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = certificate();
    <article class="card card--padded cert">
      @if (c.imageUrl) {
        <img class="cert__image" [src]="c.imageUrl" [alt]="'Certificate: ' + c.title" loading="lazy" />
      } @else {
        <span class="cert__icon"><app-icon name="award" [size]="24" /></span>
      }
      <div class="cert__body">
        <h3 class="cert__title">{{ c.title }}</h3>
        <p class="cert__issuer">{{ c.issuer }}</p>
        <p class="cert__date">
          <app-icon name="calendar" [size]="14" />
          <time [attr.datetime]="c.issueDate">Issued {{ c.issueDate | monthYear }}</time>
        </p>
        @if (c.credentialUrl) {
          <a class="cert__link" [href]="c.credentialUrl" target="_blank" rel="noopener noreferrer">
            View credential <app-icon name="external" [size]="14" />
          </a>
        }
      </div>
    </article>
  `,
  styles: `
    .cert {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      height: 100%;
    }
    .cert__image {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
    }
    .cert__icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .cert__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-1);
    }
    .cert__title {
      margin: 0;
      font-size: var(--text-lg);
    }
    .cert__issuer {
      margin: 0;
      font-weight: 500;
      color: var(--color-text-muted);
    }
    .cert__date {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .cert__link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      margin-top: auto;
      padding-top: var(--space-3);
      font-size: var(--text-sm);
      font-weight: 600;
    }
  `,
})
export class CertificateCard {
  readonly certificate = input.required<Certificate>();
}
