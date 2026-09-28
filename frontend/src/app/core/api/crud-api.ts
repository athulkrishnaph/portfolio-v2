import { inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from './api-client';

/**
 * Base class for resources with the standard REST endpoints:
 *
 *   GET    {path}         list
 *   GET    {path}/{id}    get
 *   POST   {path}         create
 *   PUT    {path}/{id}    update
 *   DELETE {path}/{id}    delete
 *
 * A concrete service only sets `path`, e.g. '/api/certificates'.
 */
export abstract class CrudApi<T, TInput> {
  protected readonly api = inject(ApiClient);
  protected abstract readonly path: string;

  list(): Observable<T[]> {
    return this.api.get<T[]>(this.path);
  }

  get(id: number): Observable<T> {
    return this.api.get<T>(`${this.path}/${id}`);
  }

  create(input: TInput): Observable<T> {
    return this.api.post<T>(this.path, input);
  }

  update(id: number, input: TInput): Observable<T> {
    return this.api.put<T>(`${this.path}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.api.delete(`${this.path}/${id}`);
  }
}
