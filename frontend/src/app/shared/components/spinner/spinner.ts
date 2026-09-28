import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Loading indicator. With a `label` it is announced to screen readers
 * (role="status"); without one it is decorative (e.g. inside a button).
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"spinner spinner--" + size()',
    '[attr.role]': 'label() ? "status" : null',
  },
  template: `
    <span class="spinner__circle" aria-hidden="true"></span>
    @if (label()) {
      <span class="spinner__label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--color-text-muted);
    }
    :host(.spinner--lg) {
      display: flex;
      justify-content: center;
      padding-block: var(--space-7);
    }
    .spinner__circle {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    :host(.spinner--lg) .spinner__circle {
      width: 28px;
      height: 28px;
      border-width: 3px;
      color: var(--color-primary);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'lg'>('lg');
  readonly label = input('');
}
