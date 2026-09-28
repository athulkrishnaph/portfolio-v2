import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Certificate } from '../../../core/models';
import { CertificatesService } from '../../../core/services/certificates.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { MonthYearPipe } from '../../../shared/pipes/date-range.pipe';
import { DeleteAction } from '../shared/delete-action';

/** /admin/certificates */
@Component({
  selector: 'app-certificate-list',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, EmptyState, MonthYearPipe],
  template: `
    <app-page-header title="Certificates" [subtitle]="(certificates.data()?.length ?? 0) + ' total'">
      <a class="btn btn--primary" routerLink="/admin/certificates/new">
        <app-icon name="plus" [size]="16" /> New certificate
      </a>
    </app-page-header>

    @if (certificates.loading()) {
      <app-spinner label="Loading certificates…" />
    } @else if (certificates.error(); as error) {
      <app-error-state [error]="error" (retry)="certificates.reload()" />
    } @else if (certificates.data()?.length) {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Issuer</th>
              <th scope="col">Issued</th>
              <th scope="col">Order</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (c of certificates.data(); track c.id) {
              <tr>
                <td>
                  <a class="table__title" [routerLink]="['/admin/certificates', c.id, 'edit']">{{ c.title }}</a>
                </td>
                <td>{{ c.issuer }}</td>
                <td>{{ c.issueDate | monthYear }}</td>
                <td>{{ c.displayOrder }}</td>
                <td class="table__actions">
                  <a class="btn btn--ghost btn--icon" [routerLink]="['/admin/certificates', c.id, 'edit']">
                    <app-icon name="edit" [label]="'Edit ' + c.title" />
                  </a>
                  <button type="button" class="btn btn--ghost btn--icon" [disabled]="deleter.busyId() === c.id" (click)="remove(c)">
                    <app-icon name="trash" [label]="'Delete ' + c.title" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-empty-state icon="award" title="No certificates yet">
        <a class="btn btn--primary" routerLink="/admin/certificates/new">New certificate</a>
      </app-empty-state>
    }
  `,
})
export class CertificateList {
  private readonly service = inject(CertificatesService);
  protected readonly certificates = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Certificate', (id) => this.service.delete(id));

  protected remove(c: Certificate): void {
    this.deleter.run(c.id, c.title, () => this.certificates.refresh());
  }
}
