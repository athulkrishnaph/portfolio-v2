import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Experience } from '../../../core/models';
import { ExperienceService } from '../../../core/services/experience.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { DateRangePipe } from '../../../shared/pipes/date-range.pipe';
import { DeleteAction } from '../shared/delete-action';

/** /admin/experience */
@Component({
  selector: 'app-experience-list',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, EmptyState, DateRangePipe],
  template: `
    <app-page-header title="Experience" [subtitle]="(experience.data()?.length ?? 0) + ' total'">
      <a class="btn btn--primary" routerLink="/admin/experience/new">
        <app-icon name="plus" [size]="16" /> New experience
      </a>
    </app-page-header>

    @if (experience.loading()) {
      <app-spinner label="Loading experience…" />
    } @else if (experience.error(); as error) {
      <app-error-state [error]="error" (retry)="experience.reload()" />
    } @else if (experience.data()?.length) {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Position</th>
              <th scope="col">Company</th>
              <th scope="col">Period</th>
              <th scope="col">Order</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (e of experience.data(); track e.id) {
              <tr>
                <td>
                  <a class="table__title" [routerLink]="['/admin/experience', e.id, 'edit']">{{ e.position }}</a>
                  @if (e.isCurrent) {
                    <span class="tag tag--success">Current</span>
                  }
                </td>
                <td>{{ e.company }}</td>
                <td>{{ e.startDate | dateRange: e.endDate }}</td>
                <td>{{ e.displayOrder }}</td>
                <td class="table__actions">
                  <a class="btn btn--ghost btn--icon" [routerLink]="['/admin/experience', e.id, 'edit']">
                    <app-icon name="edit" [label]="'Edit ' + e.position" />
                  </a>
                  <button type="button" class="btn btn--ghost btn--icon" [disabled]="deleter.busyId() === e.id" (click)="remove(e)">
                    <app-icon name="trash" [label]="'Delete ' + e.position" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-empty-state icon="briefcase" title="No experience yet">
        <a class="btn btn--primary" routerLink="/admin/experience/new">New experience</a>
      </app-empty-state>
    }
  `,
  styles: `
    .tag {
      margin-left: var(--space-2);
    }
  `,
})
export class ExperienceList {
  private readonly service = inject(ExperienceService);
  protected readonly experience = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Experience', (id) => this.service.delete(id));

  protected remove(e: Experience): void {
    this.deleter.run(e.id, `${e.position} at ${e.company}`, () => this.experience.refresh());
  }
}
