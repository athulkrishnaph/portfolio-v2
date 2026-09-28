import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Styles the confirm button as dangerous (e.g. for deletes). */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Opens the app-wide confirmation dialog and resolves with the user's choice:
 *
 *   if (await this.confirm.ask({ title: 'Delete project?', message: '...', danger: true })) { ... }
 *
 * The dialog itself is rendered once by <app-confirm-dialog> in the root component.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this._pending()?.resolve(false); // only one dialog at a time
    return new Promise((resolve) => this._pending.set({ ...options, resolve }));
  }

  /** Called by the dialog component. */
  answer(confirmed: boolean): void {
    this._pending()?.resolve(confirmed);
    this._pending.set(null);
  }
}
