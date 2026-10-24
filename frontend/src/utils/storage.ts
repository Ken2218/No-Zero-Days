// Per-student namespaced storage keys for phase timers and autosaved progress.
// Without namespacing, two students sharing one browser (or one student switching
// accounts) would read each other's saved progress and timers.

const TIMER_PREFIX = 'phase_timer_';
const PROGRESS_PREFIX = 'phase_progress_';
const VIEW_PREFIX = 'current_view_';

const sanitize = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export function getStorageNamespace(studentNumber?: string | null, roomCode?: string | null): string {
  const num = (studentNumber || '').toString().trim();
  const room = (roomCode || '').toString().trim();
  return num ? `${sanitize(num)}__${sanitize(room)}` : '';
}

export function phaseTimerKey(phase: number, namespace: string): string {
  return namespace ? `${TIMER_PREFIX}${phase}__${namespace}` : `${TIMER_PREFIX}${phase}`;
}

export function phaseProgressKey(phase: number, namespace: string): string {
  return namespace ? `${PROGRESS_PREFIX}${phase}__${namespace}` : `${PROGRESS_PREFIX}${phase}`;
}

export function currentViewKey(namespace: string): string {
  return namespace ? `${VIEW_PREFIX}${namespace}` : `${VIEW_PREFIX}default`;
}

export function clearAllPhaseStorage(): void {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(TIMER_PREFIX) || key.startsWith(VIEW_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(PROGRESS_PREFIX)) sessionStorage.removeItem(key);
    });
  } catch (_) {
    // Storage may be unavailable (private mode) — nothing to clean up
  }
}
