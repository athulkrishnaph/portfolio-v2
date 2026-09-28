import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';

import { ThemeId, ThemeService } from '../../../core/ui/theme.service';
import { Icon } from '../icon/icon';

/**
 * Button that opens a small menu of colour themes. Closes on selection, on
 * Escape (focus returns to the button) and on a click anywhere else.
 */
@Component({
  selector: 'app-theme-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  templateUrl: './theme-picker.html',
  styleUrl: './theme-picker.scss',
})
export class ThemePicker {
  protected readonly theme = inject(ThemeService);
  protected readonly open = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected choose(id: ThemeId): void {
    this.theme.set(id);
    this.close(true);
  }

  protected close(returnFocus = false): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (returnFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  /** A click outside this component closes the menu. */
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
