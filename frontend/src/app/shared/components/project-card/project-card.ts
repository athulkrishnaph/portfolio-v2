import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Project } from '../../../core/models';
import { Icon } from '../icon/icon';

/** Card for one project in a grid. The title links to the project page. */
@Component({
  selector: 'app-project-card',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
})
export class ProjectCard {
  readonly project = input.required<Project>();

  private static readonly maxTech = 5;
  protected readonly visibleTech = computed(() =>
    this.project().technologies.slice(0, ProjectCard.maxTech),
  );
  protected readonly hiddenTechCount = computed(() =>
    Math.max(0, this.project().technologies.length - ProjectCard.maxTech),
  );
  /** "Task Flow" → "TF", shown when the project has no image. */
  protected readonly initials = computed(() =>
    this.project()
      .title.split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
