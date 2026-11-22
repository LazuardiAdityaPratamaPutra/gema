// Menyalin templat Verifier Mandiri ke public/ dan memeriksa penanda yang dibutuhkan klien.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
mkdirSync('public', { recursive: true });
copyFileSync('scripts/verifier.src.html', 'public/verifier-template.html');
const html = readFileSync('public/verifier-template.html', 'utf8');
const marker = '<script type="application/json" id="gema-proof">null</script>';
if (!html.includes(marker)) throw new Error('Penanda bukti hilang dari templat verifier');
if (/https?:\/\//.test(html.replace(/<meta[^>]*>/g, '')))
  throw new Error('Verifier tidak boleh memuat sumber luar');
console.log('verifier-template.html siap (' + html.length + ' byte)');
