import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiResponse } from '../models';

/**
 * Thin wrapper around HttpClient for the Go API. It unwraps the
 * { "data": ... } envelope, so services work with plain values.
 *
 * URLs are relative ('/api/...'): in development the Angular dev server
 * proxies them to the Go API, in production both are served from one origin.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<ApiResponse<T>>(url, { params }).pipe(map((res) => res.data));
  }

  post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(url, body).pipe(map((res) => res.data));
  }

  put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(url, body).pipe(map((res) => res.data));
  }

  /** DELETE returns 204 No Content, so there is nothing to unwrap. */
  delete(url: string): Observable<void> {
    return this.http.delete<void>(url);
  }
}
