import { Component, inject } from '@angular/core';

import { CertificatesService } from '../../../core/services/certificates.service';
import { Loader } from '../../../core/utils/loader';
import { CertificateCard } from '../../../shared/components/certificate-card/certificate-card';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { IntroDirective } from '../../../shared/directives/intro.directive';

/** Grid of certificates. */
@Component({
  selector: 'app-certificates',
  imports: [CertificateCard, Spinner, ErrorState, EmptyState, IntroDirective],
  templateUrl: './certificates.html',
})
export class CertificatesPage {
  private readonly certificatesService = inject(CertificatesService);
  protected readonly certificates = new Loader(() => this.certificatesService.list());
}
