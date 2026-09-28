import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Certificate } from '../../../core/models';
import { CertificatesService } from '../../../core/services/certificates.service';
import { Loader } from '../../../core/utils/loader';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { DeleteAction } from '../shared/delete-action';
import { certificateTable } from './certificate-list.table';

/** /admin/certificates */
@Component({
  selector: 'app-certificate-list',
  imports: [RouterLink, PageHeader, Icon, DataTable],
  templateUrl: './certificate-list.html',
})
export class CertificateList {
  private readonly service = inject(CertificatesService);

  protected readonly table = certificateTable;
  protected readonly certificates = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Certificate', (id) => this.service.delete(id));

  protected remove(c: Certificate): void {
    this.deleter.run(c.id, c.title, () => this.certificates.refresh());
  }
}
