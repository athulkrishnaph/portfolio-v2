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
  template: `
    <section class="container section">
      <a class="back link-arrow" routerLink="/projects">
        <app-icon name="arrow-left" [size]="16" /> All projects
      </a>

      @if (project.loading()) {
        <app-spinner label="Loading project…" />
      } @else if (project.error(); as error) {
        @if (error.isNotFound) {
          <app-empty-state title="Project not found" message="It may have been renamed or removed.">
            <a class="btn btn--primary" routerLink="/projects">Browse projects</a>
          </app-empty-state>
        } @else {
          <app-error-state [error]="error" (retry)="project.reload()" />
        }
      } @else if (project.data(); as p) {
        <article class="detail">
          <header class="detail__header">
            @if (p.isFeatured) {
              <span class="tag tag--primary">Featured project</span>
            }
            <h1 class="detail__title">{{ p.title }}</h1>
            @if (p.summary) {
              <p class="detail__summary">{{ p.summary }}</p>
            }
            <div class="detail__actions">
              @if (p.liveUrl) {
                <a class="btn btn--primary" [href]="p.liveUrl" target="_blank" rel="noopener noreferrer">
                  <app-icon name="external" [size]="16" /> Live demo
                </a>
              }
              @if (p.githubUrl) {
                <a class="btn btn--secondary" [href]="p.githubUrl" target="_blank" rel="noopener noreferrer">
                  <app-icon name="github" [size]="16" /> Source code
                </a>
              }
            </div>
          </header>

          @if (p.imageUrl) {
            <img class="detail__image" [src]="p.imageUrl" [alt]="'Screenshot of ' + p.title" />
          }

          <div class="detail__body">
            <div class="prose detail__description">{{ p.description || p.summary }}</div>
            @if (p.technologies.length) {
              <aside class="card card--padded">
                <h2 class="detail__aside-title">Built with</h2>
                <ul class="tag-list">
                  @for (tech of p.technologies; track tech) {
                    <li class="tag tag--primary">{{ tech }}</li>
                  }
                </ul>
              </aside>
            }
          </div>
        </article>
      }
    </section>
  `,
  styles: `
    .back {
      margin-bottom: var(--space-5);
    }
    .detail__header {
      max-width: 760px;
      margin-bottom: var(--space-6);
    }
    .detail__title {
      margin-top: var(--space-3);
    }
    .detail__summary {
      font-size: var(--text-xl);
      color: var(--color-text-muted);
    }
    .detail__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .detail__image {
      width: 100%;
      max-height: 520px;
      margin-bottom: var(--space-6);
      object-fit: cover;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
    }
    .detail__body {
      display: grid;
      gap: var(--space-6);
      align-items: start;
    }
    @media (min-width: 1024px) {
      .detail__body {
        grid-template-columns: 1fr 300px;
      }
    }
    .detail__description {
      font-size: var(--text-lg);
      line-height: 1.75;
    }
    .detail__aside-title {
      font-size: var(--text-base);
    }
  `,
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
