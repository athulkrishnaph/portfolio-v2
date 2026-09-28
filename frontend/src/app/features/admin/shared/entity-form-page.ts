import { Directive, OnInit, inject, input, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { CrudApi } from '../../../core/api/crud-api';
import { NotificationService } from '../../../core/ui/notification.service';
import { applyServerErrors, revealErrors } from '../../../core/utils/forms';

/**
 * Shared behaviour of the admin "new" and "edit" pages (projects,
 * certificates, experience, education):
 *
 *  - /admin/x/new       → empty form, POST on save
 *  - /admin/x/:id/edit  → loads the item, PUT on save
 *  - client validation first; server validation errors are shown next to
 *    the matching fields
 *  - success toast + back to the list
 *  - hasUnsavedChanges() for the unsavedChangesGuard
 *
 * A page subclasses this and only defines its form, how an item maps to the
 * form, and how the form maps to the API input.
 */
@Directive()
export abstract class EntityFormPage<T extends { id: number }, TInput> implements OnInit {
  /** The :id route parameter; undefined on the "new" page. */
  readonly id = input<string>();

  protected readonly router = inject(Router);
  protected readonly notifications = inject(NotificationService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly saving = signal(false);
  /** Errors that do not belong to a single field. */
  protected readonly formErrors = signal<string[]>([]);

  protected abstract readonly form: FormGroup;
  protected abstract readonly api: CrudApi<T, TInput>;
  /** Where to go after saving or cancelling, e.g. '/admin/projects'. */
  protected abstract readonly listUrl: string;
  /** Human name for messages, e.g. 'Project'. */
  protected abstract readonly noun: string;

  /** Fills the form from an existing item (edit mode). */
  protected abstract patchForm(item: T): void;
  /** Builds the request body from the form's current value. */
  protected abstract toInput(): TInput;

  protected get isEdit(): boolean {
    return !!this.id();
  }

  ngOnInit(): void {
    if (this.isEdit) {
      this.load();
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.get(Number(this.id())).subscribe({
      next: (item) => {
        this.patchForm(item);
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(ApiError.from(err));
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    this.formErrors.set([]);
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }

    this.saving.set(true);
    const input = this.toInput();
    const request = this.isEdit
      ? this.api.update(Number(this.id()), input)
      : this.api.create(input);

    request.subscribe({
      next: () => {
        this.form.markAsPristine(); // lets the unsaved-changes guard pass
        this.saving.set(false);
        this.notifications.success(`${this.noun} ${this.isEdit ? 'updated' : 'created'}`);
        void this.router.navigateByUrl(this.listUrl);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const error = ApiError.from(err);
        if (error.isValidation) {
          this.formErrors.set(applyServerErrors(this.form, error));
          revealErrors(this.form);
        } else {
          this.formErrors.set([error.message]);
        }
      },
    });
  }

  protected cancel(): void {
    void this.router.navigateByUrl(this.listUrl);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}
