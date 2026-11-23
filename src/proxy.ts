import { NextResponse, type NextRequest } from 'next/server';

/**
 * CSP ketat berbasis nonce: tiap permintaan halaman mendapat nonce acak, dan hanya skrip/gaya
 * yang membawa nonce itu (serta yang dimuatnya, 'strict-dynamic') boleh jalan. Tidak ada 'unsafe-inline' untuk skrip.
 * Atribut style="" dari React diizinkan lewat style-src-attr, karena tidak dapat menjalankan kode.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}`,
    // Dev: Turbopack menyisipkan <style> tanpa nonce saat HMR. Produksi tetap hanya bernonce.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Bobot model pengenal suara diunduh dari Hugging Face (atau host sendiri lewat NEXT_PUBLIC_GEMA_MODEL_HOST).
    // Yang diunduh hanya bobot model; suara dan teks tidak pernah dikirim.
    "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|ort|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
