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
  template: `
    <div class="upload">
      <div class="upload__preview" [class.upload__preview--doc]="kind() === 'document'">
        @if (value() && kind() === 'image') {
          <img [src]="value()" alt="Current image" />
        } @else if (value()) {
          <a [href]="value()" target="_blank" rel="noopener"><app-icon name="file" [size]="28" /></a>
        } @else {
          <app-icon [name]="kind() === 'image' ? 'image' : 'file'" [size]="28" />
        }
      </div>

      <div class="upload__controls">
        <div class="upload__buttons">
          <input
            #fileInput
            type="file"
            class="visually-hidden"
            tabindex="-1"
            [accept]="accept()"
            (change)="onFileSelected(fileInput)"
          />
          <button
            appButton
            type="button"
            size="sm"
            [loading]="uploading()"
            [disabled]="disabled()"
            (click)="fileInput.click()"
          >
            <app-icon name="upload" [size]="16" />
            {{ value() ? 'Replace' : 'Upload' }} {{ kind() === 'image' ? 'image' : 'PDF' }}
          </button>
          @if (value()) {
            <button appButton type="button" size="sm" variant="ghost" [disabled]="disabled()" (click)="setValue('')">
              <app-icon name="trash" [size]="16" /> Remove
            </button>
          }
        </div>
        <input
          class="input"
          type="url"
          placeholder="…or paste a URL (https://…)"
          [attr.aria-label]="'URL of the ' + (kind() === 'image' ? 'image' : 'file')"
          [value]="value()"
          [disabled]="disabled()"
          (change)="onUrlTyped($event)"
          (blur)="onTouched()"
        />
        <p class="upload__hint" [class.upload__hint--error]="error()">
          {{ error() || hint() }}
        </p>
      </div>
    </div>
  `,
  styles: `
    .upload {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      align-items: flex-start;
    }
    .upload__preview {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 160px;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-muted);
    }
    .upload__preview--doc {
      width: 80px;
    }
    .upload__preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .upload__controls {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 220px;
    }
    .upload__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .upload__hint {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    .upload__hint--error {
      color: var(--color-danger);
    }
  `,
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
