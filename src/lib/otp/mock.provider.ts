import type { OtpProvider, OtpSendResult } from './provider';

export class MockOtpProvider implements OtpProvider {
  readonly name = 'mock';

  async sendOtp(phone: string, otp: string): Promise<OtpSendResult> {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║  [MOCK OTP]  Phone: ${phone.padEnd(16)}        ║`);
    console.log(`║  OTP CODE  : ${otp}                          ║`);
    console.log('╚══════════════════════════════════════════╝\n');
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}
