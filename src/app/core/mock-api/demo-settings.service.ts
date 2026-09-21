import { Injectable, signal } from '@angular/core';

/** Roughly one request in five fails when simulated errors are on. */
export const SIMULATED_ERROR_RATE = 0.2;

/**
 * Demo-only switches.
 *
 * The simulated-error toggle exists so the error states and Retry paths can be
 * shown on demand rather than hoped for. It starts on when the app is opened
 * with `?simulateErrors=1`, and can also be flipped from the role menu.
 */
@Injectable({ providedIn: 'root' })
export class DemoSettingsService {
  private readonly _simulateErrors = signal(readInitialFlag());

  readonly simulateErrors = this._simulateErrors.asReadonly();

  toggleSimulatedErrors(): void {
    this._simulateErrors.update((on) => !on);
  }

  setSimulatedErrors(on: boolean): void {
    this._simulateErrors.set(on);
  }
}

function readInitialFlag(): boolean {
  // Guarded because this also runs under jsdom and would run under SSR.
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return new URLSearchParams(window.location.search).get('simulateErrors') === '1';
  } catch {
    return false;
  }
}
