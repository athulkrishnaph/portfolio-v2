import { IconName } from '../icon/icon';

/** Where a link in the table points: a URL string or router commands. */
export type TableLink = string | readonly (string | number)[];

/**
 * How a cell shows its value:
 * - text:      plain text (optionally a link, with a second muted line and a badge)
 * - number:    right-aligned number
 * - date:      'YYYY-MM-DD' shown as "May 2024"
 * - dateRange: [start, end] shown as "Mar 2021 – Present"
 * - tags:      string[] shown comma-separated
 * - toggle:    boolean shown as an on/off icon button (e.g. the featured star)
 */
export type CellType = 'text' | 'number' | 'date' | 'dateRange' | 'tags' | 'toggle';

export interface TableColumn<T> {
  /** Unique id. Also the default field to read (row[key]). */
  key: string;
  /** Column heading (also the label on mobile, where rows become cards). */
  header: string;
  type?: CellType;
  /** Reads the cell value; defaults to row[key]. */
  value?: (row: T) => unknown;

  /** Text cells: turn the text into a link (usually the row's title). */
  link?: (row: T) => TableLink;
  /** Text cells: a muted second line under the value. */
  subtext?: (row: T) => string;
  /** Text cells: a small label after the value (e.g. "Current"), or null. */
  badge?: (row: T) => { label: string; tone?: 'primary' | 'success' } | null;
  /** dateRange cells: shown when the end date is empty (default "Present"). */
  ongoingLabel?: string;
  /** toggle cells: the icon and the accessible label of the button. */
  toggle?: { icon: IconName; label: (row: T) => string };

  sortable?: boolean;
  /** What to sort by, if not the displayed value. */
  sortValue?: (row: T) => string | number;
}

/** A button (or link) in the actions column at the end of each row. */
export interface TableAction<T> {
  /** 'edit' and 'delete' also fire (editRequest) / (deleteRequest). */
  id: string;
  icon: IconName;
  /** Short visible text in the actions menu, e.g. "Delete". */
  text: string;
  /** Accessible label, e.g. row => `Delete ${row.title}`. */
  label: (row: T) => string;
  /** Navigate to this link instead of emitting an event. */
  link?: (row: T) => TableLink;
  danger?: boolean;
}

export interface TableSort {
  key: string;
  direction: 'asc' | 'desc';
}

/** Everything that describes one table. Lives in a *.table.ts file next to the page. */
export interface TableConfig<T> {
  /** Accessible name of the table (read by screen readers, not shown). */
  caption: string;
  columns: TableColumn<T>[];
  /**
   * Row actions. One action is shown as a button; two or more are grouped
   * in a "⋮" menu to keep rows tidy.
   */
  actions?: TableAction<T>[];
  /** Heading of the actions column (default "Actions"). */
  actionsHeader?: string;
  /** Identifies a row (tracking, busy state). Defaults to row.id. */
  rowId?: (row: T) => string | number;
  /** Rows per page. Leave out to show every row on one page. */
  pageSize?: number;
  defaultSort?: TableSort;
  /** Shown when there are no rows. */
  empty?: { title: string; message?: string; icon?: IconName };
  /** Text for the loading spinner. */
  loadingLabel?: string;
}

/** Emitted by (action) for every action and toggle click. */
export interface TableActionEvent<T> {
  /** The action id, or the column key for toggle columns. */
  action: string;
  row: T;
}
