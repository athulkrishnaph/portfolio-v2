import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, shareReplay, tap, throwError } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { ApiError } from '../api/api-error';
import { Profile, ProfileInput } from '../models';

/**
 * The profile is shown on almost every public page (navbar, footer, home,
 * about, contact), so it is fetched once and cached for the whole session.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiClient);
  private cache$?: Observable<Profile | null>;

  /** Owner's name, used for the brand and page titles ('' until loaded). */
  readonly siteName = signal('');

  /** Emits the profile, or null if it has not been created yet (API 404). */
  get(): Observable<Profile | null> {
    this.cache$ ??= this.api.get<Profile>('/api/profile').pipe(
      catchError((err: unknown) =>
        err instanceof ApiError && err.isNotFound ? of(null) : throwError(() => err),
      ),
      tap((profile) => this.siteName.set(profile?.fullName ?? '')),
      // Share one request between all subscribers and replay the result.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cache$.pipe(
      catchError((err: unknown) => {
        this.cache$ = undefined; // do not cache failures, so "Retry" really retries
        return throwError(() => err);
      }),
    );
  }

  save(input: ProfileInput): Observable<Profile> {
    return this.api.put<Profile>('/api/profile', input).pipe(
      tap((profile) => {
        this.cache$ = of(profile);
        this.siteName.set(profile.fullName);
      }),
    );
  }
}
