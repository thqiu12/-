export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      (typeof body === "object" && body !== null && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
