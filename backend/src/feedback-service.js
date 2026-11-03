// Punto 10: guarda valoraciones y agradecimientos como eventos de reputación (punto 2), con
// source_id = returns.id. El índice único (user_id, event_type, source_id) garantiza uno por
// parte y por caso: si ya existe, no se modifica.
import { recordReputationEvent } from './reputation.js';
import { FEEDBACK_DAYS, feedbackOutcome, feedbackTarget } from './feedback-rules.js';

// kind: 'rating' | 'thanks'. data: { value, message } o { message }.
// outcome: 'saved' | 'not_found' | 'not_recoverer' | 'window_closed' | 'already_sent'.
export async function sendFeedback(database, returnId, userId, kind, data) {
  return database.transaction(async client => {
    const found = await client.query(
      `SELECT id, returner_id, recoverer_id, now() < returned_at + $2::int * interval '1 day' AS feedback_open
         FROM public.returns WHERE id = $1`,
      [returnId, FEEDBACK_DAYS],
    );
    const ret = found.rows[0];
    const outcome = feedbackOutcome(ret, userId, kind);
    if (outcome !== 'ok') return { outcome };
    const inserted = await recordReputationEvent(client, {
      userId: feedbackTarget(ret, userId), type: kind, sourceId: ret.id, authorId: userId,
      value: kind === 'rating' ? data.value : 1, message: data.message,
    });
    return { outcome: inserted.rowCount ? 'saved' : 'already_sent' };
  });
}
