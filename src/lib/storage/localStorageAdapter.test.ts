import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, LOCAL_STORAGE_KEY, STORAGE_VERSION } from '../constants/appConstants';
import { createLocalStorageAdapter } from './localStorageAdapter';
import { createSession } from '../utils/sessionUtils';

describe('localStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장 후 다시 읽을 수 있다', () => {
    const adapter = createLocalStorageAdapter();
    const session = createSession(DEFAULT_SETTINGS);

    expect(adapter.saveSession(session)).toBe(true);

    expect(adapter.listSessions()).toHaveLength(1);
    expect(adapter.getSession(session.id)?.id).toBe(session.id);
  });

  it('localStorage 저장이 실패해도 앱 오류로 터지지 않는다', () => {
    const adapter = createLocalStorageAdapter();
    const session = createSession(DEFAULT_SETTINGS);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(adapter.saveSession(session)).toBe(false);
    expect(adapter.listSessions()).toEqual([]);
  });

  it('손상된 세션이 섞여 있어도 정상 세션은 복구한다', () => {
    const adapter = createLocalStorageAdapter();
    const validSession = createSession(DEFAULT_SETTINGS);

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([
        validSession,
        {
          id: 'broken-session',
          settings: DEFAULT_SETTINGS,
          rangeEntries: [null],
        },
      ]),
    );

    expect(adapter.listSessions().map((session) => session.id)).toEqual([validSession.id]);
  });

  it('삭제 내용을 저장하지 못하면 실패를 반환하고 기존 기록을 유지한다', () => {
    const adapter = createLocalStorageAdapter();
    const session = createSession(DEFAULT_SETTINGS);
    expect(adapter.saveSession(session)).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(adapter.deleteSession(session.id)).toBe(false);
    expect(adapter.listSessions()).toHaveLength(1);
  });

  it('미래 버전 세션은 다른 세션을 저장하거나 삭제해도 원문을 보존한다', () => {
    const adapter = createLocalStorageAdapter();
    const session = createSession(DEFAULT_SETTINGS);
    const futureSession = {
      id: 'future-session',
      storageVersion: STORAGE_VERSION + 1,
      settings: DEFAULT_SETTINGS,
      futureOnlyField: { keep: true },
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([futureSession]));

    expect(adapter.saveSession(session)).toBe(true);
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]')).toContainEqual(futureSession);

    expect(adapter.deleteSession(session.id)).toBe(true);
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]')).toEqual([futureSession]);
  });

  it('미래 버전과 같은 id는 덮어쓰거나 삭제하지 않는다', () => {
    const adapter = createLocalStorageAdapter();
    const futureSession = {
      id: 'shared-id',
      storageVersion: STORAGE_VERSION + 1,
      settings: DEFAULT_SETTINGS,
      futureOnlyField: 'preserve-me',
    };
    const session = { ...createSession(DEFAULT_SETTINGS), id: futureSession.id };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([futureSession]));

    expect(adapter.saveSession(session)).toBe(false);
    expect(adapter.deleteSession(futureSession.id)).toBe(false);
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]')).toEqual([futureSession]);
  });

  it('해석할 수 없는 저장소 원문은 새 저장으로 덮어쓰지 않는다', () => {
    const adapter = createLocalStorageAdapter();
    const session = createSession(DEFAULT_SETTINGS);
    localStorage.setItem(LOCAL_STORAGE_KEY, '{broken-json');

    expect(adapter.saveSession(session)).toBe(false);
    expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('{broken-json');
  });
});
