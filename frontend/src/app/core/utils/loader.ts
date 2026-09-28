import { Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  OperatorFunction,
  catchError,
  combineLatest,
  filter,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { ApiError } from '../api/api-error';

/** The three states every data-driven page goes through. */
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'error'; error: ApiError };

/**
 * RxJS operator: turns a request into a stream of LoadStates:
 * loading → loaded(data), or loading → error.
 */
export function withLoadState<T>(): OperatorFunction<T, LoadState<T>> {
  return (source) =>
    source.pipe(
      map((data): LoadState<T> => ({ status: 'loaded', data })),
      startWith<LoadState<T>>({ status: 'loading' }),
      catchError((err: unknown) => of<LoadState<T>>({ status: 'error', error: ApiError.from(err) })),
    );
}

/**
 * Loads data for a component and exposes it as signals:
 *
 *   readonly projects = new Loader(() => this.projectsService.list());
 *
 *   @if (projects.loading()) { <app-spinner /> }
 *   @else if (projects.error(); as error) { <app-error-state [error]="error" (retry)="projects.reload()" /> }
 *   @else if (projects.data(); as list) { ... }
 *
 * With a `params$` stream (e.g. a route parameter), the request re-runs when
 * the parameter changes, and switchMap cancels a request that is still
 * running for the previous value.
 *
 * Must be created in an injection context (a field initializer or constructor).
 */
export class Loader<T, P = void> {
  /** Emits on reload; `true` means "silent" (keep showing the current data). */
  private readonly reload$ = new BehaviorSubject<boolean>(false);

  readonly state: Signal<LoadState<T>>;
  readonly loading = computed(() => this.state().status === 'loading');
  readonly data = computed(() => {
    const s = this.state();
    return s.status === 'loaded' ? s.data : undefined;
  });
  readonly error = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.error : undefined;
  });

  constructor(request: (params: P) => Observable<T>, params$?: Observable<P>) {
    const source$ = combineLatest([params$ ?? of(undefined as P), this.reload$]).pipe(
      switchMap(([params, silent]) =>
        request(params).pipe(
          withLoadState(),
          // A silent refresh skips the "loading" state, so lists do not flash.
          filter((state) => !(silent && state.status === 'loading')),
        ),
      ),
    );
    this.state = toSignal(source$, { initialValue: { status: 'loading' } as LoadState<T> });
  }

  /** Runs the request again, showing the loading state (e.g. "Try again"). */
  reload(): void {
    this.reload$.next(false);
  }

  /** Re-fetches in the background, keeping the current data visible meanwhile. */
  refresh(): void {
    this.reload$.next(true);
  }
}
