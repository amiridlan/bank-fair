import type { Booth, Employer, FairExhibitor, FairJobOpening } from '../../models';
import {
  type MockHandler,
  notFound,
  ok,
  okList,
  paginate,
  readPageRequest,
} from '../mock-response';

/** `GET /fairs` — optional `status` and `city` filters. */
export const listFairs: MockHandler = ({ db, query }) => {
  const status = query.get('status');
  const city = query.get('city');

  const fairs = db.fairs.filter(
    (fair) => (!status || fair.status === status) && (!city || fair.city === city),
  );

  return okList(fairs);
};

/** `GET /fairs/{id}`. */
export const getFair: MockHandler = ({ db, params }) => {
  const fair = db.fairs.find((candidate) => candidate.id === params['id']);
  return fair ? ok(fair) : notFound('Fair not found.');
};

/** `GET /fairs/{id}/booths` — ordered by grid position, not insertion order. */
export const listFairBooths: MockHandler = ({ db, params }) => {
  const fairId = params['id'];
  if (!db.fairs.some((fair) => fair.id === fairId)) {
    return notFound('Fair not found.');
  }

  const booths = db.booths
    .filter((booth) => booth.fairId === fairId)
    .sort((a: Booth, b: Booth) => a.row - b.row || a.col - b.col);

  return okList(booths);
};

/**
 * `GET /fairs/{id}/exhibitors` — the employers a visitor will find on the day.
 *
 * Attending means holding a booth, not appearing in `Employer.fairIds`
 * (docs/11 J-D3). `fairIds` includes leads who were never accepted, so listing
 * from it would advertise companies who are not coming. Booths are also what
 * the rest of the app already means by attending — the fair card counts
 * `boothAssigned` as "employers attending" — and they carry the code a visitor
 * needs to find the stand.
 *
 * Open to every role. Nothing in `FairExhibitor` is commercial: the projection
 * is the protection (J-D1), so there is no view to gate.
 */
export const listFairExhibitors: MockHandler = ({ db, params }) => {
  const fairId = params['id'];
  if (!db.fairs.some((fair) => fair.id === fairId)) {
    return notFound('Fair not found.');
  }

  const byId = new Map<string, Employer>(db.employers.map((employer) => [employer.id, employer]));

  const exhibitors = db.booths
    .filter((booth) => booth.fairId === fairId && booth.employerId !== null)
    .sort((a: Booth, b: Booth) => a.row - b.row || a.col - b.col)
    .flatMap<FairExhibitor>((booth) => {
      const employer = byId.get(booth.employerId as string);
      if (!employer) {
        return [];
      }
      return [
        {
          employerId: employer.id,
          name: employer.name,
          industry: employer.industry,
          companySize: employer.companySize,
          boothCode: booth.code,
          openingCount: db.jobOpenings.filter(
            (opening) =>
              opening.employerId === employer.id && opening.fairIds.includes(fairId),
          ).length,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return okList(exhibitors);
};

/**
 * `GET /fairs/{id}/job-openings` — every role being recruited for at this fair.
 *
 * Paginated, unlike the exhibitor list. A fair caps at 40 booths, but each of
 * those employers advertises several roles, so this list runs into the
 * hundreds — the same order as `/candidates`, which is paginated for the same
 * reason.
 *
 * The employer name and booth code are denormalised in so a row renders
 * without a request of its own, exactly as `Booth` carries `employerName`.
 *
 * Filters: `function`, `type`, `level`, `employer_id`, `search`.
 */
export const listFairJobOpenings: MockHandler = ({ db, params, query }) => {
  const fairId = params['id'];
  if (!db.fairs.some((fair) => fair.id === fairId)) {
    return notFound('Fair not found.');
  }

  const jobFunction = query.get('function');
  const employmentType = query.get('type');
  const experienceLevel = query.get('level');
  const employerId = query.get('employer_id');
  const search = query.get('search')?.toLowerCase().trim();

  const employerById = new Map<string, Employer>(
    db.employers.map((employer) => [employer.id, employer]),
  );

  // An opening is only listed when its employer holds a booth here: the same
  // rule the exhibitor list uses, so the two views cannot disagree about who
  // is attending.
  const boothByEmployer = new Map<string, string>();
  for (const booth of db.booths) {
    if (booth.fairId === fairId && booth.employerId !== null) {
      boothByEmployer.set(booth.employerId, booth.code);
    }
  }

  const rows = db.jobOpenings
    .filter((opening) => {
      if (!opening.fairIds.includes(fairId)) {
        return false;
      }
      if (!boothByEmployer.has(opening.employerId)) {
        return false;
      }
      if (jobFunction && opening.jobFunction !== jobFunction) {
        return false;
      }
      if (employmentType && opening.employmentType !== employmentType) {
        return false;
      }
      if (experienceLevel && opening.experienceLevel !== experienceLevel) {
        return false;
      }
      if (employerId && opening.employerId !== employerId) {
        return false;
      }
      if (search) {
        const employer = employerById.get(opening.employerId);
        const haystack =
          `${opening.title} ${opening.jobFunction} ${opening.skills.join(' ')} ` +
          `${employer?.name ?? ''}`.toLowerCase();
        if (!haystack.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    })
    .map<FairJobOpening>((opening) => ({
      ...opening,
      employerName: employerById.get(opening.employerId)?.name ?? 'Unknown employer',
      boothCode: boothByEmployer.get(opening.employerId) as string,
    }))
    .sort((a, b) => a.title.localeCompare(b.title) || a.employerName.localeCompare(b.employerName));

  return paginate(rows, readPageRequest(query));
};
