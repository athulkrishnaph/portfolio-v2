import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

import { ApiError } from '../api/api-error';

/**
 * Client-side validators. They mirror the Go API's rules for instant
 * feedback; the API still validates everything itself.
 */
export const AppValidators = {
  /** Empty, or an absolute http(s) URL. */
  url: ((control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = control.value?.trim();
    if (!value) {
      return null;
    }
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.host
        ? null
        : { url: true };
    } catch {
      return { url: true };
    }
  }) satisfies ValidatorFn,

  /** Lowercase letters/numbers separated by single hyphens (empty is allowed). */
  slug: ((control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = control.value?.trim();
    return !value || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? null : { slug: true };
  }) satisfies ValidatorFn,

  /** Rejects values that are only whitespace (Validators.required accepts '  '). */
  notBlank: ((control: AbstractControl<string | null>): ValidationErrors | null =>
    typeof control.value === 'string' && control.value.trim() === '' && control.value !== ''
      ? { required: true }
      : null) satisfies ValidatorFn,

  /**
   * Group validator: the end date must not be before the start date.
   * The error is set on the end date control so it shows next to that field.
   */
  dateOrder(startKey: string, endKey: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const start = group.get(startKey)?.value as string | null;
      const endControl = group.get(endKey);
      const end = endControl?.value as string | null;
      if (!endControl || !start || !end || endControl.disabled) {
        return null;
      }
      // 'YYYY-MM-DD' strings compare in date order.
      if (end < start) {
        endControl.setErrors({ ...endControl.errors, dateOrder: true });
        return { dateOrder: true };
      }
      if (endControl.hasError('dateOrder')) {
        const { dateOrder: _removed, ...rest } = endControl.errors ?? {};
        endControl.setErrors(Object.keys(rest).length ? rest : null);
      }
      return null;
    };
  },
};

/** Turns a control's first error into a readable message. */
export function controlErrorMessage(control: AbstractControl, label: string): string | null {
  const e = control.errors;
  if (!e) {
    return null;
  }
  if (e['server']) return e['server'] as string;
  if (e['required']) return `${label} is required`;
  if (e['maxlength']) return `${label} must be at most ${e['maxlength'].requiredLength} characters`;
  if (e['minlength']) return `${label} must be at least ${e['minlength'].requiredLength} characters`;
  if (e['email']) return 'Enter a valid email address';
  if (e['url']) return 'Enter a full URL starting with http:// or https://';
  if (e['slug']) return 'Use lowercase letters, numbers and single hyphens, e.g. my-project';
  if (e['min']) return `${label} must be at least ${e['min'].min}`;
  if (e['max']) return `${label} must be at most ${e['max'].max}`;
  if (e['dateOrder']) return 'End date must be on or after the start date';
  if (e['mismatch']) return 'The passwords do not match';
  return `${label} is invalid`;
}

/**
 * Shows the API's per-field validation messages next to the matching form
 * controls. Keys use dot paths, so 'socialLinks.1.url' reaches the url
 * control of the second link in a FormArray.
 *
 * Returns messages that did not match any control, so the caller can show
 * them in a general error area.
 */
export function applyServerErrors(form: AbstractControl, error: ApiError): string[] {
  const unmatched: string[] = [];
  for (const [path, message] of Object.entries(error.details)) {
    const control = form.get(path);
    if (control) {
      control.setErrors({ server: message });
      control.markAsTouched();
    } else {
      unmatched.push(message);
    }
  }
  return unmatched;
}

/** Marks every control touched so all validation messages become visible. */
export function revealErrors(form: FormGroup): void {
  form.markAllAsTouched();
  // Move keyboard focus to the first invalid field (accessibility).
  queueMicrotask(() =>
    document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus(),
  );
}
