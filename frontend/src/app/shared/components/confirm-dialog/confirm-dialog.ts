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
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
}
