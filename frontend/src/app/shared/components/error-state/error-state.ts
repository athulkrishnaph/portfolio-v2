import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ApiError } from '../../../core/api/api-error';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

/** Shown when loading data failed. Offers a "Try again" button. */
@Component({
  selector: 'app-error-state',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state state--error" role="alert">
      <span class="state__icon"><app-icon name="info" [size]="28" /></span>
      <h3 class="state__title">{{ title() }}</h3>
      <p class="state__message">{{ message() }}</p>
      <button appButton type="button" (click)="retry.emit()">
        <app-icon name="refresh" [size]="16" /> Try again
      </button>
    </div>
  `,
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
