import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/error-handler';
import { baseUrlInterceptor } from './core/http/base-url.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { mockApiInterceptor } from './core/mock-api/mock-api.interceptor';

// Must run before LOCALE_ID is used, or date and number pipes fall back to en-US.
registerLocaleData(localeEnMY);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      // Binds route params and query params straight to component `input()`s.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),

    provideHttpClient(
      withFetch(),
      withInterceptors([
        // Order matters. baseUrl rewrites the URL first; errorInterceptor then
        // wraps everything downstream of it, so it sees failures from the mock
        // API exactly as it will see them from Laravel.
        baseUrlInterceptor,
        errorInterceptor,
        // Last, so it short-circuits the request without bypassing the error
        // mapping above. Dropping it is the whole Laravel switchover.
        ...(environment.useMockApi ? [mockApiInterceptor] : []),
      ]),
    ),

    // Malaysia: dates as DD/MM/YYYY, times as h:mm a, currency as RM.
    { provide: LOCALE_ID, useValue: 'en-MY' },
    // en-GB so the datepicker parses typed input as DD/MM/YYYY rather than US order.
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },

    // Icons are Material Symbols Outlined (docs/03), not the legacy Material Icons.
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },

    // chart.js is deliberately NOT registered here. Providing it at the root
    // pulls the whole library into the initial bundle, which would defeat the
    // @defer blocks around the charts. The chart components provide it
    // themselves — see CHART_PROVIDERS.

    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
