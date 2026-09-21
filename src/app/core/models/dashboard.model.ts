import type { EmployerStage } from './employer.model';

/** One KPI card's value plus its period-over-period change. */
export interface KpiValue {
  readonly value: number;
  /** -1..1, or `null` when there is no baseline to compare against. */
  readonly deltaPct: number | null;
}

export interface BoothFillPoint {
  readonly fairId: string;
  readonly fairName: string;
  readonly boothTotal: number;
  readonly boothAssigned: number;
}

export interface PipelineStagePoint {
  readonly stage: EmployerStage;
  readonly count: number;
  readonly valueMyr: number;
}

/**
 * Payload of `GET /dashboard/summary`. One request backs the whole dashboard,
 * matching what a single Laravel controller would realistically return.
 */
export interface DashboardSummary {
  /** Fairs with status `open` or `live`. */
  readonly upcomingFairs: KpiValue;
  /** 0..1 across `open` and `live` fairs. */
  readonly boothFillRate: KpiValue;
  readonly registrations: KpiValue;
  /** Sum of `dealValueMyr` for stage >= proposal, excluding `lost`. */
  readonly pipelineValueMyr: KpiValue;
  readonly boothFillByFair: readonly BoothFillPoint[];
  readonly pipelineByStage: readonly PipelineStagePoint[];
}
