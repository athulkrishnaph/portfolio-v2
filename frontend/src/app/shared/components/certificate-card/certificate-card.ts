import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Certificate } from '../../../core/models';
import { MonthYearPipe } from '../../pipes/date-range.pipe';
import { Icon } from '../icon/icon';

/** Card for one certificate: optional image, title, issuer, date, credential link. */
@Component({
  selector: 'app-certificate-card',
  imports: [Icon, MonthYearPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-card.html',
  styleUrl: './certificate-card.scss',
})
export class CertificateCard {
  readonly certificate = input.required<Certificate>();
}
