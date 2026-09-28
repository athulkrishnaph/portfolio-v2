import { Pipe, PipeTransform } from '@angular/core';

const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

/**
 * Formats a 'YYYY-MM-DD' date as "May 2024".
 * The string is split manually so no time zone can shift the date.
 */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  if (!year || !month) {
    return isoDate;
  }
  return monthYear.format(new Date(year, month - 1, 1));
}

/**
 * {{ start | dateRange: end }}  →  "Mar 2021 – Present" / "Mar 2021 – Jun 2023".
 * A null end date means ongoing.
 */
@Pipe({ name: 'dateRange' })
export class DateRangePipe implements PipeTransform {
  transform(start: string, end: string | null, ongoingLabel = 'Present'): string {
    return `${formatMonthYear(start)} – ${end ? formatMonthYear(end) : ongoingLabel}`;
  }
}

/** {{ date | monthYear }}  →  "May 2024". */
@Pipe({ name: 'monthYear' })
export class MonthYearPipe implements PipeTransform {
  transform(date: string): string {
    return formatMonthYear(date);
  }
}
