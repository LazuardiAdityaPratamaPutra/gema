import crypto from 'node:crypto';

export function hashPassword(pw: string, salt = crypto.randomBytes(12).toString('hex')): string {
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
export function checkPassword(pw: string, stored: string): boolean {
  const [, salt, h] = stored.split('$');
  const c = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h));
}
