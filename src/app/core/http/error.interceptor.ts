import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

import { isValidationError, toApiError } from './api-error';

/**
 * Turns every failed request into an `ApiError` and surfaces a snackbar for the
 * ones a user cannot act on in place.
 *
 * 422 is deliberately silent here: those are field-level validation errors and
 * belong on the form's controls, not in a toast. 409 is silent too — a
 * conflict ("that slot was just booked") is a normal outcome the calling flow
 * handles with its own message and a refreshed view.
 *
 * The error is always re-thrown so the store can still set its own `error`
 * signal and render the view's error state.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);

      if (!isValidationError(apiError) && apiError.status !== 409) {
        snackBar.open(apiError.message, 'Dismiss', {
          duration: 6000,
          politeness: 'assertive',
        });
      }

      return throwError(() => apiError);
    }),
  );
};
