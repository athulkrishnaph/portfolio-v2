import { Pipe, PipeTransform } from '@angular/core';

/**
 * Shortens text to `max` characters plus "…". Counts characters, not UTF-16
 * units, so emoji and accented letters are never cut in half.
 *
 *   {{ skill.name | truncate: 15 }}   "Responsive UI Development" → "Responsive UI D…"
 */
@Pipe({ name: 'truncate' })
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, max: number): string {
    return truncate(value ?? '', max);
  }
}

export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : text;
}

/** True when `truncate(text, max)` would shorten the text. */
export function isTruncated(text: string, max: number): boolean {
  return Array.from(text).length > max;
}
