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
  template: `
    <button
      #trigger
      type="button"
      class="btn btn--ghost btn--icon"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'Theme: ' + theme.current().label + '. Change theme'"
      [title]="'Theme: ' + theme.current().label"
      (click)="open.set(!open())"
    >
      <app-icon name="droplet" />
    </button>

    @if (open()) {
      <div class="menu" role="menu" aria-label="Colour theme">
        @for (option of theme.themes; track option.id) {
          <button
            type="button"
            role="menuitemradio"
            class="menu__item"
            [attr.aria-checked]="option.id === theme.theme()"
            (click)="choose(option.id)"
          >
            <span
              class="menu__swatch"
              [style.background]="
                'linear-gradient(135deg, ' + option.swatch[0] + ' 50%, ' + option.swatch[1] + ' 50%)'
              "
              aria-hidden="true"
            ></span>
            <span class="menu__label">{{ option.label }}</span>
            @if (option.id === theme.theme()) {
              <app-icon name="check" [size]="16" />
            }
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .menu {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      z-index: 300;
      display: grid;
      min-width: 180px;
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
    }
    .menu__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      font-size: var(--text-sm);
      text-align: left;
      cursor: pointer;
    }
    .menu__item:hover,
    .menu__item:focus-visible {
      background: var(--color-surface-2);
    }
    .menu__item[aria-checked='true'] {
      color: var(--color-primary);
      font-weight: 600;
    }
    .menu__swatch {
      width: 18px;
      height: 18px;
      border: 1px solid var(--color-border);
      border-radius: 50%;
    }
    .menu__label {
      flex: 1;
    }
  `,
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
