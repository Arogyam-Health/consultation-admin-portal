import crypto from 'crypto';

export interface OtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface OtpProvider {
  sendOtp(phone: string, otp: string): Promise<OtpSendResult>;
  readonly name: string;
}

export function generateOtp(): string {
  const n = crypto.randomInt(100_000, 1_000_000);
  return n.toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
