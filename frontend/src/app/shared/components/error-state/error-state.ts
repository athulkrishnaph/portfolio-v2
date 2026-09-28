import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ApiError } from '../../../core/api/api-error';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

/** Shown when loading data failed. Offers a "Try again" button. */
@Component({
  selector: 'app-error-state',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-state.html',
  styleUrl: '../empty-state/state.scss',
})
export class ErrorState {
  readonly error = input<ApiError | undefined>();
  readonly title = input("Couldn't load this content");
  readonly retry = output<void>();

  protected readonly message = computed(
    () => this.error()?.message ?? 'Something went wrong. Please try again.',
  );
}
