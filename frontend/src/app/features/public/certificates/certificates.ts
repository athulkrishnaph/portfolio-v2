import { Component, inject } from '@angular/core';

import { CertificatesService } from '../../../core/services/certificates.service';
import { Loader } from '../../../core/utils/loader';
import { CertificateCard } from '../../../shared/components/certificate-card/certificate-card';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Spinner } from '../../../shared/components/spinner/spinner';

/** Grid of certificates. */
@Component({
  selector: 'app-certificates',
  imports: [CertificateCard, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      <header class="page-intro">
        <span class="eyebrow">// certificates</span>
        <h1>Certifications</h1>
        <p>Credentials that back up the skills I use every day.</p>
      </header>

      @if (certificates.loading()) {
        <app-spinner label="Loading certificates…" />
      } @else if (certificates.error(); as error) {
        <app-error-state [error]="error" (retry)="certificates.reload()" />
      } @else if (certificates.data()?.length) {
        <div class="grid grid--3">
          @for (certificate of certificates.data(); track certificate.id) {
            <app-certificate-card [certificate]="certificate" />
          }
        </div>
      } @else {
        <app-empty-state icon="award" title="No certificates yet" />
      }
    </section>
  `,
})
export class CertificatesPage {
  private readonly certificatesService = inject(CertificatesService);
  protected readonly certificates = new Loader(() => this.certificatesService.list());
}
