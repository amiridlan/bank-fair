import type { Booth } from '../../models';
import { type MockHandler, notFound, ok, okList } from '../mock-response';

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
