import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { ConfirmService } from '../../../core/ui/confirm.service';

/** Implemented by pages with forms that can have unsaved edits. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a page whose form has unsaved edits. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return inject(ConfirmService).ask({
    title: 'Discard changes?',
    message: 'You have unsaved changes on this page. If you leave now, they will be lost.',
    confirmLabel: 'Discard changes',
    danger: true,
  });
};
