import { Component, computed, effect, inject, signal } from '@angular/core';

import { ProjectsService } from '../../../core/services/projects.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Pagination, paginate } from '../../../shared/components/pagination/pagination';
import { ProjectCard } from '../../../shared/components/project-card/project-card';
import { Spinner } from '../../../shared/components/spinner/spinner';

const PAGE_SIZE = 6;

/** Project grid with a technology filter and pagination (both client-side). */
@Component({
  selector: 'app-projects',
  imports: [ProjectCard, Pagination, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      <header class="page-intro">
        <span class="eyebrow">// projects</span>
        <h1>Things I've built</h1>
        <p>A selection of projects — from APIs and tools to full-stack applications.</p>
      </header>

      @if (projects.loading()) {
        <app-spinner label="Loading projects…" />
      } @else if (projects.error(); as error) {
        <app-error-state [error]="error" (retry)="projects.reload()" />
      } @else if (projects.data()?.length) {
        @if (technologies().length > 1) {
          <div class="filters" role="group" aria-label="Filter by technology">
            <button
              type="button"
              class="filter"
              [class.filter--active]="!selectedTech()"
              [attr.aria-pressed]="!selectedTech()"
              (click)="selectTech(null)"
            >
              All
            </button>
            @for (tech of technologies(); track tech) {
              <button
                type="button"
                class="filter"
                [class.filter--active]="selectedTech() === tech"
                [attr.aria-pressed]="selectedTech() === tech"
                (click)="selectTech(tech)"
              >
                {{ tech }}
              </button>
            }
          </div>
        }

        <p class="visually-hidden" aria-live="polite">{{ filtered().length }} projects shown</p>
        <div class="grid grid--3">
          @for (project of pageItems(); track project.id) {
            <app-project-card [project]="project" />
          }
        </div>
        <app-pagination [total]="filtered().length" [pageSize]="pageSize" [(page)]="page" />
      } @else {
        <app-empty-state title="No projects yet" message="Projects will appear here once they are added." />
      }
    </section>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
    }
    .filter {
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-surface);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      cursor: pointer;
    }
    .filter:hover {
      color: var(--color-text);
    }
    .filter--active {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-weight: 600;
    }
  `,
})
export class Projects {
  private readonly projectsService = inject(ProjectsService);
  protected readonly projects = new Loader(() => this.projectsService.list());

  protected readonly pageSize = PAGE_SIZE;
  protected readonly page = signal(1);
  protected readonly selectedTech = signal<string | null>(null);

  /** Every technology used by at least one project, sorted by how often it is used. */
  protected readonly technologies = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.projects.data() ?? []) {
      for (const t of p.technologies) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  });

  protected readonly filtered = computed(() => {
    const tech = this.selectedTech();
    const all = this.projects.data() ?? [];
    return tech ? all.filter((p) => p.technologies.includes(tech)) : all;
  });

  protected readonly pageItems = computed(() => paginate(this.filtered(), this.page(), PAGE_SIZE));

  constructor() {
    // Scroll back to the top of the list when the page changes (not on first render).
    let firstRun = true;
    effect(() => {
      this.page();
      if (!firstRun) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      firstRun = false;
    });
  }

  protected selectTech(tech: string | null): void {
    this.selectedTech.set(tech);
    this.page.set(1);
  }
}
