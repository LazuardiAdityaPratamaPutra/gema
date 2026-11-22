import { describe, expect, it } from 'vitest';
import { cleanTranscript } from './asr-config';
describe('pembersih transkrip', () => {
  it('meringkas pengulangan', () => {
    expect(cleanTranscript('di ruang-yang-yang-yang-yang-yang dosen')).toBe('di ruang-yang dosen');
    expect(cleanTranscript('saya saya saya takut')).toBe('saya takut');
  });
  it('membuang halusinasi umum pada audio tak jelas', () => {
    expect(cleanTranscript(' Thank you.')).toBe('');
    expect(cleanTranscript('Terima kasih telah menonton!')).toBe('');
    expect(cleanTranscript('Terima kasih, Pak, tapi saya menolak.')).toBe(
      'Terima kasih, Pak, tapi saya menolak.',
    );
  });
  it('membiarkan kalimat normal', () => {
    expect(cleanTranscript('Dia memegang tangan saya.')).toBe('Dia memegang tangan saya.');
  });
});
