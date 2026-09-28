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
  templateUrl: './form-page-shell.html',
  styleUrl: './form-page-shell.scss',
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
