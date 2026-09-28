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
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
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
