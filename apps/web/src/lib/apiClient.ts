const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
const SESSION_KEY = 'fifam-session';
const LOGIN_PATH = '/login';

export { API_BASE_URL };

export type ApiError = Error & { status?: number; payload?: unknown };

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  token?: string;
  headers?: HeadersInit;
  body?: unknown;
};

export async function apiClient(path: string, options: ApiRequestOptions = {}) {
  const { token, headers, body, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJSON = response.headers.get('content-type')?.includes('application/json');
  const payload = isJSON ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      if (window.location.pathname !== LOGIN_PATH) {
        window.location.assign(LOGIN_PATH);
      }
    }

    const error = new Error(payload?.error || payload?.message || 'Request failed') as ApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
