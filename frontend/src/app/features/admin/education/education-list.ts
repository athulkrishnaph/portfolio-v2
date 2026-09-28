import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Education } from '../../../core/models';
import { EducationService } from '../../../core/services/education.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { DateRangePipe } from '../../../shared/pipes/date-range.pipe';
import { DeleteAction } from '../shared/delete-action';

/** /admin/education */
@Component({
  selector: 'app-education-list',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, EmptyState, DateRangePipe],
  template: `
    <app-page-header title="Education" [subtitle]="(education.data()?.length ?? 0) + ' total'">
      <a class="btn btn--primary" routerLink="/admin/education/new">
        <app-icon name="plus" [size]="16" /> New education
      </a>
    </app-page-header>

    @if (education.loading()) {
      <app-spinner label="Loading education…" />
    } @else if (education.error(); as error) {
      <app-error-state [error]="error" (retry)="education.reload()" />
    } @else if (education.data()?.length) {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Degree</th>
              <th scope="col">Institution</th>
              <th scope="col">Period</th>
              <th scope="col">Order</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (e of education.data(); track e.id) {
              <tr>
                <td>
                  <a class="table__title" [routerLink]="['/admin/education', e.id, 'edit']">
                    {{ e.degree }}{{ e.fieldOfStudy ? ', ' + e.fieldOfStudy : '' }}
                  </a>
                </td>
                <td>{{ e.institution }}</td>
                <td>{{ e.startDate | dateRange: e.endDate : 'In progress' }}</td>
                <td>{{ e.displayOrder }}</td>
                <td class="table__actions">
                  <a class="btn btn--ghost btn--icon" [routerLink]="['/admin/education', e.id, 'edit']">
                    <app-icon name="edit" [label]="'Edit ' + e.degree" />
                  </a>
                  <button type="button" class="btn btn--ghost btn--icon" [disabled]="deleter.busyId() === e.id" (click)="remove(e)">
                    <app-icon name="trash" [label]="'Delete ' + e.degree" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-empty-state icon="graduation" title="No education yet">
        <a class="btn btn--primary" routerLink="/admin/education/new">New education</a>
      </app-empty-state>
    }
  `,
})
export class EducationList {
  private readonly service = inject(EducationService);
  protected readonly education = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Education', (id) => this.service.delete(id));

  protected remove(e: Education): void {
    this.deleter.run(e.id, `${e.degree} at ${e.institution}`, () => this.education.refresh());
  }
}
