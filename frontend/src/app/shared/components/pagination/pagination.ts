import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Page navigation: « 1 … 4 5 6 … 12 ». Two-way bind the current page:
 *
 *   <app-pagination [total]="items.length" [pageSize]="6" [(page)]="page" />
 *
 * Hidden automatically when everything fits on one page.
 */
@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  readonly total = input.required<number>();
  readonly pageSize = input(10);
  /** 1-based current page. */
  readonly page = model(1);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  /** Page numbers to show; null marks a gap ("…"). */
  protected readonly items = computed(() => pageItems(this.page(), this.pageCount()));

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.pageCount()));
  }
}

/** First, last, and the current page ±1, with gaps in between. */
export function pageItems(current: number, count: number): (number | null)[] {
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const p of sorted) {
    const prev = result.at(-1);
    if (typeof prev === 'number' && p - prev > 1) {
      result.push(p - prev === 2 ? prev + 1 : null); // fill a single missing page instead of "…"
    }
    result.push(p);
  }
  return result;
}

/** Returns the items of one page (1-based). */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
