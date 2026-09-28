import { Component, effect, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ProjectsService } from '../../../core/services/projects.service';
import { AppTitleStrategy } from '../../../core/ui/title-strategy';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Spinner } from '../../../shared/components/spinner/spinner';

/** One project, loaded by the slug in the URL: /projects/task-flow. */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, Icon, Spinner, ErrorState, EmptyState],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail {
  /** Bound from the :slug route parameter (withComponentInputBinding). */
  readonly slug = input.required<string>();

  private readonly projectsService = inject(ProjectsService);
  private readonly titles = inject(AppTitleStrategy);

  // Re-fetches whenever the slug changes (e.g. navigating between projects).
  protected readonly project = new Loader(
    (slug: string) => this.projectsService.getBySlug(slug),
    toObservable(this.slug),
  );

  constructor() {
    effect(() => {
      const p = this.project.data();
      if (p) {
        this.titles.setPageTitle(p.title);
      }
    });
  }
}
