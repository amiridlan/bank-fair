import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import type { FairExhibitor } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ExhibitorCardComponent } from '../components/exhibitor-card.component';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';

/**
 * Who is on the floor at this fair (docs/11 J2).
 *
 * The parent shell has already loaded them, so this reads the store rather
 * than fetching again — the same arrangement as the staff fair tabs.
 *
 * Filtering is client-side because the whole list is already here: a fair caps
 * at 40 stands, so a round trip per keystroke would be slower and no more
 * correct.
 */
@Component({
  selector: 'app-seeker-fair-exhibitors-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    EmptyStateComponent,
    ExhibitorCardComponent,
  ],
  templateUrl: './seeker-fair-exhibitors-tab.component.html',
  styleUrl: './seeker-fair-exhibitors-tab.component.scss',
})
export default class SeekerFairExhibitorsTabComponent {
  protected readonly store = inject(SeekerFairDetailStore);
  protected readonly search = signal('');

  protected readonly visible = computed<readonly FairExhibitor[]>(() => {
    const term = this.search().toLowerCase().trim();
    const exhibitors = this.store.exhibitors();
    if (!term) {
      return exhibitors;
    }
    return exhibitors.filter((exhibitor) =>
      `${exhibitor.name} ${exhibitor.industry} ${exhibitor.boothCode}`
        .toLowerCase()
        .includes(term),
    );
  });

  protected readonly isFiltered = computed(() => this.search().trim().length > 0);

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.search.set('');
  }
}
