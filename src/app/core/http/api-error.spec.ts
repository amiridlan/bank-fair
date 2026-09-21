import { HttpErrorResponse } from '@angular/common/http';

import { isValidationError, toApiError } from './api-error';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/employers' });
}

describe('toApiError', () => {
  it('maps a Laravel 422 into field errors keyed by camelCase name', () => {
    const error = httpError(422, {
      message: 'The contact email field is required.',
      errors: {
        contact_email: ['The contact email field is required.'],
        company_size: ['The company size field is required.'],
      },
    });

    const result = toApiError(error);

    expect(result.status).toBe(422);
    expect(result.message).toBe('The contact email field is required.');
    expect(result.fieldErrors).toEqual({
      contactEmail: ['The contact email field is required.'],
      companySize: ['The company size field is required.'],
    });
    expect(isValidationError(result)).toBe(true);
  });

  it('maps a 409 conflict, with no field errors', () => {
    const result = toApiError(httpError(409, { message: 'That slot was just booked.' }));

    expect(result.status).toBe(409);
    expect(result.message).toBe('That slot was just booked.');
    expect(result.fieldErrors).toEqual({});
    expect(isValidationError(result)).toBe(false);
  });

  it('maps a 404', () => {
    const result = toApiError(httpError(404, { message: 'Fair not found.' }));

    expect(result.status).toBe(404);
    expect(result.message).toBe('Fair not found.');
  });

  it('uses a connection message for status 0 rather than the raw error', () => {
    const result = toApiError(httpError(0, null));

    expect(result.status).toBe(0);
    expect(result.message).toBe('Could not reach the server. Check your connection and retry.');
  });

  it('falls back to a safe message when the body has none', () => {
    const result = toApiError(httpError(500, {}));

    expect(result.status).toBe(500);
    expect(result.message).toBeTruthy();
    expect(result.fieldErrors).toEqual({});
  });

  it('ignores a malformed errors object instead of throwing', () => {
    const result = toApiError(httpError(422, { message: 'Bad', errors: 'not-an-object' }));

    expect(result.fieldErrors).toEqual({});
  });

  it('drops non-string entries inside a field error array', () => {
    const result = toApiError(
      httpError(422, { message: 'Bad', errors: { contact_email: [42, 'Real message'] } }),
    );

    expect(result.fieldErrors).toEqual({ contactEmail: ['Real message'] });
  });

  it('maps a plain Error', () => {
    const result = toApiError(new Error('Boom'));

    expect(result).toEqual({ status: 0, message: 'Boom', fieldErrors: {} });
  });

  it('maps an unknown thrown value without throwing', () => {
    const result = toApiError('just a string');

    expect(result.status).toBe(0);
    expect(result.message).toBeTruthy();
  });
});
