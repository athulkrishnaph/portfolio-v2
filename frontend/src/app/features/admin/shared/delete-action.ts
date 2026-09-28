import { inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { NotificationService } from '../../../core/ui/notification.service';

/**
 * "Delete with confirmation" used by the admin lists:
 *
 *   readonly deleter = new DeleteAction('Certificate', (id) => this.service.delete(id));
 *   this.deleter.run(item.id, item.title, () => this.list.refresh());
 *
 * Asks for confirmation, calls the API, shows a toast, then runs onDeleted.
 * Must be created in an injection context (a field initializer).
 */
export class DeleteAction {
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  /** id of the item being deleted, to disable its buttons meanwhile. */
  readonly busyId = signal<number | null>(null);

  constructor(
    private readonly noun: string,
    private readonly request: (id: number) => Observable<void>,
  ) {}

  async run(id: number, name: string, onDeleted: () => void): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${this.noun.toLowerCase()}?`,
      message: `"${name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busyId.set(id);
    this.request(id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notifications.success(`${this.noun} deleted`);
        onDeleted();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.notifications.error(ApiError.from(err).message);
      },
    });
  }
}
