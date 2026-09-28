import { Component, Directive, inject, input } from '@angular/core';
import { AbstractControl, NgControl, Validators } from '@angular/forms';

import { controlErrorMessage } from '../../../core/utils/forms';

let nextId = 0;

/**
 * Label + control + hint/error message, with the accessibility wiring done
 * automatically:
 *
 *   <app-form-field label="Title" hint="Shown on the project card">
 *     <input appInput class="input" formControlName="title" />
 *   </app-form-field>
 *
 * The appInput directive links the <input> to the label (id/for), marks it
 * aria-invalid and points aria-describedby at the error or hint text.
 * For custom controls without appInput, pass the control via [control].
 *
 * Uses default change detection on purpose: reactive-form status is not a
 * signal, so the field re-checks whenever its form re-renders.
 */
@Component({
  selector: 'app-form-field',
  template: `
    <label class="field__label" [attr.for]="inputId">
      {{ label() }}
      @if (isRequired()) {
        <span class="field__required" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (errorMessage(); as message) {
      <p class="field__error" [id]="messageId">{{ message }}</p>
    } @else if (hint()) {
      <p class="field__hint" [id]="messageId">{{ hint() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }
    .field__label {
      font-size: var(--text-sm);
      font-weight: 600;
    }
    .field__required {
      color: var(--color-danger);
    }
    .field__hint,
    .field__error {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    .field__error {
      color: var(--color-danger);
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly hint = input('');
  /** Only needed when the control has no appInput directive. */
  readonly control = input<AbstractControl | null>(null);

  readonly inputId = `field-${nextId++}`;
  readonly messageId = `${this.inputId}-message`;

  /** Set by the appInput directive. */
  ngControl: NgControl | null = null;

  private get resolvedControl(): AbstractControl | null {
    return this.control() ?? this.ngControl?.control ?? null;
  }

  /** Errors are shown once the user has interacted with the field (or tried to submit). */
  errorMessage(): string | null {
    const c = this.resolvedControl;
    return c && c.invalid && (c.touched || c.dirty) ? controlErrorMessage(c, this.label()) : null;
  }

  isRequired(): boolean {
    return this.resolvedControl?.hasValidator(Validators.required) ?? false;
  }

  hasMessage(): boolean {
    return this.errorMessage() !== null || this.hint() !== '';
  }
}

/** Connects an <input>/<select>/<textarea> to its surrounding <app-form-field>. */
@Directive({
  selector: 'input[appInput], textarea[appInput], select[appInput]',
  host: {
    '[id]': 'field.inputId',
    '[attr.aria-invalid]': 'field.errorMessage() ? "true" : null',
    '[attr.aria-describedby]': 'field.hasMessage() ? field.messageId : null',
  },
})
export class FormInput {
  protected readonly field = inject(FormField);

  constructor() {
    this.field.ngControl = inject(NgControl, { self: true, optional: true });
  }
}
