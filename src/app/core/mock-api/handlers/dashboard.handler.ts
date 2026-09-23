import type {
  BoothFillPoint,
  DashboardSummary,
  EmployerStage,
  KpiValue,
  PipelineStagePoint,
} from '../../models';
import { type MockHandler, noContent, ok } from '../mock-response';
import { resetMockDb } from '../mock-db';

const PIPELINE_STAGES: readonly EmployerStage[] = [
  'lead',
  'proposal',
  'confirmed',
  'paid',
  'lost',
];

/** Stages that count toward pipeline value; `lost` and `lead` do not. */
const VALUED_STAGES: ReadonlySet<EmployerStage> = new Set<EmployerStage>([
  'proposal',
  'confirmed',
  'paid',
]);

function kpi(value: number, deltaPct: number | null): KpiValue {
  return { value, deltaPct };
}

/**
 * `GET /dashboard/summary` — one request backs the whole dashboard, matching
 * what a single Laravel controller would return.
 *
 * Deltas are derived from the completed fair, which is the only prior period
 * this dataset has. Where no comparison exists the delta is null rather than
 * zero, so the card can omit it instead of implying "no change".
 */
export const getDashboardSummary: MockHandler = ({ db, now }) => {
  // Status AND dates. A fair whose dates have passed is not active however
  // its status reads — staff do not always close one out the day it ends, and
  // a card labelled "Active fairs" that counts last week's fair is wrong. The
  // same rule groups the fair list into Current, Past and Complete.
  const activeFairs = db.fairs.filter(
    (fair) =>
      (fair.status === 'open' || fair.status === 'live') && Date.parse(fair.endDate) >= now,
  );
  const previousFair = db.fairs.find((fair) => fair.status === 'completed') ?? null;

  const boothTotal = activeFairs.reduce((sum, fair) => sum + fair.boothTotal, 0);
  const boothAssigned = activeFairs.reduce((sum, fair) => sum + fair.boothAssigned, 0);
  const fillRate = boothTotal > 0 ? boothAssigned / boothTotal : 0;

  const registrations = activeFairs.reduce((sum, fair) => sum + fair.registrations, 0);

  const pipelineValue = db.employers
    .filter((employer) => VALUED_STAGES.has(employer.stage))
    .reduce((sum, employer) => sum + (employer.dealValueMyr ?? 0), 0);

  const previousFill =
    previousFair && previousFair.boothTotal > 0
      ? previousFair.boothAssigned / previousFair.boothTotal
      : null;

  const boothFillByFair: BoothFillPoint[] = activeFairs.map((fair) => ({
    fairId: fair.id,
    fairName: fair.name,
    boothTotal: fair.boothTotal,
    boothAssigned: fair.boothAssigned,
  }));

  const pipelineByStage: PipelineStagePoint[] = PIPELINE_STAGES.map((stage) => {
    const inStage = db.employers.filter((employer) => employer.stage === stage);
    return {
      stage,
      count: inStage.length,
      valueMyr: inStage.reduce((sum, employer) => sum + (employer.dealValueMyr ?? 0), 0),
    };
  });

  const summary: DashboardSummary = {
    upcomingFairs: kpi(activeFairs.length, null),
    boothFillRate: kpi(fillRate, previousFill === null ? null : fillRate - previousFill),
    registrations: kpi(
      registrations,
      previousFair && previousFair.registrations > 0
        ? (registrations - previousFair.registrations) / previousFair.registrations
        : null,
    ),
    pipelineValueMyr: kpi(pipelineValue, null),
    boothFillByFair,
    pipelineByStage,
  };

  return ok(summary);
};

/** `POST /demo/reset` — mock only. Reseeds every table from the fixed seed. */
export const resetDemo: MockHandler = ({ now }) => {
  resetMockDb(now);
  return noContent();
};
