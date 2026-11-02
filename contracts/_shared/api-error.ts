// Frontend shared error — copy into e.g. src/api/api-error.ts
// Every generated client throws ApiError on non-2xx.
export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(status: number, body: { error?: { code?: string; message?: string; details?: unknown } }) {
    super(body?.error?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "UNKNOWN_ERROR";
    this.details = body?.error?.details ?? null;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, (body ?? {}) as never);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}