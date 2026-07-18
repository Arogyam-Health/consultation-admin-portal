import type { OtpProvider } from './provider';
import { MockOtpProvider } from './mock.provider';
import { VatiOtpProvider } from './vati.provider';

export { generateOtp, hashOtp, timingSafeCompare } from './provider';
export type { OtpProvider, OtpSendResult } from './provider';

let _instance: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (_instance) return _instance;

  const providerType = process.env.OTP_PROVIDER || 'mock';

  if (providerType === 'wati') {
    if (process.env.NODE_ENV === 'production' && process.env.MOCK_OTP_CODE) {
      throw new Error('Cannot use MOCK_OTP_CODE in production with OTP_PROVIDER=wati. Remove MOCK_OTP_CODE from env.');
    }
    _instance = new VatiOtpProvider();
  } else {
    _instance = new MockOtpProvider();
  }

  return _instance;
}
