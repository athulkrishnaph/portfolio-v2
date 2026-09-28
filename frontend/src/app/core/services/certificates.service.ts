import { Injectable } from '@angular/core';

import { CrudApi } from '../api/crud-api';
import { Certificate, CertificateInput } from '../models';

@Injectable({ providedIn: 'root' })
export class CertificatesService extends CrudApi<Certificate, CertificateInput> {
  protected readonly path = '/api/certificates';
}
