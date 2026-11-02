// Frontend shared error (Vanilla JS) — copy into e.g. src/api/api-error.js
// Every generated vanilla client throws ApiError on non-2xx. No dependencies.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "UNKNOWN_ERROR";
    this.details = body?.error?.details ?? null;
  }
}

export async function request(path, init) {
  const res = await fetch(path, init);
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, body ?? {});
  }
  if (res.status === 204) return undefined;
  return await res.json();
}