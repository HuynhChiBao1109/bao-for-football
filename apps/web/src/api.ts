const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

export { API_BASE_URL };

type ApiRequestOptions = RequestInit & {
  token?: string;
  headers?: HeadersInit;
  body?: unknown;
};

export async function apiRequest(path: string, options: ApiRequestOptions = {}) {
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
    const error = new Error(payload?.error || payload?.message || 'Request failed') as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
