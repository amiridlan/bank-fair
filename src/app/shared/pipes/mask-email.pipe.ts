import { Pipe, PipeTransform } from '@angular/core';

/**
 * Masks an email for list views: `nur.aisyah@example.com` -> `n***@example.com`.
 *
 * This is presentation only. The API is what actually withholds contact
 * details until the employer has shortlisted the candidate — a pipe cannot be
 * a privacy control, since the unmasked value would still reach the browser.
 */
@Pipe({ name: 'maskEmail' })
export class MaskEmailPipe implements PipeTransform {
  transform(email: string | null | undefined): string {
    if (!email) {
      return '';
    }

    const atIndex = email.lastIndexOf('@');
    // Not an address we recognise — mask the whole thing rather than leak it.
    if (atIndex <= 0) {
      return '***';
    }

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);

    return `${local[0]}***${domain}`;
  }
}
