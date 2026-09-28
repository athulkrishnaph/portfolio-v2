import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Icon } from '../icon/icon';

let nextId = 0;

/**
 * Accessible modal built on the native <dialog> element, which provides
 * focus trapping, Escape-to-close and a backdrop for free.
 *
 *   <app-modal [open]="editing()" title="Edit skill" (closed)="editing.set(false)">
 *     ...content...
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = input(false);
  readonly title = input.required<string>();
  /** Emitted whenever the dialog closes (button, Escape or backdrop click). */
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Keep the native dialog in sync with the `open` input.
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  /** A click on the <dialog> itself (not its content) is a click on the backdrop. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.dialog().nativeElement.close();
    }
  }
}
