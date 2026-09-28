import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../../core/ui/notification.service';
import { Icon } from '../icon/icon';

/** Renders NotificationService toasts. Placed once in the root component. */
@Component({
  selector: 'app-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  protected readonly notifications = inject(NotificationService);
}
