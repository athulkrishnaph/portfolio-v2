import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, IconName } from '../icon/icon';

/** Friendly placeholder for lists with nothing to show. Projects an optional action. */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <span class="state__icon"><app-icon [name]="icon()" [size]="28" /></span>
      <h3 class="state__title">{{ title() }}</h3>
      @if (message()) {
        <p class="state__message">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './state.scss',
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input('');
  readonly icon = input<IconName>('folder');
}
