import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, IconName } from '../icon/icon';

/** Friendly placeholder for lists with nothing to show. Projects an optional action. */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.html',
  styleUrl: './state.scss',
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input('');
  readonly icon = input<IconName>('folder');
}
