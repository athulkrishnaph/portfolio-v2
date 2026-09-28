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
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
})
export class Spinner {
  readonly size = input<'sm' | 'lg'>('lg');
  readonly label = input('');
}
