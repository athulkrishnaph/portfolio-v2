import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { DateRangePipe, MonthYearPipe } from '../../pipes/date-range.pipe';
import { ActionsMenu, MenuAction } from '../actions-menu/actions-menu';
import { EmptyState } from '../empty-state/empty-state';
import { ErrorState } from '../error-state/error-state';
import { Icon } from '../icon/icon';
import { Pagination, paginate } from '../pagination/pagination';
import { Spinner } from '../spinner/spinner';
import {
  TableAction,
  TableActionEvent,
  TableColumn,
  TableConfig,
  TableLink,
  TableSort,
} from './data-table.model';

/**
 * Configurable table used by the admin lists. Everything about the columns
 * and actions comes from a TableConfig (kept in a *.table.ts file next to
 * the page), so pages only wire up data and events:
 *
 *   <app-data-table
 *     [config]="tableConfig"
 *     [data]="projects.data()"
 *     [loading]="projects.loading()"
 *     [error]="projects.error()"
 *     [busyRowId]="deleter.busyId()"
 *     (retry)="projects.reload()"
 *     (deleteRequest)="remove($event)"
 *     (action)="onAction($event)"
 *   >
 *     <a tableEmpty class="btn btn--primary" routerLink="new">New project</a>
 *   </app-data-table>
 *
 * Handles loading, error and empty states, client-side sorting and
 * pagination, and turns rows into cards on small screens. With two or more
 * row actions, each row gets a "⋮" button that opens an actions menu.
 */
@Component({
  selector: 'app-data-table',
  imports: [RouterLink, Icon, Spinner, ErrorState, EmptyState, Pagination, ActionsMenu, MonthYearPipe, DateRangePipe],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable<T extends object> {
  readonly config = input.required<TableConfig<T>>();
  readonly data = input<T[] | null | undefined>([]);
  readonly loading = input(false);
  readonly error = input<ApiError | null | undefined>(null);
  /** id of a row being changed; its buttons are disabled meanwhile. */
  readonly busyRowId = input<unknown>(null);

  /** Every action and toggle click. */
  readonly action = output<TableActionEvent<T>>();
  /** Shortcut for actions with id 'edit' (that have no link). */
  readonly editRequest = output<T>();
  /** Shortcut for actions with id 'delete'. */
  readonly deleteRequest = output<T>();
  /** "Try again" on the error state. */
  readonly retry = output<void>();

  /** Current sort; starts from the config's defaultSort. */
  protected readonly sort = linkedSignal<TableSort | null>(() => this.config().defaultSort ?? null);
  protected readonly page = signal(1);

  protected readonly rows = computed(() => {
    const rows = [...(this.data() ?? [])];
    const sort = this.sort();
    const column = sort && this.config().columns.find((c) => c.key === sort.key);
    if (column) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => dir * compare(this.sortValue(column, a), this.sortValue(column, b)));
    }
    return rows;
  });

  protected readonly pageRows = computed(() => {
    const size = this.config().pageSize;
    if (!size) {
      return this.rows();
    }
    // Keep the page valid when rows disappear (e.g. after a delete).
    const last = Math.max(1, Math.ceil(this.rows().length / size));
    return paginate(this.rows(), Math.min(this.page(), last), size);
  });

  protected rowId(row: T): unknown {
    const custom = this.config().rowId;
    return custom ? custom(row) : (row as { id?: unknown }).id;
  }

  protected isBusy(row: T): boolean {
    const busy = this.busyRowId();
    return busy !== null && busy !== undefined && busy === this.rowId(row);
  }

  protected value(column: TableColumn<T>, row: T): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  }

  protected text(column: TableColumn<T>, row: T): string {
    const v = this.value(column, row);
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  protected tags(column: TableColumn<T>, row: T): string {
    const v = this.value(column, row);
    return Array.isArray(v) && v.length ? v.join(', ') : '—';
  }

  protected range(column: TableColumn<T>, row: T): [string, string | null] {
    const v = this.value(column, row);
    return Array.isArray(v) ? [String(v[0] ?? ''), (v[1] as string | null) ?? null] : ['', null];
  }

  protected link(target: TableLink): string | (string | number)[] {
    return typeof target === 'string' ? target : [...target];
  }

  /** Click on a sortable header: ascending → descending → ascending … */
  protected toggleSort(column: TableColumn<T>): void {
    const current = this.sort();
    const direction = current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ key: column.key, direction });
    this.page.set(1);
  }

  protected ariaSort(column: TableColumn<T>): string | null {
    if (!column.sortable) return null;
    const s = this.sort();
    if (s?.key !== column.key) return 'none';
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected runAction(action: TableAction<T>, row: T): void {
    if (action.id === 'edit') this.editRequest.emit(row);
    if (action.id === 'delete') this.deleteRequest.emit(row);
    this.action.emit({ action: action.id, row });
  }

  protected toggle(column: TableColumn<T>, row: T): void {
    this.action.emit({ action: column.key, row });
  }

  /** The row's name for accessible labels ("More actions for Task Flow"). */
  protected rowTitle(row: T): string {
    const first = this.config().columns[0];
    return first ? this.text(first, row) : '';
  }

  /** The row's actions as "⋮" menu entries (links resolved for this row). */
  protected menuActions(row: T): MenuAction[] {
    return (this.config().actions ?? []).map((a) => ({
      id: a.id,
      icon: a.icon,
      text: a.text,
      link: a.link?.(row),
      danger: a.danger,
    }));
  }

  protected onMenuSelect(id: string, row: T): void {
    const action = this.config().actions?.find((a) => a.id === id);
    if (action) this.runAction(action, row);
  }

  private sortValue(column: TableColumn<T>, row: T): string | number {
    if (column.sortValue) return column.sortValue(row);
    const v = this.value(column, row);
    if (Array.isArray(v)) return column.type === 'dateRange' ? String(v[0] ?? '') : v.join(', ');
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v === null || v === undefined ? '' : String(v);
  }
}

/** Numbers numerically; text case-insensitively with natural number order ("2" < "10"). */
function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
