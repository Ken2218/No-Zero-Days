import API_BASE_URL from '../config';

const STUDENT_KEY = 'student';
const TEACHER_KEY = 'teacher';
const TEACHER_ROOM_STATUS_KEY = 'teacherRoomStatus';

function readStoredToken(): string | null {
  try {
    const studentRaw = localStorage.getItem(STUDENT_KEY);
    if (studentRaw) {
      const student = JSON.parse(studentRaw);
      if (student && typeof student.token === 'string' && student.token) {
        return student.token;
      }
    }
    const teacherRaw = localStorage.getItem(TEACHER_KEY);
    if (teacherRaw) {
      const teacher = JSON.parse(teacherRaw);
      if (teacher && typeof teacher.token === 'string' && teacher.token) {
        return teacher.token;
      }
    }
  } catch (_) {
    // Corrupted storage — treat as logged out
  }
  return null;
}

export function getAuthToken(): string | null {
  return readStoredToken();
}

/**
 * fetch() wrapper that attaches the current session's Bearer token.
 * Use for every authenticated API call so requests survive the backend
 * interceptor's token check. Accepts either a path ("/api/...") or an
 * absolute URL.
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = readStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  return fetch(url, { ...options, headers });
}

export async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string' && data.error) {
      return data.error;
    }
  } catch (_) {
    try {
      const text = await res.text();
      if (text) return text;
    } catch (_) {}
  }
  return fallback;
}

/**
 * Best-effort server logout (clears the session token), then wipes local
 * auth storage. Safe to call even when the stored token is already invalid.
 */
export async function logout(): Promise<void> {
  const token = readStoredToken();
  if (token) {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // Network failure — local cleanup below still logs the user out
    }
  }
  try {
    localStorage.removeItem(STUDENT_KEY);
    localStorage.removeItem(TEACHER_KEY);
    localStorage.removeItem(TEACHER_ROOM_STATUS_KEY);
  } catch (_) {}
}
