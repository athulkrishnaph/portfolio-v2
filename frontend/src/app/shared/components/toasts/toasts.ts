import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../../core/ui/notification.service';
import { Icon } from '../icon/icon';

/** Renders NotificationService toasts. Placed once in the root component. */
@Component({
  selector: 'app-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- aria-live: screen readers announce new messages without moving focus -->
    <div class="toasts" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class.toast--success]="toast.kind === 'success'" [class.toast--error]="toast.kind === 'error'">
          <app-icon [name]="toast.kind === 'error' ? 'info' : 'check'" />
          <span class="toast__message">{{ toast.message }}</span>
          <button type="button" class="toast__close" (click)="notifications.dismiss(toast.id)">
            <app-icon name="x" [size]="14" label="Dismiss" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: min(380px, calc(100vw - 2rem));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      font-size: var(--text-sm);
      color: var(--color-primary);
      animation: slide-in 0.2s ease-out;
    }
    .toast--success {
      border-left-color: var(--color-success);
      color: var(--color-success);
    }
    .toast--error {
      border-left-color: var(--color-danger);
      color: var(--color-danger);
    }
    .toast__message {
      flex: 1;
      color: var(--color-text);
    }
    .toast__close {
      padding: var(--space-1);
      border: 0;
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;
    }
    @keyframes slide-in {
      from {
        transform: translateY(8px);
        opacity: 0;
      }
    }
  `,
})
export class Toasts {
  protected readonly notifications = inject(NotificationService);
}
