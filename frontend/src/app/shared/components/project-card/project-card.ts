import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Project } from '../../../core/models';
import { Icon } from '../icon/icon';

/** Card for one project in a grid. The title links to the project page. */
@Component({
  selector: 'app-project-card',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = project();
    <article class="card card--interactive project">
      <a class="project__media" [routerLink]="['/projects', p.slug]" tabindex="-1" aria-hidden="true">
        @if (p.imageUrl) {
          <img [src]="p.imageUrl" [alt]="''" loading="lazy" />
        } @else {
          <span class="project__placeholder">{{ initials() }}</span>
        }
      </a>
      <div class="project__body">
        <h3 class="project__title">
          <a [routerLink]="['/projects', p.slug]">{{ p.title }}</a>
          @if (p.isFeatured) {
            <span class="tag tag--primary">Featured</span>
          }
        </h3>
        <p class="project__summary">{{ p.summary }}</p>
        @if (p.technologies.length) {
          <ul class="tag-list" aria-label="Technologies">
            @for (tech of visibleTech(); track tech) {
              <li class="tag">{{ tech }}</li>
            }
            @if (hiddenTechCount()) {
              <li class="tag">+{{ hiddenTechCount() }}</li>
            }
          </ul>
        }
        <div class="project__links">
          @if (p.githubUrl) {
            <a [href]="p.githubUrl" target="_blank" rel="noopener noreferrer">
              <app-icon name="github" [size]="16" /> Code
            </a>
          }
          @if (p.liveUrl) {
            <a [href]="p.liveUrl" target="_blank" rel="noopener noreferrer">
              <app-icon name="external" [size]="16" /> Live demo
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    .project {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .project__media {
      display: block;
      aspect-ratio: 16 / 9;
      background: linear-gradient(135deg, var(--color-primary-soft), var(--color-surface-2));
    }
    .project__media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .project__placeholder {
      display: grid;
      place-items: center;
      height: 100%;
      font-family: var(--font-mono);
      font-size: var(--text-3xl);
      font-weight: 700;
      color: var(--color-primary);
    }
    .project__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-5);
    }
    .project__title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
    }
    .project__title a {
      color: var(--color-text);
    }
    .project__summary {
      flex: 1;
      margin: 0;
      color: var(--color-text-muted);
    }
    .project__links {
      display: flex;
      gap: var(--space-4);
      font-size: var(--text-sm);
      font-weight: 500;
    }
    .project__links a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
  `,
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
