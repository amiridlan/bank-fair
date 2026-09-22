import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Wraps a button's label so the button can show it is working.
 *
 * Goes INSIDE the call site's own button rather than replacing it:
 *
 * ```html
 * <button matButton="filled" [disabled]="busy()" (click)="save()">
 *   <app-busy-label [busy]="busy()">Save profile</app-busy-label>
 * </button>
 * ```
 *
 * Every action in this app disables its button while the request is in
 * flight, which on its own is almost invisible — with the mock API's 300–800ms
 * latency people could not tell whether their click had registered.
 *
 * The spinner is positioned against this host, not the Material button, so
 * nothing here depends on a Material internal. The label keeps its space and
 * only fades, so the button does not resize and shift the thing the pointer
 * is still over — and, because `opacity` leaves it in the accessibility tree,
 * the button keeps its name while busy.
 *
 * CSS rather than `mat-progress-spinner`, which costs around 10 kB in the
 * initial bundle against a budget with under 11 kB of room. The ring is the
 * shared `.fo-spinner` helper in styles.scss.
 */
@Component({
  selector: 'app-busy-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
  template: `
    <span class="label" [class.label--busy]="busy()"><ng-content /></span>
    @if (busy()) {
      <span class="fo-spinner spinner" aria-hidden="true"></span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .label {
      transition: opacity var(--fo-motion-fast) var(--fo-motion-easing);
    }

    /* Faded, not removed: the width stays, so the button does not resize, and
       the text stays in the accessibility tree so the button keeps its name. */
    .label--busy {
      opacity: 0.35;
    }

    /* The ring itself is the shared .fo-spinner helper; this only places it. */
    .spinner {
      position: absolute;
    }
  `,
})
export class BusyLabelComponent {
  readonly busy = input.required<boolean>();
}
