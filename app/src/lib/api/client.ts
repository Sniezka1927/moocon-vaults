const configuredApiEndpoint =
  import.meta.env.VITE_API_ENDPOINT ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:7777'

export const API_BASE_URL = configuredApiEndpoint.replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init
  })
  console.log(res)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, res.statusText, text)
  }
  return res.json() as Promise<T>
}
