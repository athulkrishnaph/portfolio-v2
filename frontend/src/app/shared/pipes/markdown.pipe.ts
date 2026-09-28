import { Pipe, PipeTransform } from '@angular/core';

import { renderMarkdown } from '../../core/utils/markdown';

/**
 * {{ text | markdown }} → safe HTML for [innerHTML]. Pure pipe: re-renders
 * only when the text changes (e.g. while an answer streams in).
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(text: string): string {
    return renderMarkdown(text);
  }
}
