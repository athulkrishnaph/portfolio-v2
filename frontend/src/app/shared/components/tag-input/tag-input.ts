import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Icon } from '../icon/icon';

/**
 * Form control for a list of short strings (e.g. project technologies).
 * Type a value and press Enter or comma to add it; Backspace in the empty
 * input removes the last one.
 *
 *   <app-tag-input formControlName="technologies" placeholder="Add technology" />
 */
@Component({
  selector: 'app-tag-input',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInput), multi: true }],
  templateUrl: './tag-input.html',
  styleUrl: './tag-input.scss',
})
export class TagInput implements ControlValueAccessor {
  readonly placeholder = input('Type and press Enter');
  readonly maxLength = input(50);
  /** Lets an outer <label for> point at the text field. */
  readonly inputId = input<string | null>(null);

  protected readonly tags = signal<string[]>([]);
  protected readonly disabled = signal(false);

  private onChange: (value: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  protected onKeydown(event: KeyboardEvent, field: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault(); // do not submit the form / type the comma
      this.commit(field);
    } else if (event.key === 'Backspace' && field.value === '' && this.tags().length) {
      this.remove(this.tags().length - 1);
    }
  }

  /** Adds the typed text as a tag, ignoring blanks and case-insensitive duplicates. */
  protected commit(field: HTMLInputElement): void {
    const value = field.value.trim();
    field.value = '';
    const exists = this.tags().some((t) => t.toLowerCase() === value.toLowerCase());
    if (value && !exists) {
      this.update([...this.tags(), value]);
    }
  }

  protected remove(index: number): void {
    this.update(this.tags().filter((_, i) => i !== index));
  }

  private update(tags: string[]): void {
    this.tags.set(tags);
    this.onChange(tags);
  }

  writeValue(value: string[] | null): void {
    this.tags.set(value ?? []);
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
