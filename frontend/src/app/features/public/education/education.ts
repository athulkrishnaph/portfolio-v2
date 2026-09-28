import { Component, computed, inject } from '@angular/core';

import { EducationService } from '../../../core/services/education.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { Timeline, TimelineItem } from '../../../shared/components/timeline/timeline';

/** Education history as a timeline. */
@Component({
  selector: 'app-education',
  imports: [Timeline, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      <header class="page-intro">
        <span class="eyebrow">// education</span>
        <h1>Education</h1>
        <p>Degrees, courses and programs that shaped how I build software.</p>
      </header>

      @if (education.loading()) {
        <app-spinner label="Loading education…" />
      } @else if (education.error(); as error) {
        <app-error-state [error]="error" (retry)="education.reload()" />
      } @else if (items().length) {
        <app-timeline [items]="items()" icon="graduation" ongoingLabel="In progress" />
      } @else {
        <app-empty-state icon="graduation" title="No education listed yet" />
      }
    </section>
  `,
})
export class EducationPage {
  private readonly educationService = inject(EducationService);
  protected readonly education = new Loader(() => this.educationService.list());

  protected readonly items = computed<TimelineItem[]>(() =>
    (this.education.data() ?? []).map((e) => ({
      id: e.id,
      title: e.fieldOfStudy ? `${e.degree}, ${e.fieldOfStudy}` : e.degree,
      subtitle: e.institution,
      location: e.location,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.endDate === null,
    })),
  );
}
