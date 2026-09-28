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
  template: `
    <dialog
      #dialog
      class="modal"
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
      (click)="closeOnBackdrop($event)"
    >
      <div class="modal__panel">
        <header class="modal__header">
          <h2 class="modal__title" [id]="titleId">{{ title() }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" (click)="dialog.close()">
            <app-icon name="x" label="Close" />
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    .modal {
      width: min(520px, calc(100vw - 2rem));
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-md);
    }
    .modal::backdrop {
      background: rgb(15 23 42 / 0.55);
      backdrop-filter: blur(2px);
    }
    .modal__panel {
      padding: var(--space-5);
    }
    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .modal__title {
      margin: 0;
      font-size: var(--text-xl);
    }
  `,
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
