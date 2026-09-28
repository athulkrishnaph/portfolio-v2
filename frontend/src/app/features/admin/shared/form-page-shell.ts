import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { Button } from '../../../shared/components/button/button';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';

/**
 * Common frame of the admin create/edit pages: header with a back link,
 * loading and error states, general error messages, and the save/cancel
 * bar. The page's fields are projected inside.
 *
 * The <form> element stays in the page itself so formGroup/ngSubmit work
 * as usual; the shell renders around it.
 */
@Component({
  selector: 'app-form-page-shell',
  imports: [PageHeader, RouterLink, Icon, Spinner, ErrorState, Button],
  template: `
    <app-page-header [title]="title()">
      <a class="btn btn--ghost" [routerLink]="backUrl()">
        <app-icon name="arrow-left" [size]="16" /> Back
      </a>
    </app-page-header>

    @if (loading()) {
      <app-spinner label="Loading…" />
    } @else if (loadError(); as error) {
      <app-error-state [error]="error" (retry)="retry.emit()" />
    } @else {
      <div class="card card--padded shell">
        @if (errors().length) {
          <div class="alert alert--danger" role="alert">
            <app-icon name="info" />
            <div>
              @for (message of errors(); track message) {
                <div>{{ message }}</div>
              }
            </div>
          </div>
        }
        <ng-content />
        <div class="form-actions">
          <button appButton type="button" variant="ghost" (click)="cancelled.emit()">Cancel</button>
          <button appButton type="submit" variant="primary" [attr.form]="formId()" [loading]="saving()">
            <app-icon name="check" [size]="16" /> {{ saveLabel() }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .shell {
      display: grid;
      gap: var(--space-5);
      max-width: 880px;
    }
  `,
})
export class FormPageShell {
  readonly title = input.required<string>();
  readonly backUrl = input.required<string>();
  /** id of the page's <form>, so the Save button can submit it from outside. */
  readonly formId = input.required<string>();
  readonly loading = input(false);
  readonly loadError = input<ApiError | null>(null);
  readonly saving = input(false);
  readonly errors = input<string[]>([]);
  readonly saveLabel = input('Save');

  readonly retry = output<void>();
  readonly cancelled = output<void>();
}
