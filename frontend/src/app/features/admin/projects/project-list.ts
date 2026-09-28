import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { Project } from '../../../core/models';
import { ProjectsService } from '../../../core/services/projects.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { DeleteAction } from '../shared/delete-action';

/** /admin/projects: table of projects with featured toggle, edit and delete. */
@Component({
  selector: 'app-project-list',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, EmptyState],
  template: `
    <app-page-header title="Projects" [subtitle]="(projects.data()?.length ?? 0) + ' total'">
      <a class="btn btn--primary" routerLink="/admin/projects/new">
        <app-icon name="plus" [size]="16" /> New project
      </a>
    </app-page-header>

    @if (projects.loading()) {
      <app-spinner label="Loading projects…" />
    } @else if (projects.error(); as error) {
      <app-error-state [error]="error" (retry)="projects.reload()" />
    } @else if (projects.data()?.length) {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Technologies</th>
              <th scope="col">Order</th>
              <th scope="col">Featured</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (p of projects.data(); track p.id) {
              <tr>
                <td>
                  <a class="table__title" [routerLink]="['/admin/projects', p.id, 'edit']">{{ p.title }}</a>
                  <div class="text-muted">/projects/{{ p.slug }}</div>
                </td>
                <td>{{ p.technologies.join(', ') || '—' }}</td>
                <td>{{ p.displayOrder }}</td>
                <td>
                  <button
                    type="button"
                    class="btn btn--ghost btn--icon"
                    [class.is-featured]="p.isFeatured"
                    [disabled]="featuringId() === p.id"
                    [attr.aria-pressed]="p.isFeatured"
                    [attr.aria-label]="(p.isFeatured ? 'Unfeature ' : 'Feature ') + p.title"
                    (click)="toggleFeatured(p)"
                  >
                    <app-icon name="star" />
                  </button>
                </td>
                <td class="table__actions">
                  <a class="btn btn--ghost btn--icon" [routerLink]="['/admin/projects', p.id, 'edit']">
                    <app-icon name="edit" [label]="'Edit ' + p.title" />
                  </a>
                  <button
                    type="button"
                    class="btn btn--ghost btn--icon"
                    [disabled]="deleter.busyId() === p.id"
                    (click)="remove(p)"
                  >
                    <app-icon name="trash" [label]="'Delete ' + p.title" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-empty-state title="No projects yet" message="Add your first project to show it on the site.">
        <a class="btn btn--primary" routerLink="/admin/projects/new">New project</a>
      </app-empty-state>
    }
  `,
  styles: `
    .is-featured {
      color: var(--color-warning);
    }
  `,
})
export class ProjectList {
  private readonly service = inject(ProjectsService);
  private readonly notifications = inject(NotificationService);

  protected readonly projects = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Project', (id) => this.service.delete(id));
  protected readonly featuringId = signal<number | null>(null);

  /** Sends the whole project back with isFeatured flipped (PUT replaces all fields). */
  protected toggleFeatured(p: Project): void {
    const { id: _id, createdAt: _created, updatedAt: _updated, ...input } = p;
    this.featuringId.set(p.id);
    this.service.update(p.id, { ...input, isFeatured: !p.isFeatured }).subscribe({
      next: (updated) => {
        this.featuringId.set(null);
        this.notifications.success(
          updated.isFeatured ? 'Marked as featured' : 'Removed from featured',
        );
        this.projects.refresh();
      },
      error: (err: unknown) => {
        this.featuringId.set(null);
        this.notifications.error(ApiError.from(err).message);
      },
    });
  }

  protected remove(p: Project): void {
    this.deleter.run(p.id, p.title, () => this.projects.refresh());
  }
}
