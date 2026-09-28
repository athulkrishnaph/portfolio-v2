import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';

import { errorInterceptor } from '../api/error.interceptor';
import { Session } from '../models';
import { authGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

function session(msFromNow: number): Session {
  return {
    token: 'jwt-token',
    expiresAt: new Date(Date.now() + msFromNow).toISOString(),
    user: { id: 1, email: 'admin@example.com', createdAt: '', updatedAt: '' },
  };
}

describe('Authentication', () => {
  let http: HttpTestingController;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());

  describe('AuthService', () => {
    it('stores the session after a successful login', () => {
      const auth = setup();
      let email = '';
      auth.login({ email: 'admin@example.com', password: 'secret' }).subscribe((u) => (email = u.email));

      http.expectOne('/api/auth/login').flush({ data: session(60_000) });

      expect(email).toBe('admin@example.com');
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.token()).toBe('jwt-token');
      expect(localStorage.getItem('portfolio.session')).toContain('jwt-token');
    });

    it('restores a stored session on startup, but not an expired one', () => {
      localStorage.setItem('portfolio.session', JSON.stringify(session(60_000)));
      expect(setup().isAuthenticated()).toBe(true);

      TestBed.resetTestingModule();
      localStorage.setItem('portfolio.session', JSON.stringify(session(-1000)));
      expect(setup().isAuthenticated()).toBe(false);
      expect(localStorage.getItem('portfolio.session')).toBeNull();
    });

    it('logout forgets the token', () => {
      localStorage.setItem('portfolio.session', JSON.stringify(session(60_000)));
      const auth = setup();
      auth.logout();
      expect(auth.token()).toBeNull();
      expect(localStorage.getItem('portfolio.session')).toBeNull();
    });
  });

  describe('authInterceptor', () => {
    it('adds the bearer token to /api requests only', () => {
      localStorage.setItem('portfolio.session', JSON.stringify(session(60_000)));
      setup();
      const client = TestBed.inject(HttpClient);

      client.get('/api/projects').subscribe();
      client.get('https://example.com/data').subscribe();

      expect(http.expectOne('/api/projects').request.headers.get('Authorization')).toBe(
        'Bearer jwt-token',
      );
      expect(http.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(
        false,
      );
    });

    it('ends the session when the API answers 401', () => {
      localStorage.setItem('portfolio.session', JSON.stringify(session(60_000)));
      const auth = setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      TestBed.inject(HttpClient).get('/api/auth/me').subscribe({ error: () => {} });
      http
        .expectOne('/api/auth/me')
        .flush({ error: { code: 'INVALID_TOKEN', message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });

      expect(auth.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/admin/login'], expect.anything());
    });
  });

  describe('authGuard', () => {
    const runGuard = () =>
      TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/admin/projects' } as never),
      );

    it('allows signed-in admins', () => {
      localStorage.setItem('portfolio.session', JSON.stringify(session(60_000)));
      setup();
      expect(runGuard()).toBe(true);
    });

    it('redirects visitors to the login page with a returnUrl', () => {
      setup();
      const result = runGuard() as UrlTree;
      expect(result.toString()).toBe('/admin/login?returnUrl=%2Fadmin%2Fprojects');
    });
  });
});
