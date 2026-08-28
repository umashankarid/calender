const API_URL: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensure the path portion ends with `/` to prevent FastAPI 307 redirects.
 * Preserves query strings: `/api/foo?x=1` → `/api/foo/?x=1`
 */
function ensureTrailingSlash(path: string): string {
  const qIdx = path.indexOf('?');
  if (qIdx === -1) {
    return path.endsWith('/') ? path : path + '/';
  }
  const base = path.slice(0, qIdx);
  const query = path.slice(qIdx);
  return (base.endsWith('/') ? base : base + '/') + query;
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse errors — use default message
    }
    throw new Error(message);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${ensureTrailingSlash(path)}`, {
    method: 'GET',
    headers: headers(token),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${ensureTrailingSlash(path)}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${ensureTrailingSlash(path)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete(path: string, token?: string): Promise<void> {
  const res = await fetch(`${API_URL}${ensureTrailingSlash(path)}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  await handleResponse<void>(res);
}
