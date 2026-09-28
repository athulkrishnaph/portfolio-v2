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
  templateUrl: './education.html',
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
