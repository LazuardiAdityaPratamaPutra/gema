export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Opts = { method?: string; token?: string; body?: unknown; raw?: Uint8Array };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = 'Bearer ' + opts.token;
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers['content-type'] = 'application/octet-stream';
    body = opts.raw as unknown as BodyInit;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch('/api/' + path, {
      method: opts.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung. Periksa koneksimu, lalu coba lagi.');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    let msg = 'Terjadi kesalahan.';
    let data: Record<string, unknown> | undefined;
    if (type.includes('json')) {
      data = await res.json().catch(() => undefined);
      msg = (data?.error as string | undefined) ?? msg;
    }
    throw new ApiError(res.status, msg, data);
  }
  return (type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer())) as T;
}
