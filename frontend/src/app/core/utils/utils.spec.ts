import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, of, throwError, toArray } from 'rxjs';

import { ApiError } from '../api/api-error';
import { AppValidators, applyServerErrors, controlErrorMessage } from './forms';
import { LoadState, withLoadState } from './loader';

describe('AppValidators', () => {
  it('url accepts empty and http(s) URLs only', () => {
    const check = (v: string) => AppValidators.url(new FormControl(v));
    expect(check('')).toBeNull();
    expect(check('https://github.com/me')).toBeNull();
    expect(check('github.com/me')).toEqual({ url: true });
    expect(check('javascript:alert(1)')).toEqual({ url: true });
  });

  it('slug follows the API rule', () => {
    const check = (v: string) => AppValidators.slug(new FormControl(v));
    expect(check('my-project-2')).toBeNull();
    expect(check('My Project')).toEqual({ slug: true });
    expect(check('double--dash')).toEqual({ slug: true });
  });

  it('dateOrder flags an end date before the start date', () => {
    const group = new FormGroup(
      { start: new FormControl('2024-05-01'), end: new FormControl('2024-04-30') },
      { validators: AppValidators.dateOrder('start', 'end') },
    );
    expect(group.controls.end.hasError('dateOrder')).toBe(true);

    group.controls.end.setValue('2024-06-01');
    expect(group.controls.end.valid).toBe(true);
  });
});

describe('applyServerErrors', () => {
  it('puts API messages on matching controls, including FormArray paths', () => {
    const form = new FormGroup({
      title: new FormControl(''),
      links: new FormGroup({ '0': new FormGroup({ url: new FormControl('') }) }),
    });
    const error = new ApiError(422, 'VALIDATION_FAILED', 'invalid', {
      title: 'Title is required',
      'links.0.url': 'URL is invalid',
      unknown: 'Something else',
    });

    const unmatched = applyServerErrors(form, error);

    expect(controlErrorMessage(form.controls.title, 'Title')).toBe('Title is required');
    expect(form.get('links.0.url')?.errors).toEqual({ server: 'URL is invalid' });
    expect(unmatched).toEqual(['Something else']);
  });
});

describe('ApiError.from', () => {
  it('reads the API error envelope', () => {
    const err = ApiError.from(
      new HttpErrorResponse({
        status: 404,
        error: { error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
      }),
    );
    expect(err.code).toBe('PROJECT_NOT_FOUND');
    expect(err.isNotFound).toBe(true);
  });

  it('explains network failures', () => {
    expect(ApiError.from(new HttpErrorResponse({ status: 0 })).code).toBe('NETWORK_ERROR');
  });
});

describe('withLoadState', () => {
  it('emits loading then loaded', async () => {
    const states = await firstValueFrom(of([1, 2]).pipe(withLoadState(), toArray()));
    expect(states).toEqual([{ status: 'loading' }, { status: 'loaded', data: [1, 2] }]);
  });

  it('emits loading then error, converting to ApiError', async () => {
    const states = await firstValueFrom(
      throwError(() => new Error('boom')).pipe(withLoadState(), toArray()),
    );
    const last = states[1] as Extract<LoadState<unknown>, { status: 'error' }>;
    expect(last.status).toBe('error');
    expect(last.error).toBeInstanceOf(ApiError);
  });

  it('does not complete while the request is pending', () => {
    const pending = new Subject<number>();
    const seen: string[] = [];
    pending.pipe(withLoadState()).subscribe((s) => seen.push(s.status));
    expect(seen).toEqual(['loading']);
    pending.next(1);
    expect(seen).toEqual(['loading', 'loaded']);
  });
});
