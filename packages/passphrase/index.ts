/** Passphrase 6 kata dari daftar 7.776 kata dasar Bahasa Indonesia ≈ 77,5 bit. Dimuat malas hanya saat membuat akun. */
import { randomIndex } from '@gema/crypto';
import { WORDLIST } from './wordlist';

export { WORDLIST };

export function generatePassphrase(words = 6): string {
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(WORDLIST[randomIndex(WORDLIST.length)]);
  return out.join(' ');
}

export function passphraseEntropyBits(words = 6): number {
  return Math.round(words * Math.log2(WORDLIST.length) * 10) / 10;
}
