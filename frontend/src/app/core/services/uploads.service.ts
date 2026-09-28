import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { ApiError } from '../api/api-error';

export interface UploadResult {
  url: string;
  contentType: string;
  size: number;
}

/** Same limits as the Go API (internal/uploads). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const DOCUMENT_TYPES = ['application/pdf'];

@Injectable({ providedIn: 'root' })
export class UploadsService {
  private readonly api = inject(ApiClient);

  /**
   * Uploads a file and returns its public URL. The type and size are checked
   * here for fast feedback; the server checks them again (it never trusts
   * the browser).
   */
  upload(file: File, allowedTypes: string[] = IMAGE_TYPES): Observable<UploadResult> {
    if (!allowedTypes.includes(file.type)) {
      return throwError(
        () => new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed.'),
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return throwError(
        () => new ApiError(413, 'FILE_TOO_LARGE', 'The file must be 5 MB or smaller.'),
      );
    }
    const form = new FormData();
    form.append('file', file);
    return this.api.post<UploadResult>('/api/uploads', form);
  }
}
