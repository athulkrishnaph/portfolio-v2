import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { AuthOptions, ChangePasswordInput, LoginInput, Session, User } from '../models';

const STORAGE_KEY = 'portfolio.session';
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Holds the admin session (JWT + user) and exposes it as signals.
 *
 * Storage choice: the session is kept in localStorage so a page refresh does
 * not log the admin out. The token is short-lived (JWT_TTL on the server),
 * is only ever sent to our own /api (see authInterceptor), and Angular's
 * template sanitisation protects against the XSS that could read it.
 * Logging out simply forgets the token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;

  /** The signed-in admin, or null. */
  readonly user = computed<User | null>(() => this.session()?.user ?? null);

  constructor() {
    const stored = readStoredSession();
    if (stored && !isExpired(stored)) {
      this.setSession(stored);
    } else {
      clearStoredSession();
    }
  }

  /** True when a session exists and has not expired. */
  isAuthenticated(): boolean {
    const s = this.session();
    return s !== null && !isExpired(s);
  }

  /** The bearer token for API requests, or null when logged out. */
  token(): string | null {
    return this.isAuthenticated() ? this.session()!.token : null;
  }

  login(input: LoginInput): Observable<User> {
    return this.api.post<Session>('/api/auth/login', input).pipe(
      tap((session) => this.setSession(session)),
      map((session) => session.user),
    );
  }

  /** Signs in with the ID token ("credential") from Google Identity Services. */
  loginWithGoogle(credential: string): Observable<User> {
    return this.api.post<Session>('/api/auth/google', { credential }).pipe(
      tap((session) => this.setSession(session)),
      map((session) => session.user),
    );
  }

  /** Sign-in methods enabled on the server. */
  options(): Observable<AuthOptions> {
    return this.api.get<AuthOptions>('/api/auth/options');
  }

  /** Changes the password. The server returns a new token (old ones stop working). */
  changePassword(input: ChangePasswordInput): Observable<void> {
    return this.api.put<Session>('/api/auth/password', input).pipe(
      tap((session) => this.setSession(session)),
      map(() => undefined),
    );
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/admin/login']);
  }

  /**
   * Called when the API rejects our token (expired, password changed
   * elsewhere). Sends the admin to the login page and back afterwards.
   */
  expireSession(): void {
    if (!this.session()) {
      return;
    }
    const returnUrl = this.router.url;
    this.clear();
    void this.router.navigate(['/admin/login'], {
      queryParams: { returnUrl, reason: 'expired' },
    });
  }

  private setSession(session: Session): void {
    this.session.set(session);
    writeStoredSession(session);
    this.scheduleExpiry(session);
  }

  /** Logs out automatically the moment the token expires. */
  private scheduleExpiry(session: Session): void {
    clearTimeout(this.expiryTimer);
    // setTimeout overflows above ~24.8 days, so long waits are split up.
    const msLeft = new Date(session.expiresAt).getTime() - Date.now();
    const delay = Math.min(Math.max(msLeft, 0), MAX_TIMEOUT_MS);
    this.expiryTimer = setTimeout(
      () => (isExpired(session) ? this.expireSession() : this.scheduleExpiry(session)),
      delay,
    );
  }

  private clear(): void {
    clearTimeout(this.expiryTimer);
    this.session.set(null);
    clearStoredSession();
  }
}

function isExpired(session: Session): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

// localStorage can throw (private mode, disabled storage), so every access is
// guarded; the app then simply keeps the session in memory only.

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Session>) : null;
    return parsed?.token && parsed.expiresAt && parsed.user ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
