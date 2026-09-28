import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmService } from '../../../core/ui/confirm.service';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';

/**
 * The single confirmation dialog of the app, driven by ConfirmService.
 * Placed once in the root component.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let request = confirm.pending();
    <app-modal [open]="!!request" [title]="request?.title ?? ''" (closed)="confirm.answer(false)">
      <p class="text-muted">{{ request?.message }}</p>
      <div class="actions">
        <button appButton type="button" (click)="confirm.answer(false)">Cancel</button>
        <button
          appButton
          type="button"
          [variant]="request?.danger ? 'danger' : 'primary'"
          (click)="confirm.answer(true)"
        >
          {{ request?.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-5);
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
}
