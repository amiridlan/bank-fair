import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../environments/environment';

/**
 * Catches errors no `catchError` handled — template failures, bugs in effects,
 * anything unexpected.
 *
 * Logs the full error to the console in development only: a production console
 * dump can leak internals, and the user cannot act on a stack trace either
 * way. They get a plain apology instead.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly snackBar = inject(MatSnackBar);

  handleError(error: unknown): void {
    if (!environment.production) {
      console.error('[BankFair] Unhandled error:', error);
    }

    this.snackBar.open('Something unexpected happened. Reload the page if it persists.', 'Dismiss', {
      duration: 8000,
      politeness: 'assertive',
    });
  }
}
