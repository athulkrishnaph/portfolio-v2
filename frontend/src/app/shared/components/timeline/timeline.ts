import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DateRangePipe } from '../../pipes/date-range.pipe';
import { Icon, IconName } from '../icon/icon';

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
  imports: [DateRangePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline">
      @for (item of items(); track item.id) {
        <li class="timeline__item">
          <span class="timeline__marker" [class.timeline__marker--current]="item.current">
            <app-icon [name]="icon()" [size]="16" />
          </span>
          <article class="card card--padded timeline__card">
            <header class="timeline__header">
              <div>
                <h3 class="timeline__title">{{ item.title }}</h3>
                <p class="timeline__subtitle">{{ item.subtitle }}</p>
              </div>
              <div class="timeline__meta">
                <span class="tag" [class.tag--success]="item.current">
                  {{ item.startDate | dateRange: item.endDate : ongoingLabel() }}
                </span>
                @if (item.location) {
                  <span class="timeline__location">
                    <app-icon name="map-pin" [size]="14" /> {{ item.location }}
                  </span>
                }
              </div>
            </header>
            @if (item.description) {
              <p class="timeline__description prose">{{ item.description }}</p>
            }
          </article>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      position: relative;
      display: grid;
      gap: var(--space-5);
      margin: 0;
      padding: 0 0 0 var(--space-7);
      list-style: none;
    }
    .timeline::before {
      content: '';
      position: absolute;
      top: 8px;
      bottom: 8px;
      left: 17px;
      width: 2px;
      background: var(--color-border);
    }
    .timeline__item {
      position: relative;
    }
    .timeline__marker {
      position: absolute;
      top: var(--space-5);
      left: calc(-1 * var(--space-7));
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 2px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text-muted);
    }
    .timeline__marker--current {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .timeline__header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .timeline__title {
      margin: 0;
      font-size: var(--text-lg);
    }
    .timeline__subtitle {
      margin: 0;
      font-weight: 500;
      color: var(--color-primary);
    }
    .timeline__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }
    .timeline__location {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .timeline__description {
      margin: var(--space-4) 0 0;
      color: var(--color-text-muted);
    }
  `,
})
export class Timeline {
  readonly items = input.required<TimelineItem[]>();
  readonly icon = input<IconName>('briefcase');
  readonly ongoingLabel = input('Present');
}
