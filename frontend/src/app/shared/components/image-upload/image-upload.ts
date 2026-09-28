import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { ApiError } from '../../../core/api/api-error';
import { DOCUMENT_TYPES, IMAGE_TYPES, UploadsService } from '../../../core/services/uploads.service';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

/**
 * Form control for an image (or PDF) URL. The admin can upload a file (it is
 * sent to POST /api/uploads immediately and the returned URL becomes the
 * value) or paste an existing URL.
 *
 *   <app-image-upload formControlName="imageUrl" />
 *   <app-image-upload formControlName="resumeUrl" kind="document" />
 */
@Component({
  selector: 'app-image-upload',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ImageUpload), multi: true },
  ],
  templateUrl: './image-upload.html',
  styleUrl: './image-upload.scss',
})
export class ImageUpload implements ControlValueAccessor {
  private readonly uploads = inject(UploadsService);

  readonly kind = input<'image' | 'document'>('image');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal('');

  protected readonly accept = computed(() =>
    (this.kind() === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES).join(','),
  );
  protected readonly hint = computed(() =>
    this.kind() === 'image' ? 'JPEG, PNG, GIF or WebP, up to 5 MB.' : 'PDF, up to 5 MB.',
  );

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = ''; // allow selecting the same file again later
    if (!file) {
      return;
    }
    const types = this.kind() === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES;
    this.error.set('');
    this.uploading.set(true);
    this.uploads.upload(file, types).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.setValue(result.url);
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.error.set(ApiError.from(err).message);
      },
    });
  }

  protected onUrlTyped(event: Event): void {
    this.setValue((event.target as HTMLInputElement).value.trim());
  }

  protected setValue(value: string): void {
    this.error.set('');
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  // ---- ControlValueAccessor: how Angular forms talk to this component ----

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
