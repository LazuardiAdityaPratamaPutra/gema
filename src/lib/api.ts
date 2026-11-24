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

/** Header dan badan permintaan: biner mentah, JSON, atau tanpa badan. */
function requestOf(opts: Opts): { headers: Record<string, string>; body?: BodyInit } {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = 'Bearer ' + opts.token;
  if (opts.raw) {
    headers['content-type'] = 'application/octet-stream';
    return { headers, body: opts.raw as unknown as BodyInit };
  }
  if (opts.body === undefined) return { headers };
  headers['content-type'] = 'application/json';
  return { headers, body: JSON.stringify(opts.body) };
}

/** Galat dari server: pesan dari isi JSON bila ada, kalau tidak pesan umum. */
async function failureOf(res: Response, isJson: boolean): Promise<ApiError> {
  if (!isJson) return new ApiError(res.status, 'Terjadi kesalahan.');
  const data: Record<string, unknown> | undefined = await res.json().catch(() => undefined);
  return new ApiError(
    res.status,
    (data?.error as string | undefined) ?? 'Terjadi kesalahan.',
    data,
  );
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { headers, body } = requestOf(opts);
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
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!res.ok) throw await failureOf(res, isJson);
  return (isJson ? await res.json() : new Uint8Array(await res.arrayBuffer())) as T;
}
