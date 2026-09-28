import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { Project } from '../../../core/models';
import { ProjectsService } from '../../../core/services/projects.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { TableActionEvent } from '../../../shared/components/data-table/data-table.model';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { DeleteAction } from '../shared/delete-action';
import { projectTable } from './project-list.table';

/** /admin/projects: table of projects with featured toggle, edit and delete. */
@Component({
  selector: 'app-project-list',
  imports: [RouterLink, PageHeader, Icon, DataTable],
  templateUrl: './project-list.html',
})
export class ProjectList {
  private readonly service = inject(ProjectsService);
  private readonly notifications = inject(NotificationService);

  protected readonly table = projectTable;
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

  /** Custom table actions (edit is a link; delete arrives via deleteRequest). */
  protected onAction({ action, row }: TableActionEvent<Project>): void {
    if (action === 'isFeatured') {
      this.toggleFeatured(row);
    }
  }

  protected remove(p: Project): void {
    this.deleter.run(p.id, p.title, () => this.projects.refresh());
  }
}
