import { Component, computed, inject } from '@angular/core';

import { ExperienceService } from '../../../core/services/experience.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { Timeline, TimelineItem } from '../../../shared/components/timeline/timeline';

/** Work history as a timeline. */
@Component({
  selector: 'app-experience',
  imports: [Timeline, Spinner, ErrorState, EmptyState],
  templateUrl: './experience.html',
})
export class ExperiencePage {
  private readonly experienceService = inject(ExperienceService);
  protected readonly experience = new Loader(() => this.experienceService.list());

  protected readonly items = computed<TimelineItem[]>(() =>
    (this.experience.data() ?? []).map((e) => ({
      id: e.id,
      title: e.position,
      subtitle: e.company,
      location: e.location,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.isCurrent,
    })),
  );
}
