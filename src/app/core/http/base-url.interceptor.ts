import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/**
 * Prefixes relative request paths with the configured API base URL, so stores
 * can call `/fairs` and stay unaware of where the backend lives.
 *
 * Absolute URLs pass through untouched — Google Fonts and any future CDN call
 * must not be rewritten.
 */
export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }

  const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return next(req.clone({ url: `${environment.apiBaseUrl}${path}` }));
};
