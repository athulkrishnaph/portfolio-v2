import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DateRangePipe } from '../../pipes/date-range.pipe';
import { Icon, IconName } from '../icon/icon';
import { IntroDirective } from '../../directives/intro.directive';

/** One entry on the timeline. Experience and education are mapped to this shape. */
export interface TimelineItem {
  id: number;
  title: string;
  subtitle: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  /** Highlighted as "Current". */
  current: boolean;
}

/** Vertical timeline used by the Experience and Education pages. */
@Component({
  selector: 'app-timeline',
  imports: [DateRangePipe, Icon, IntroDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline {
  readonly items = input.required<TimelineItem[]>();
  readonly icon = input<IconName>('briefcase');
  readonly ongoingLabel = input('Present');
}
