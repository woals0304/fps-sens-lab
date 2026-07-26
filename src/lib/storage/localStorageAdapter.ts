import { createSampleSession } from '../../data/sampleSessions';
import { LOCAL_STORAGE_KEY, STORAGE_VERSION } from '../constants/appConstants';
import { migrateStoredSession } from './sessionMigrations';
import type { StorageAdapter, StoredSession } from '../../types/models';

type UnknownRecord = Record<string, unknown>;

interface RawSessionReadResult {
  ok: boolean;
  items: unknown[];
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function readRawSessions(): RawSessionReadResult {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!saved) {
      return { ok: true, items: [] };
    }

    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? { ok: true, items: parsed } : { ok: false, items: [] };
  } catch {
    return { ok: false, items: [] };
  }
}

function getRawSessionId(item: unknown): string | null {
  return isObject(item) && typeof item.id === 'string' ? item.id : null;
}

function isFutureSession(item: unknown): boolean {
  return (
    isObject(item) &&
    typeof item.storageVersion === 'number' &&
    item.storageVersion > STORAGE_VERSION
  );
}

function readSessions(): StoredSession[] {
  const raw = readRawSessions();

  if (!raw.ok) {
    return [];
  }

  return raw.items.flatMap((item) => {
    try {
      const migrated = migrateStoredSession(item);
      return migrated ? [migrated] : [];
    } catch {
      // 한 항목이 손상돼도 나머지 정상 세션은 계속 복구합니다.
      return [];
    }
  });
}

function writeSessions(sessions: unknown[]): boolean {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    listSessions: () => readSessions().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    getSession: (id) => readSessions().find((session) => session.id === id) ?? null,
    saveSession: (session) => {
      const raw = readRawSessions();

      // 해석할 수 없는 원문을 빈 배열로 오인해 덮어쓰지 않습니다.
      if (!raw.ok) {
        return false;
      }

      // 더 최신 앱이 만든 같은 세션은 현재 앱에서 변경하지 않습니다.
      if (raw.items.some((item) => getRawSessionId(item) === session.id && isFutureSession(item))) {
        return false;
      }

      const index = raw.items.findIndex((item) => getRawSessionId(item) === session.id);

      if (index >= 0) {
        raw.items[index] = session;
      } else {
        raw.items.push(session);
      }

      return writeSessions(raw.items);
    },
    deleteSession: (id) => {
      const raw = readRawSessions();

      if (!raw.ok) {
        return false;
      }

      if (raw.items.some((item) => getRawSessionId(item) === id && isFutureSession(item))) {
        return false;
      }

      return writeSessions(raw.items.filter((item) => getRawSessionId(item) !== id));
    },
    loadSampleSession: () => createSampleSession(),
  };
}
