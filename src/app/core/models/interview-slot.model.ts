export interface InterviewSlot {
  readonly id: string;
  readonly fairId: string;
  readonly employerId: string;
  /** ISO 8601 with the +08:00 offset. Slots are 20 minutes, 10:00–17:00. */
  readonly startTime: string;
  readonly endTime: string;
  /** `null` when the slot is open. */
  readonly candidateId: string | null;
  readonly candidateName: string | null;
}
