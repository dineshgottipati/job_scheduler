const API_BASE = '/api/v1';

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.message || `HTTP ${res.status} ${res.statusText}`;
    const err = new Error(errorMsg);
    (err as any).code = data?.error?.code;
    (err as any).status = res.status;
    (err as any).requestId = data?.error?.requestId;
    throw err;
  }

  return data;
}
