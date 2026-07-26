import { ensureExperimentState } from '../lib/experiment/experimentController';
import type { StoredSession } from '../types/models';

export function resolveCurrentSession(
  sessions: StoredSession[],
  currentSessionId: string | null,
): StoredSession | null {
  const storedSession = sessions.find((session) => session.id === currentSessionId) ?? null;
  return storedSession ? ensureExperimentState(storedSession) : null;
}
