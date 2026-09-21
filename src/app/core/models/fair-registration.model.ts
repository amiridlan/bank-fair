/**
 * A job seeker's registration for a fair.
 *
 * A row rather than an entry in `Candidate.fairIds` because consent has to be
 * recorded with a time: PDPA 2010 wants consent that can be shown to have been
 * given, for a stated purpose, at a point in time. `fairIds` is kept in step by
 * the handler so the talent-pool filter keeps working off one field.
 */
export interface FairRegistration {
  readonly id: string;
  readonly fairId: string;
  readonly candidateId: string;
  readonly registeredAt: string;
  /**
   * When this person agreed that employers at this fair may see their profile.
   * Never null: a registration cannot exist without it.
   */
  readonly consentedAt: string;
}
