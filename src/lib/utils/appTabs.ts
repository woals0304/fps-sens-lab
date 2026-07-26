import type { AppTab } from '../../types/models';

export function normalizeVisibleTab(tab: unknown): AppTab {
  if (tab === 'results') {
    return 'results';
  }

  if (tab === 'settings' || tab === 'history') {
    return 'settings';
  }

  return 'finder';
}
