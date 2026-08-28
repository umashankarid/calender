const API_URL: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure path ends with / to avoid 307 redirects on POST/PUT */
function normalizePath(path: string): string {
  const [base, query] = path.split('?');
  const normalized = base.endsWith('/') ? base : base + '/';
  return query ? `${normalized}?${query}` : normalized;
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
  const res = await fetch(`${API_URL}${normalizePath(path)}`, {
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
  const res = await fetch(`${API_URL}${normalizePath(path)}`, {
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
  const res = await fetch(`${API_URL}${normalizePath(path)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete(path: string, token?: string): Promise<void> {
  const res = await fetch(`${API_URL}${normalizePath(path)}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  await handleResponse<void>(res);
}
