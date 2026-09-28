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
  template: `
    @if (pageCount() > 1) {
      <nav class="pagination" aria-label="Pagination">
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          [disabled]="page() === 1"
          (click)="goTo(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="16" /> Previous
        </button>
        <ol class="pagination__pages">
          @for (item of items(); track $index) {
            <li>
              @if (item === null) {
                <span class="pagination__gap" aria-hidden="true">…</span>
              } @else {
                <button
                  type="button"
                  class="pagination__page"
                  [class.pagination__page--active]="item === page()"
                  [attr.aria-current]="item === page() ? 'page' : null"
                  [attr.aria-label]="'Page ' + item"
                  (click)="goTo(item)"
                >
                  {{ item }}
                </button>
              }
            </li>
          }
        </ol>
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          [disabled]="page() === pageCount()"
          (click)="goTo(page() + 1)"
        >
          Next <app-icon name="chevron-right" [size]="16" />
        </button>
      </nav>
    }
  `,
  styles: `
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin-top: var(--space-6);
    }
    .pagination__pages {
      display: flex;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .pagination__page {
      min-width: 36px;
      height: 36px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: none;
      font-size: var(--text-sm);
      cursor: pointer;
    }
    .pagination__page:hover {
      background: var(--color-surface-2);
    }
    .pagination__page--active {
      border-color: var(--color-primary);
      color: var(--color-primary);
      font-weight: 600;
    }
    .pagination__gap {
      display: inline-block;
      min-width: 24px;
      text-align: center;
      color: var(--color-text-muted);
    }
  `,
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
