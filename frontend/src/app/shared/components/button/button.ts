import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Spinner } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Styled button that stays a real <button> (or <a>), so forms, keyboard
 * and screen readers work normally:
 *
 *   <button appButton variant="primary" [loading]="saving()">Save</button>
 *   <a appButton variant="secondary" routerLink="/projects">Projects</a>
 *
 * While `loading` is true the button shows a spinner and is disabled.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': 'loading() || disabled() ? "" : null',
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (loading()) {
      <app-spinner size="sm" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  /** Square button for icon-only content. */
  readonly iconOnly = input(false);

  protected readonly classes = computed(() =>
    [
      'btn',
      `btn--${this.variant()}`,
      this.size() !== 'md' ? `btn--${this.size()}` : '',
      this.iconOnly() ? 'btn--icon' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
