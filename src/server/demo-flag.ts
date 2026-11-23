/**
 * Mode Demo aman-secara-bawaan. Di produksi, demo hanya aktif bila `GEMA_DEMO=on` dinyatakan eksplisit;
 * `off` selalu mematikan. Di pengembangan dan uji (bukan produksi), demo aktif kecuali `off`.
 * Demo membuka masuk Satgas tanpa kata sandi (untuk institusi demo) dan titik reset, jadi tidak boleh
 * menyala karena lupa mengatur variabel lingkungan.
 */
export function demoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GEMA_DEMO === 'on') return true;
  if (env.GEMA_DEMO === 'off') return false;
  return env.NODE_ENV !== 'production';
}
